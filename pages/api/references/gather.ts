/* /pages/api/references/gather.ts */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { callLLM } from '@/lib/ai';
import { gatherForSection } from '@/lib/gather';

type GatherReq = {
  outlineId: string;
  maxPerSection?: number;
  fixedPerSection?: number;
  customPlan?: Record<string, number>;
  sources?: Array<'crossref' | 'semanticscholar'>;
  preview?: boolean;
  enableLLMQueryExpand?: boolean;
  enableLLMRerank?: boolean;

  /** 新增：若文章主題是 AI，強制只收 AI 相關文獻 */
  aiTopicLock?: boolean;
  
  // 新增设置参数
  documentTypes?: string[];
  citationFormat?: string;
  region?: string;
  language?: string;
  yearRange?: { from: number; to: number };
};

type RefExplain = {
  keySentence: string;       // 可貼的重點句（<= 40字；若英文會原文保留）
  credibilityNote: string;   // 可信度/樣本/會議期刊等（<= 50字）
  placementTip: string;      // 建議放在哪一句旁（<= 40字）
};

type RefItem = {
  sectionKey: string;
  title: string;
  url: string;
  doi?: string | null;
  source?: string | null;
  authors?: string | null;
  publishedAt?: string | null;
  type?: string;
  summary?: string | null;
  credibility?: number;
  /** 新增：結構化解釋 + 引用句 */
  explain?: RefExplain;
};

type ResBody =
  | { saved: RefItem[]; spent: number; remainingCredits: number; preview?: true }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const session = await getAuthSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: '未登入' });

  const {
    outlineId,
    maxPerSection = 3,
    fixedPerSection,
    customPlan,
    sources = ['crossref', 'semanticscholar'],
    preview = false,
    enableLLMQueryExpand = true,
    enableLLMRerank = true,
    aiTopicLock = true, // ← 預設開：主題是 AI 時，鎖 AI 文獻
    // 新增设置参数
    documentTypes = ['journal', 'book', 'conference'],
    citationFormat = 'apa7',
    region = 'global',
    language = 'en',
    yearRange = { from: 2010, to: new Date().getFullYear() },
  } = (req.body || {}) as GatherReq;

  if (!outlineId) return res.status(400).json({ error: '缺少 outlineId' });

  const [outline, user] = await Promise.all([
    prisma.outline.findFirst({
      where: { id: outlineId, userId: session.user.id },
      select: { id: true, title: true, content: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, credits: true } }),
  ]);

  if (!outline) return res.status(404).json({ error: '大綱不存在或無權限' });
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  // 檢測此稿是否 AI 主題（中文/英文關鍵詞）
  const isAiTopic = aiTopicLock && /(^|\W)(ai|人工智慧|人工智能|machine learning|deep learning|neural|transformer|大語言模型|LLM|生成式|gen(erative)?\s+ai)\b/i.test(
    `${outline.title}\n${outline.content}`
  );

  let plan: Record<string, number> = {};
  if (customPlan && Object.keys(customPlan).length) {
    plan = clampPlan(customPlan, maxPerSection);
  } else if (fixedPerSection && fixedPerSection > 0) {
    plan = makeFlatPlan(outline.content, Math.min(fixedPerSection, maxPerSection));
  } else {
    plan = await getPlanByLLM(outline.content, maxPerSection);
  }

  const totalNeed = Object.values(plan).reduce((a, b) => a + b, 0);
  if (!preview && (user.credits ?? 0) < totalNeed) {
    return res.status(402).json({ error: `點數不足：需 ${totalNeed} 點，剩餘 ${user.credits} 點` });
  }

  const toSave: RefItem[] = [];
  for (const [sectionKey, need] of Object.entries(plan)) {
    const cands = await gatherForSection(
      outline.title,
      outline.content,
      sectionKey,
      {
        need,
        sources,
        enableLLMQueryExpand,
        enableLLMRerank,
        // 新增透傳：是否鎖 AI 主題（在 lib/gather.ts 會做過濾/加權）
        aiTopicLock: isAiTopic,
        // 檢索條件全部透傳給 lib/gather.ts
        language,
        region,
        yearRange,
        documentTypes,
        citationFormat,
      } as any
    );

    for (const c of cands) {
      const explain = await explainReferenceJSON(
        c.title,
        c.summary ?? '',
        outline.title,
        sectionKey
      );
      toSave.push({ ...c, sectionKey, explain, type: c.type || 'OTHER' });
    }
  }

  if (preview) {
    return res.status(200).json({
      saved: toSave,
      spent: 0,
      remainingCredits: user.credits ?? 0,
      preview: true,
    });
  }

  // 入庫 + 扣點
  const data = toSave.map((c) => ({
    userId: user.id,
    outlineId: outline.id,
    sectionKey: c.sectionKey,
    title: c.title,
    url: c.url,
    doi: c.doi ?? null,
    source: c.source ?? null,
    authors: c.authors ?? null,
    publishedAt: c.publishedAt && safeDate(c.publishedAt) ? new Date(safeDate(c.publishedAt)!) : null,
    type: c.type ?? 'OTHER',
    summary: c.summary ?? null,
    credibility: c.credibility ?? 0,
    // 儲存成純文字（前端再 parse）
    explain: c.explain ? JSON.stringify(c.explain) : null,
  }));

  const txRes = await prisma.$transaction(async (tx) => {
    const write = await tx.reference.createMany({ data, skipDuplicates: true });
    const spent = write.count;

    if (spent > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: { credits: { decrement: spent } },
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          amount: spent,
          type: 'USAGE_REFERENCE',
          description: `引用產生 - 扣 ${spent} 點 (outline ${outline.id})`,
        },
      });
    }
    return { spent, remain: (user.credits ?? 0) - spent };
  });

  const rows = await prisma.reference.findMany({
    where: { outlineId: outline.id, userId: user.id },
    orderBy: [{ sectionKey: 'asc' }, { credibility: 'desc' }, { createdAt: 'asc' }],
    select: {
      sectionKey: true,
      title: true,
      url: true,
      doi: true,
      source: true,
      authors: true,
      credibility: true,
      summary: true,
      explain: true,
    },
  });

  // 轉回結構化 explain 給前端
  const saved: RefItem[] = rows.map(r => ({
    ...r,
    explain: r.explain ? JSON.parse(r.explain as any) : undefined,
  })) as any;

  return res.status(200).json({ saved, spent: txRes.spent, remainingCredits: txRes.remain });
}

