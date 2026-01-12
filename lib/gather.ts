/* lib/gather.ts — Enhanced Scholarly Reference Harvester */
import { callLLM } from '@/lib/ai';

export type SourceKind = 'crossref' | 'semanticscholar' | 'wanfang';

export type RefItem = {
  sectionKey: string;
  title: string;
  url: string;
  doi?: string | null;
  source?: string | null;
  authors?: string | null;
  publishedAt?: string | null; // yyyy-mm-dd
  type?: string | null;        // JOURNAL/CONFERENCE/PREPRINT/etc.
  summary?: string | null;     // abstract/snippet
  credibility?: number;        // 0–100
  language?: string | null;    // 'en' | 'zh' | ...
  _kind?: SourceKind;          // internal: origin
  _score?: number;             // internal: sort score
};

export type GatherOpts = {
  need: number;
  sources?: SourceKind[];
  enableLLMQueryExpand?: boolean;
  enableLLMRerank?: boolean;
  aiTopicLock?: boolean;
  language?: 'en';
  region?: string;
  yearRange?: { from: number; to: number };
  documentTypes?: string[];
  citationFormat?: string;
};

const S2_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY || '';
const OPENALEX = process.env.OPENALEX_ENABLE === '1';
const ENABLE_LLM_EXPAND = process.env.REF_LLM_EXPAND === '1';
const ENABLE_LLM_RERANK = process.env.REF_LLM_RERANK === '1';

/* ---------------- utils ---------------- */
const isCJK = (s: string) => /[\u4e00-\u9fff]/.test(s || '');

function filterByLanguage(items: RefItem[], lang: GatherOpts['language']) {
  if (!lang) return items;
  if (lang === 'en') {
    return items.filter(p => {
      const L = p.language?.toLowerCase();
      if (L) return L.startsWith('en');
      return !isCJK((p.title || '') + ' ' + (p.summary || ''));
    });
  }
  return items;
}