/* ---------------- 工具函式（保留 + 小修） ---------------- */

function clampPlan(raw: Record<string, number>, cap: number) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Math.max(1, Math.min(cap, Number(v) || 0));
    if (n) out[k] = n;
  }
  return Object.keys(out).length ? out : { I: 1 };
}

function makeFlatPlan(outline: string, n: number) {
  const keys = extractSectionKeys(outline);
  const out: Record<string, number> = {};
  keys.forEach((k) => (out[k] = Math.max(1, n)));
  return Object.keys(out).length ? out : { I: n };
}

async function getPlanByLLM(outline: string, cap: number): Promise<Record<string, number>> {
  const prompt =
    `下面的大綱，請輸出 JSON 形式（鍵=段落 key，值=建議引用數 1~${cap}）。` +
    `鍵名務必保持原文的章節起頭編號（例如「一、」「2.」「III.」）：\n\n${outline}\n\n只輸出純 JSON。`;
  try {
    const raw = await callLLM(
      [{ role: 'user', content: prompt }],
      { model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo', temperature: 0.2, timeoutMs: 30_000 }
    );
    return clampPlan(JSON.parse(raw), cap);
  } catch {
    return { '一、': 2 };
  }
}

function extractSectionKeys(outline: string): string[] {
  const lines = outline.split(/\r?\n/).map((l) => l.trim());
  const headerRe = /^((?:[一二三四五六七八九十]+、)|(?:\d+\.)|(?:[IVXLCDMivxlcdm]+\.))\s+/;
  const keys: string[] = [];
  for (const ln of lines) {
    const m = ln.match(headerRe);
    if (m) keys.push(m[1]);
  }
  const seen = new Set<string>();
  return keys.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
}

/** 回傳結構化 JSON：可引用句 + 為何好 + 放哪裡 */
async function explainReferenceJSON(
  title: string,
  abstractOrSummary: string,
  paperTitle: string,
  sectionKey: string
): Promise<RefExplain> {
  // 先嘗試從摘要撈一句（摘要存在時）
  const seed = (abstractOrSummary || '').replace(/\s+/g, ' ').trim().slice(0, 800);
  let prePick = '';
  if (seed) {
    const m = seed.match(/[^.。！？!?]{20,200}[.。！？!?]/g);
    prePick = m?.[0]?.trim() || '';
  }

  const prompt =
    `學生論文主題：《${paperTitle}》，段落：${sectionKey}\n` +
    `文獻標題：「${title}」\n` +
    (seed ? `文獻摘要（節錄）：${seed}\n` : '') +
    `請以 JSON 回答，鍵名為 keySentence、credibilityNote、placementTip。\n` +
    `要求：\n` +
    `- keySentence：給出可直接引用的一句（<= 40字；如需英文可保留英文原句；若無摘要可憑標題常識擬一句高度概括的研究結論/定義）。\n` +
    `- credibilityNote：用 1 句解釋為何可靠（期刊/會議/樣本/資料集/方法/被引）。\n` +
    `- placementTip：建議放在本文哪句旁（<= 40字），例如「用於定義AI後的過渡句」。\n` +
    (prePick ? `若下列句子適合作為 keySentence，可直接採用：${prePick}\n` : '') +
    `只輸出 JSON，不要多餘文字。`;

  try {
    const raw = await callLLM([{ role: 'user', content: prompt }], {
      model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
      temperature: 0.3,
      timeoutMs: 18_000,
    });
    const obj = JSON.parse((raw || '{}').trim());
    return {
      keySentence: String(obj.keySentence || prePick || '').slice(0, 60),
      credibilityNote: String(obj.credibilityNote || '').slice(0, 60),
      placementTip: String(obj.placementTip || '').slice(0, 60),
    };
  } catch {
    return {
      keySentence: prePick || '',
      credibilityNote: '',
      placementTip: '',
    };
  }
}

function safeDate(s?: string | null) {
  if (!s) return undefined;
  const m = String(s).match(/\d{4}(-\d{2}-\d{2})?/);
  return m ? m[0] : undefined;
}