function dedupe(items: RefItem[]) {
  const seen = new Set<string>();
  return items.filter(p => {
    const key = (p.doi?.toLowerCase() || '') || (p.url?.toLowerCase() || '') || p.title.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const AI_TOKENS = [
  'artificial intelligence','ai','machine learning','ml','deep learning','neural network',
  'transformer','large language model','llm','bert','gpt','diffusion','reinforcement learning',
  'computer vision','nlp','generative','foundation model'
];

/* --------------- main entry --------------- */
export async function gatherForSection(
  paperTitle: string,
  outline: string,
  sectionKey: string,
  opts: GatherOpts
): Promise<RefItem[]> {
  const sources: SourceKind[] = opts.sources?.length
    ? opts.sources
    : (['crossref', 'semanticscholar'] as SourceKind[]);

  const line = outline.split('\n').find(l => l.trim().startsWith(sectionKey));
  const hint = line ? line.replace(/^[IVX一二三四五六七八九十\.\)\s-]+/, '').slice(0, 160) : '';
  const base = `${paperTitle} ${sectionKey} ${hint}`.trim();

  console.log(`[gatherForSection] sectionKey: "${sectionKey}", hint: "${hint}", base: "${base}"`);

  const queries = await expandQueries(base, ENABLE_LLM_EXPAND || !!opts.enableLLMQueryExpand, opts.aiTopicLock);
  console.log(`[gatherForSection] 扩展后的查询:`, queries);

  const raw: RefItem[] = [];
  const perQueryNeed = Math.max(2, Math.ceil((opts.need || 5) / Math.max(1, queries.length)));

  for (const q of queries) {
    const tasks: Promise<RefItem[]>[] = [];
    for (const kind of sources) {
      if (kind === 'crossref') tasks.push(fetchCrossref(q, perQueryNeed, opts));
      else if (kind === 'semanticscholar') tasks.push(fetchSemanticScholar(q, perQueryNeed, opts));
      else if (kind === 'wanfang') tasks.push(fetchWanfang(q, perQueryNeed, opts));
    }
    const chunk = await Promise.allSettled(tasks);
    chunk.forEach(r => { 
      if (r.status === 'fulfilled') {
        console.log(`[gatherForSection] 查询 "${q}" 返回 ${r.value.length} 条结果`);
        raw.push(...r.value);
      } else {
        console.error(`[gatherForSection] 查询 "${q}" 失败:`, r.reason);
      }
    });
  }
  
  console.log(`[gatherForSection] 原始结果总数: ${raw.length}`);

  // language → dedupe → validity → (optional) AI lock
  let items = filterByLanguage(raw, opts.language);
  items = dedupe(items);
  items = items.filter(isValidReference);
  if (opts.aiTopicLock) items = items.filter(isClearlyAI);

  // Fallback to avoid empty UI (relax language/AI but keep dedupe & validity)
  if (!items.length) {
    const relaxed = dedupe(raw).filter(isValidReference);
    return relaxed.slice(0, opts.need || 5).map(stripInternal);
  }

  const context = buildContextForRelevance(paperTitle, hint, opts.aiTopicLock);
  const scored = await scoreAndSort(items, context, ENABLE_LLM_RERANK || !!opts.enableLLMRerank, opts.aiTopicLock);
  return scored.slice(0, opts.need || 5).map(stripInternal);
}

/* --------------- query expansion --------------- */
async function expandQueries(seed: string, useLLM: boolean, aiLock?: boolean): Promise<string[]> {
  const base = seed.replace(/\s+/g, ' ').trim();
  const enforced = aiLock
    ? uniqStrings([base, `${base} Artificial Intelligence`, `${base} machine learning`, `${base} deep learning`, `${base} large language model LLM`])
    : [base];

  if (!useLLM) return enforced.slice(0, 4);

  try {
    const prompt =
`Generate 3 compact academic search queries (<=10 keywords each) for Crossref/Semantic Scholar/arXiv/PubMed.
Topic: ${base}
${aiLock ? 'The topic MUST be about Artificial Intelligence / ML. Always include at least one AI term.' : ''}
Return ONLY a JSON array of strings.`;
    const raw = await callLLM([{ role: 'user', content: prompt }], {
      model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
      temperature: 0.2,
      timeoutMs: 15000,
    });
    const arr = JSON.parse((raw || '[]').trim());
    return uniqStrings([...enforced, ...(Array.isArray(arr) ? arr.map(String) : [])]).slice(0, 6);
  } catch {
    return enforced.slice(0, 4);
  }
}

/* --------------- fetchers --------------- */
async function fetchCrossref(query: string, limit: number, opts: Partial<GatherOpts> = {}): Promise<RefItem[]> {
  try {
    const { language = 'all', yearRange } = opts;
    const u = new URL('https://api.crossref.org/works');
    u.searchParams.set('query.bibliographic', query);

    const filters: string[] = [];
    if (yearRange) {
      filters.push(`from-pub-date:${yearRange.from}-01-01`);
      filters.push(`until-pub-date:${yearRange.to}-12-31`);
    }
    if (language === 'en') filters.push(`language:${language}`);
    if (filters.length) u.searchParams.set('filter', filters.join(','));
    u.searchParams.set('rows', String(Math.max(3, limit)));
    u.searchParams.set('select', 'title,author,issued,container-title,DOI,URL,type,abstract,language');

    const url = u.toString();
    console.log(`[CrossRef] 搜索: "${query}", URL: ${url}`);
    
    const r = await fetch(url, { headers: { 'User-Agent': ua() } });
    
    if (!r.ok) {
      console.error(`[CrossRef] HTTP错误: ${r.status} ${r.statusText}`);
      return [];
    }
    
    const j: any = await r.json().catch((err) => {
      console.error(`[CrossRef] JSON解析错误:`, err);
      return {};
    });
    
    const items = j?.message?.items ?? [];
    console.log(`[CrossRef] 找到 ${items.length} 条结果`);
    
    const strip = (s?: string) => (s || '').replace(/<\/?[^>]+>/g, '');

    return items.map((it: any): RefItem => ({
      sectionKey: '',
      title: (it?.title?.[0] ?? '').trim(),
      url: (it?.URL ?? '').trim() || (it?.DOI ? `https://doi.org/${it.DOI}` : ''),
      doi: it?.DOI ?? null,
      source: it?.['container-title']?.[0] ?? null,
      authors: (it?.author ?? []).map((a: any) => [a?.given, a?.family].filter(Boolean).join(' ')).filter(Boolean).join('; ') || null,
      publishedAt: yearToDate(it?.issued?.['date-parts']?.[0]?.[0]),
      type: (it?.type ?? 'JOURNAL')?.toUpperCase(),
      summary: strip(it.abstract),
      language: (it?.language || '').toLowerCase(),
      credibility: 88,
      _kind: 'crossref',
    })).filter((v: any) => v.title && v.url);
  } catch { return []; }
}

async function fetchSemanticScholar(query: string, limit: number, opts: Partial<GatherOpts> = {}): Promise<RefItem[]> {
  try {
    const { yearRange } = opts;
    const u = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
    u.searchParams.set('query', query);
    if (yearRange) u.searchParams.set('yearFilter', `${yearRange.from}-${yearRange.to}`);
    u.searchParams.set('limit', String(Math.max(3, limit)));
    u.searchParams.set('fields', 'title,abstract,year,venue,authors,url,externalIds,language');

    const headers: Record<string, string> = {};
    if (S2_KEY) headers['x-api-key'] = S2_KEY;
    
    const url = u.toString();
    console.log(`[SemanticScholar] 搜索: "${query}", URL: ${url}`);
    
    const r = await fetch(url, { headers });
    
    if (!r.ok) {
      const errorText = await r.text().catch(() => '');
      console.error(`[SemanticScholar] HTTP错误: ${r.status} ${r.statusText}, Response: ${errorText.substring(0, 200)}`);
      return [];
    }
    
    const j: any = await r.json().catch((err) => {
      console.error(`[SemanticScholar] JSON解析错误:`, err);
      return {};
    });
    
    const items = j?.data ?? [];
    console.log(`[SemanticScholar] 找到 ${items.length} 条结果`);
    return items.map((it: any): RefItem => ({
      sectionKey: '',
      title: it?.title ?? '',
      url: it?.url ?? '',
      doi: it?.externalIds?.DOI ?? null,
      source: it?.venue ?? 'Semantic Scholar',
      authors: (it?.authors ?? []).map((a: any) => a?.name).filter(Boolean).join('; ') || null,
      publishedAt: it?.year ? `${it.year}-01-01` : null,
      type: 'JOURNAL',
      summary: it?.abstract ?? null,
      language: (it?.language || '').toLowerCase(),
      credibility: 82,
      _kind: 'semanticscholar',
    })).filter((v: any) => v.title && v.url);
  } catch { return []; }
}

async function fetchWanfang(query: string, limit: number, opts: Partial<GatherOpts> = {}): Promise<RefItem[]> {
  try {
    // 万方数据 API 需要特殊的认证和参数
    // 这里提供一个基本的实现框架
    const u = new URL('https://www.wanfangdata.com.cn/api/search');
    u.searchParams.set('q', query);
    u.searchParams.set('size', String(Math.max(3, limit)));
    
    // 注意：万方数据可能需要特殊的认证和参数
    // 这里返回空数组，实际使用时需要配置正确的 API 密钥
    return [];
  } catch { return []; }
}

/* --------------- scoring --------------- */
async function scoreAndSort(items: RefItem[], context: string, useLLM: boolean, aiLock?: boolean): Promise<RefItem[]> {
  const nowYear = new Date().getFullYear();
  const relBase = items.map(it => ({ it, rel: relevanceKeyword(context, it, aiLock) }));

  let llmScores: Map<string, number> | null = null;
  if (useLLM && relBase.length) {
    const top = relBase.sort((a, b) => b.rel - a.rel).slice(0, 20).map(r => r.it);
    llmScores = await llmRelevance(context, top, aiLock);
  }

  const scored = items.map((it) => {
    const relKW = relevanceKeyword(context, it, aiLock);
    const relLLM = llmScores?.get(sig(it)) ?? relKW;
    const cred = credibilityBase(it);
    const rec = recencyScore(it, nowYear);
    const score = (aiLock ? 0.65 : 0.5) * relLLM + 0.25 * cred + 0.10 * rec;
    return { ...it, credibility: Math.round(cred), _score: score } as RefItem;
  });

  scored.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  return scored;
}

function relevanceKeyword(context: string, it: RefItem, aiLock?: boolean): number {
  const text = `${it.title} ${it.source ?? ''} ${it.summary ?? ''}`.toLowerCase();
  const ctxTokens = tokenSet(context);
  const txtTokens = tokenSet(text);
  const inter = [...ctxTokens].filter(t => txtTokens.has(t)).length;
  let score = (inter / Math.sqrt(ctxTokens.size * txtTokens.size || 1)) * 100;
  if (aiLock) {
    const hits = AI_TOKENS.filter(t => text.includes(t)).length;
    score += Math.min(30, hits * 6);
  }
  return Math.max(0, Math.min(100, score));
}

async function llmRelevance(context: string, items: RefItem[], aiLock?: boolean): Promise<Map<string, number>> {
  try {
    const payload = items.map((it, i) => ({ id: i + 1, title: it.title, abstract: it.summary || '', venue: it.source || '' }));
    const prompt =
`Rate relevance (0-100) of each candidate to the topic below.
${aiLock ? 'Reject or heavily downscore items not clearly about AI/ML.' : ''}
Topic:
${context}

Return ONLY a JSON object {id: score}.
Candidates:
${JSON.stringify(payload, null, 2)}`;
    const raw = await callLLM([{ role: 'user', content: prompt }], {
      model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
      temperature: 0,
      timeoutMs: 20000,
    });
    const obj = JSON.parse((raw || '{}').trim());
    const m = new Map<string, number>();
    items.forEach((it, idx) => m.set(sig(it), Number(obj[String(idx + 1)] ?? 0)));
    return m;
  } catch { return new Map(); }
}

function credibilityBase(it: RefItem): number {
  let s = 50;
  if (it.doi) s += 20;
  if (it.source) s += 10;
  const kindW: Record<string, number> = { crossref: 15, semanticscholar: 12 };
  s += kindW[it._kind || ''] || 0;
  return Math.max(0, Math.min(100, s));
}

function recencyScore(it: RefItem, nowYear: number): number {
  const y = (it.publishedAt || '').slice(0, 4);
  const year = Number(y) || 0;
  if (!year) return 50;
  const diff = Math.abs(nowYear - year);
  if (diff <= 1) return 100;
  if (diff <= 3) return 85;
  if (diff <= 5) return 70;
  if (diff <= 10) return 55;
  return 40;
}

/* --------------- filters & helpers --------------- */
function isValidReference(it: RefItem): boolean {
  if (!it.title || it.title.trim().length < 5) return false;
  if (!it.url || it.url.trim().length < 10) return false;

  const title = it.title.toLowerCase();
  const suspiciousPatterns = [
    '建議研究方向','suggested research direction','文獻：相關研究',
    'database research','相關研究文獻','related research literature'
  ];
  if (suspiciousPatterns.some(p => title.includes(p))) return false;

  if (it.authors) {
    const authors = it.authors.toLowerCase();
    const suspiciousAuthors = ['研究員','researcher','database','數據庫'];
    if (suspiciousAuthors.some(p => authors.includes(p))) return false;
  }

  const url = it.url.toLowerCase();
  const searchPatterns = ['/search?', '/search/', '?q=', '&q='];
  if (searchPatterns.some(p => url.includes(p))) return false;

  return true;
}

function isClearlyAI(it: RefItem): boolean {
  const t = `${it.title} ${it.summary || ''} ${it.source || ''}`.toLowerCase();
  return AI_TOKENS.some(k => t.includes(k));
}

function buildContextForRelevance(paperTitle: string, hint: string, aiLock?: boolean): string {
  const base = `${paperTitle}\n${hint}`.trim();
  return aiLock
    ? `${base}\nArtificial Intelligence; Machine Learning; Deep Learning; LLM; Transformer; Generative AI`
    : base;
}

function uniqStrings(arr: string[]): string[] {
  const s = new Set(arr.map(v => v.trim()).filter(Boolean));
  return Array.from(s);
}

function tokenSet(s: string): Set<string> {
  return new Set((s || '').toLowerCase().split(/[^a-z0-9一-龥]+/i).filter(w => w && w.length > 1));
}

function ua() {
  const site = process.env.NEXT_PUBLIC_APP_URL || 'https://assignment-terminator.example';
  return `AssignmentTerminator (+${site})`;
}

function yearToDate(y?: number): string | null {
  if (!y) return null;
  const n = Number(y);
  if (!n) return null;
  return `${n}-01-01`;
}

function grab(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : '';
}

function unescapeXml(s?: string | null): string {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function flattenInverted(inv: Record<string, number[]>): string {
  const max = Math.max(0, ...Object.values(inv).flat());
  const arr: string[] = new Array(max + 1).fill('');
  for (const [w, idxs] of Object.entries(inv)) idxs.forEach(i => (arr[i] = w));
  return arr.join(' ').trim();
}

function sig(it: RefItem): string {
  return (it.doi || it.url || it.title).toLowerCase();
}

function stripInternal(it: RefItem): RefItem {
  const { _kind, _score, ...rest } = it as any;
  return rest as RefItem;
}
