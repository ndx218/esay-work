// /pages/api/outline.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode, type StepName } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

type Ok = { outline: string; outlineId?: string; warning?: string };
type Err = { error: string };
type ResBody = Ok | Err;

/* ========================= utils ========================= */
function toZhNum(n: number): string {
  const base = ['零','一','二','三','四','五','六','七','八','九','十'];
  if (n <= 10) return base[n];
  if (n < 20) return '十' + base[n - 10];
  if (n % 10 === 0) return base[Math.floor(n / 10)] + '十';
  return base[Math.floor(n / 10)] + '十' + base[n % 10];
}

const HEADER_RE =
  /^((?:[一二三四五六七八九十]+、)|(?:[IVXLCDMivxlcdm]+\.)|(?:\d+\.))\s*(.+)$/;

function normalizeHeaders(text: string, language: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let sec = 0;
  const okHeader =
    /^((?:[一二三四五六七八九十]+、)|(?:[IVXLCDMivxlcdm]+\. )|(?:\d+\. ))/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { out.push(''); continue; }
    if (/^- /.test(line)) { out.push(line); continue; } // bullet
    if (okHeader.test(line + ' ')) { out.push(line); continue; }

    const m = line.match(/^[—–•]\s*(.+)$/);
    if (m && m[1]) {
      sec += 1;
      const title = m[1].trim();
      const isZH = /中|中文|zh/i.test(language);
      out.push(isZH ? `${toZhNum(sec)}、 ${title}` : `${sec}. ${title}`);
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

type Section = { marker: string; title: string; body: string[] };
function parseSections(text: string): { sections: Section[]; isZH: boolean } {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  let cur: Section | null = null;

  const isZH = /[一二三四五六七八九十]+、/.test(text.split('\n')[0] || '');

  for (const ln of lines) {
    const m = ln.match(HEADER_RE);
    if (m) {
      if (cur) sections.push(cur);
      cur = { marker: m[1], title: m[2].trim(), body: [] };
    } else {
      if (!cur) cur = { marker: isZH ? '一、' : '1.', title: isZH ? '引言' : 'Introduction', body: [] };
      cur.body.push(ln);
    }
  }
  if (cur) sections.push(cur);
  return { sections, isZH };
}

function rebuild(sections: Section[], isZH: boolean): string {
  const out: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const marker = isZH ? `${toZhNum(i + 1)}、` : `${i + 1}.`;
    out.push(`${marker} ${sections[i].title}`);
    out.push(...sections[i].body);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ================== structure guards ================== */
function ensureMinSections(raw: string, language: string, desiredBodies: number): string {
  const isZH = /中|中文|zh/i.test(String(language));
  const { sections } = parseSections(raw);

  const needBodies = Math.max(1, Number.isFinite(desiredBodies) ? desiredBodies : 3);
  const targetCount = needBodies + 2;

  if (sections.length >= 3) return raw;

  const secs = [...sections];
  if (secs.length === 2) {
    while (secs.length < targetCount - 1)
      secs.push({ marker: '', title: '（主體待補）', body: ['- （請補充要點）'] });
    secs.push({ marker: '', title: isZH ? '結論' : 'Conclusion', body: ['- （總結與展望）'] });
  } else if (secs.length === 1) {
    while (secs.length < targetCount - 1)
      secs.push({ marker: '', title: '（主體待補）', body: ['- （請補充要點）'] });
    secs.push({ marker: '', title: isZH ? '結論' : 'Conclusion', body: ['- （總結與展望）'] });
  }
  return rebuild(secs, isZH);
}

function normalizeSectionTitles(raw: string, language: string) {
  const isZH = /中|中文|zh/i.test(String(language));
  const { sections } = parseSections(raw);

  const fixed: Section[] = [];
  let bodySeen = 0;

  for (let k = 0; k < sections.length; k++) {
    let title = '';
    if (sections.length === 1) {
      title = isZH ? '引言' : 'Introduction';
    } else if (k === 0) {
      title = isZH ? '引言' : 'Introduction';
    } else if (k === sections.length - 1) {
      title = isZH ? '結論' : 'Conclusion';
    } else {
      bodySeen += 1;
      title = isZH ? `主體段${toZhNum(bodySeen)}` : `Body Paragraph ${bodySeen}`;
    }
    fixed.push({ marker: sections[k].marker, title, body: sections[k].body });
  }
  return rebuild(fixed, isZH);
}

/** 主體段副標（來自 paragraphPlan.bodyTitles）→ 「主體段一：xxx」 */
function attachCustomBodyTitles(
  raw: string,
  language: string,
  plan?: { bodyTitles?: string[] }
) {
  const isZH = /中|中文|zh/i.test(String(language));
  const { sections } = parseSections(raw);
  if (!sections.length) return raw;

  let bodyIdx = 0;
  for (let i = 0; i < sections.length; i++) {
    const isIntro = i === 0;
    const isConcl = i === sections.length - 1;
    if (isIntro || isConcl) continue;

    const custom = (plan?.bodyTitles?.[bodyIdx] || '').trim();
    bodyIdx += 1;
    if (!custom) continue;

    sections[i].title = isZH
      ? `${sections[i].title.replace(/\s+/g, '')}：${custom}`
      : `${sections[i].title}: ${custom}`;
  }
  return rebuild(sections, isZH);
}

function clipBodiesTo(raw: string, language: string, desiredBodies: number): string {
  const isZH = /中|中文|zh/i.test(String(language));
  const { sections } = parseSections(raw);
  if (sections.length < 3) return raw;

  const intro = sections[0];
  const bodies = sections.slice(1, sections.length - 1);
  const concl = sections[sections.length - 1];

  const keepN = Math.max(1, desiredBodies);
  if (bodies.length <= keepN) return raw;

  const kept = bodies.slice(0, keepN);
  const extra = bodies.slice(keepN);

  if (extra.length) {
    const last = kept[kept.length - 1];
    const explainIdx = last.body.findIndex(l => /^> 說明：/.test((l || '').trim()));
    const explainLine = explainIdx >= 0 ? last.body.splice(explainIdx, 1)[0] : null;

    for (const sec of extra) {
      const pure = sec.body.filter(Boolean).filter(l => !/^> 說明：/.test(l.trim()));
      if (pure.length) {
        if (last.body.length && last.body[last.body.length - 1].trim() !== '') last.body.push('');
        last.body.push(...pure);
      }
    }
    if (explainLine) last.body.push(explainLine);
  }
  return rebuild([intro, ...kept, concl], isZH);
}

/* ================== bullets: clean → backfill → enrich ================== */
function sanitizeAllBullets(raw: string, language: string): string {
  const isZH = /中|中文|zh/i.test(String(language));
  const { sections } = parseSections(raw);

  const norm = (s: string) =>
    s.replace(/^[-•]\s+/, '').replace(/[，。,.!？?；;：:\s]+$/g, '').toLowerCase();

  const MAX_LEN = isZH ? 60 : 120;
  const MIN_LEN = isZH ? 6 : 8;
  const MAX_BULLETS = 5;

  for (const sec of sections) {
    const explain = sec.body.filter(l => /^> 說明：/.test((l || '').trim()));
    let bullets = sec.body
      .map(s => s.trim())
      .filter(Boolean)
      .filter(s => /^[-•]\s+/.test(s))
      .map(s => {
        const core = norm(s);
        return { raw: s.startsWith('- ') ? s : `- ${s.replace(/^[-•]\s+/, '')}`, core };
      })
      .filter(x => x.core.length >= MIN_LEN && x.core.length <= MAX_LEN);

    const seen = new Set<string>();
    bullets = bullets.filter(x => {
      if (seen.has(x.core)) return false;
      seen.add(x.core);
      return true;
    });

    if (bullets.length > MAX_BULLETS) bullets = bullets.slice(0, MAX_BULLETS);

    if (bullets.length === 0) {
      sec.body = ['- （請補充要點）', ...explain];
    } else {
      sec.body = [...bullets.map(b => b.raw)];
      if (explain.length) sec.body.push(explain[0]);
    }
  }
  return rebuild(sections, isZH);
}

function isMissingBody(bodyLines: string[]) {
  const clean = bodyLines.map(s => s.trim()).filter(Boolean);
  if (clean.length === 0) return true;
  const onlyPlaceholders = clean.every(s =>
    /^[-•]?\s*[（(]/.test(s) || /^> 說明：/.test(s)
  );
  const hasBullet = clean.some(s => /^[-•]\s+/.test(s));
  return onlyPlaceholders || !hasBullet;
}

async function backfillMissingBullets(
  outline: string,
  ctx: { title: string; language: string; tone: string; detail?: string; reference?: string },
  llmOpt: { model: string; temperature?: number; timeoutMs?: number; title?: string; referer?: string }
) {
  const { sections, isZH } = parseSections(outline);
  let changed = false;

  for (const sec of sections) {
    if (!isMissingBody(sec.body)) continue;

    const prompt = `
請用「${ctx.language}」為主題《${ctx.title}》中的章節「${sec.title}」補出 3–5 條要點：
- 直接輸出每行以「- 」開頭的子彈點
- 不要加章節標題、不要加小節編號或其他說明
- 語氣：${ctx.tone}
- 盡量呼應本文的整體主題；可參考：${(ctx.detail || '').slice(0, 200)}
`.trim();

    let bullets = '';
    try {
      bullets = await callLLM([{ role: 'user', content: prompt }], {
        ...llmOpt,
        temperature: Math.min(0.8, (llmOpt.temperature ?? 0.6)),
        timeoutMs: Math.max(30_000, llmOpt.timeoutMs ?? 30_000),
        title: 'Outline Backfill',
      });
    } catch {
      continue;
    }

    const cleaned = String(bullets || '')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => (s.startsWith('- ') ? s : `- ${s.replace(/^[-•]\s+/, '')}`))
      .slice(0, 5);

    const explain = sec.body.find(l => /^> 說明：/.test((l || '').trim()));
    sec.body = [...(cleaned.length ? cleaned : ['- （請補充要點）']), ...(explain ? [explain] : [])];
    changed = true;
  }

  return changed ? rebuild(sections, isZH) : outline;
}

/** Enrich bullets to: 「短標題（保留/新增/補）：一句具體說明」 + optional a./b. subpoints + optional source keywords. */
async function enrichBullets(
  outline: string,
  ctx: { title: string; language: string; tone: string },
  llmOpt: { model: string; temperature?: number; timeoutMs?: number; title?: string; referer?: string }
) {
  const { sections, isZH } = parseSections(outline);
  let changed = false;

  for (const sec of sections) {
    // gather existing main bullets & keep explanation line
    const explain = sec.body.find(l => /^> 說明：/.test((l || '').trim())) || '';
    const bullets = sec.body
      .map(s => s.trim())
      .filter(Boolean)
      .filter(s => /^- /.test(s));

    if (bullets.length === 0) continue;

    const tagNote = isZH
      ? '（保留/新增/補）'
      : '(keep/add/expand)';

    const prompt = `
請用「${ctx.language}」將章節「${sec.title}」的要點改寫為高資訊密度版本，要求如下：
1) 只輸出 3–5 條主要要點，每條「必須」以「- 」開頭。
2) 每條格式為「短標題${tagNote}：一句具體說明（避免空話）」。
3) 視需要，在下一行縮排兩空白加入「a.」「b.」子要點（各 ≤ 20 字；可給例子/對比/指標/可操作步驟）。
4) 如合適，可在主行句尾加一個來源關鍵詞（非連結），例如：arXiv、ACL Anthology、OWASP、EU AI Act、Apple Security Research 等。
5) 不要章節標題、不要空行、不要連結；保留語氣：${ctx.tone}。
【原有要點】
${bullets.join('\n')}
`.trim();

    let enriched = '';
    try {
      enriched = await callLLM([{ role: 'user', content: prompt }], {
        ...llmOpt,
        temperature: Math.min(0.7, (llmOpt.temperature ?? 0.6)),
        timeoutMs: Math.max(35_000, llmOpt.timeoutMs ?? 35_000),
        title: 'Outline Enrich',
      });
    } catch {
      continue;
    }

    const lines = String(enriched || '')
      .split(/\r?\n/)
      .map(s => s.replace(/\s+$/,''));

    // keep only "- " main bullets and their immediate "  a./b." subpoints
    const newBody: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^- /.test(l)) {
        newBody.push(l);
        // attach following subpoints (max 2)
        const a = lines[i + 1]?.trimStart();
        const b = lines[i + 2]?.trimStart();
        if (/^a\.\s/.test(a || '')) newBody.push('  ' + a);
        if (/^b\.\s/.test(b || '')) newBody.push('  ' + b);
      }
    }
    if (newBody.length) {
      sec.body = [...newBody.slice(0, 12), ...(explain ? [explain] : [])];
      changed = true;
    }
  }

  return changed ? rebuild(sections, isZH) : outline;
}

/* ================== budgets ================== */
type ParagraphPlan = {
  intro?: number;
  conclusion?: number;
  bodyCount?: number;
  body?: number[];
  bodyTitles?: string[];
};

function appendWordBudgets(raw: string, language: string, total: number, plan?: ParagraphPlan) {
  const lines = raw.split(/\r?\n/);
  const headers: { idx: number; title: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEADER_RE);
    if (m) headers.push({ idx: i, title: m[2].trim() });
  }
  if (headers.length === 0) return raw;

  const isZH = /中|中文|zh/i.test(language);
  let budgets = new Array(headers.length).fill(0);

  const introPos =
    headers.findIndex(h => /引言|前言|introduction/i.test(h.title)) >= 0
      ? headers.findIndex(h => /引言|前言|introduction/i.test(h.title))
      : 0;
  const conclPos =
    headers.findIndex(h => /結論|總結|結語|conclusion/i.test(h.title)) >= 0
      ? headers.findIndex(h => /結論|總結|結語|conclusion/i.test(h.title))
      : headers.length - 1;

  if (plan && total > 0) {
    const bodySlots: number[] = [];
    for (let i = 0; i < headers.length; i++) if (i !== introPos && i !== conclPos) bodySlots.push(i);

    if (headers.length === 1) {
      budgets[0] = plan.intro ?? total;
    } else if (headers.length === 2) {
      budgets[introPos] = plan.intro ?? Math.round(total * 0.4);
      budgets[conclPos] = plan.conclusion ?? Math.round(total * 0.6);
    } else {
      budgets[introPos] = plan.intro ?? Math.round(total * 0.14);
      budgets[conclPos] = plan.conclusion ?? Math.round(total * 0.14);
      const bodyTotal = Math.max(0, total - budgets[introPos] - budgets[conclPos]);
      const desired = plan.body && plan.body.length ? plan.body.slice(0, bodySlots.length) : [];
      if (desired.length === bodySlots.length) {
        desired.forEach((v, i) => (budgets[bodySlots[i]] = v));
      } else {
        const per = bodySlots.length ? Math.round(bodyTotal / bodySlots.length) : 0;
        bodySlots.forEach((pos) => (budgets[pos] = per));
      }
    }
  } else {
    const weights: number[] = new Array(headers.length).fill(0);
    if (headers.length >= 3) {
      const introW = 0.14, conclW = 0.14;
      const remain = 1 - introW - conclW;
      const bodyCount = headers.length - 2;
      for (let i = 0; i < headers.length; i++) {
        if (i === introPos) weights[i] = introW;
        else if (i === conclPos) weights[i] = conclW;
        else weights[i] = remain / bodyCount;
      }
    } else if (headers.length === 2) {
      weights[introPos] = 0.4;
      weights[conclPos] = 0.6;
    } else {
      weights[0] = 1;
    }
    budgets = weights.map(w => Math.max(50, Math.round((total * w) / 10) * 10));
  }

  budgets = budgets.map(b => Math.max(50, Math.round(b / 10) * 10));
  const diff = total - budgets.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    const sign = diff > 0 ? 1 : -1;
    for (let i = 0, left = Math.abs(diff); i < headers.length && left > 0; i++) {
      budgets[i] += 10 * sign;
      left -= 10;
    }
  }

  const cleanTail = isZH ? /\s*（約\s*\d+\s*字）\s*$/ : /\s*\(≈\s*\d+\s*words\)\s*$/i;

  headers.forEach((h, idx) => {
    const suffix = isZH ? `（約 ${budgets[idx]} 字）` : ` (≈ ${budgets[idx]} words)`;
    const original = lines[h.idx].replace(cleanTail, '');
    lines[h.idx] = `${original}${suffix}`;
  });

  return lines.join('\n');
}

/* ================== handler ================== */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST' });
  }

  // 暫時註釋掉認證檢查，方便測試
  // const session = await getAuthSession(req, res);
  // if (!session?.user?.id) {
  //   return res.status(401).json({ error: '未登入' });
  // }

  // 使用實際存在的用戶ID
  const testUserId = 'cmepnzayg0000she7snesdczz';

  const {
    title,
    wordCount,
    language,
    tone,
    detail = '',
    reference = '',
    rubric = '',
    paragraph = '',
    paragraphPlan,
    mode = 'gemini-flash',
    regeneratePointId, // 要重新生成的段落ID
    currentOutline, // 當前大綱（用於上下文）
  } = (req.body ?? {}) as Record<string, any>;

  const wc = Number(wordCount);
  if (
    typeof title !== 'string' ||
    typeof language !== 'string' ||
    typeof tone !== 'string' ||
    !Number.isFinite(wc)
  ) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const lang = String(language || '中文');
  const planHint = (() => {
    if (!paragraphPlan) return '';
    const bCount =
      Number(paragraphPlan.bodyCount) ||
      (Array.isArray(paragraphPlan.body) ? paragraphPlan.body.length : 0);
    return `
【段落規劃（硬性要求）】
- 引言：${paragraphPlan.intro ?? '依比例'} 字
- 主體段數：${bCount || '依比例'} 段（依序寫出）
- 主體各段字數：${Array.isArray(paragraphPlan.body) ? paragraphPlan.body.join('、') : '依比例'} 字
- 結論：${paragraphPlan.conclusion ?? '依比例'} 字
`.trim();
  })();

  // 如果是重新生成單個段落
  const isRegeneratingPoint = typeof regeneratePointId === 'number' && currentOutline;
  
  const prompt = isRegeneratingPoint
    ? `
請重新生成第 ${regeneratePointId} 段的大綱內容，**務必**照以下規則：
1. 中文用「一、二、三…」，英文用「1. 2. 3.…」編號。
2. 每節標題獨立一行，後面不加任何符號。
3. 每節下至少 2–4 條「- 主要點」，可視需要在每條主要點下再加 a./b. 子要點（縮排兩空白）。
4. 每個章節最後加 1 行補充說明，開頭寫 **"> 說明："**（提供脈絡與延伸，不要放連結）。
5. 只輸出第 ${regeneratePointId} 段的內容，不要輸出其他段落。

【需求】
題目：${title}
字數：約 ${wc}
語言：${language}（語氣：${tone}）
細節：${detail}
引用：${reference}
評分準則：${rubric}
${planHint ? '\n' + planHint : ''}

【當前完整大綱（僅供參考上下文）】
${currentOutline}

請只輸出第 ${regeneratePointId} 段的完整大綱內容（包括標題、要點和說明），格式與其他段落保持一致。`.trim()
    : `
請產生「段落式大綱」，**務必**照以下規則：
1. 中文用「一、二、三…」，英文用「1. 2. 3.…」編號。
2. 每節標題獨立一行，後面不加任何符號。
3. 每節下至少 2–4 條「- 主要點」，可視需要在每條主要點下再加 a./b. 子要點（縮排兩空白）。
4. 每個章節最後加 1 行補充說明，開頭寫 **"> 說明："**（提供脈絡與延伸，不要放連結）。
5. 不要多餘空行。請盡可能具體而非空話。

【需求】
題目：${title}
字數：約 ${wc}
語言：${language}（語氣：${tone}）
細節：${detail}
引用：${reference}
評分準則：${rubric}
段落要求：${paragraph || '依內容合理規劃'} 段
${planHint ? '\n' + planHint : ''}

【中文輸出範例】
一、 引言
- 介紹人工智慧（AI）的概念
  a. 定義：模擬人類認知的技術
  b. 關鍵能力：學習、推理、感知
- 討論 AI 的重要性
  a. 社會影響：自動化與效率
  b. 經濟影響：創新與競爭
> 說明：本段建立主題背景與重要性，為後文鋪陳。

二、 AI 的核心概念
- 弱 AI vs. 強 AI
  a. 弱 AI：專注任務，如推薦系統
  b. 強 AI：通用智慧，仍在研究
- 機器學習與深度學習
  a. ML：數據驅動模式識別
  b. DL：多層神經網路
> 說明：本段釐清術語與範疇，降低誤解。

請直接輸出大綱內容，不要額外說明。`.trim();


  /* ---- call LLM (with fallback) ---- */
  let outline = '';
  let modelUsed = '';
  try {
    const opt1 = mapMode('outline' as StepName, mode);
    modelUsed = opt1.model;
    outline = await callLLM(
      [{ role: 'user', content: prompt }],
      { ...opt1, title: 'Assignment Terminator', referer: process.env.NEXT_PUBLIC_APP_URL }
    );
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const needFallback =
      /OPENROUTER_HTTP_4\d\d/.test(msg) ||
      /not a valid model id/i.test(msg) ||
      /model.*not.*found/i.test(msg);
    if (!needFallback) {
      console.error('[outline:first-call]', { mode, err: msg });
      return res.status(500).json({ error: 'AI 服務錯誤，請稍後再試' });
    }
    try {
      const opt2 = mapMode('outline' as StepName, 'gpt-3.5');
      modelUsed = opt2.model;
      outline = await callLLM(
        [{ role: 'user', content: prompt }],
        { ...opt2, title: 'Assignment Terminator', referer: process.env.NEXT_PUBLIC_APP_URL }
      );
    } catch (e2: any) {
      console.error('[outline:fallback]', { mode, err: String(e2?.message ?? e2) });
      return res.status(500).json({ error: 'AI 服務錯誤，請稍後再試' });
    }
  }

  /* ---- pipeline: normalize → structure → titles → bodyTitles → clip → sanitize → backfill → enrich → budgets ---- */
  let finalOutline = '';
  
  if (isRegeneratingPoint) {
    // 重新生成單個段落：只處理該段落
    outline = normalizeHeaders(outline, lang);
    outline = outline
      .replace(/(^|\n)([一二三四五六七八九十]+[、]|[IVXLCDMivxlcdm]+\.)\s*/g, '$1$2 ')
      .replace(/(^|\n)([A-Z])\.\s*/g, '$1$2. ')
      .replace(/\n{2,}/g, '\n')
      .trim();
    
    outline = sanitizeAllBullets(outline, lang);
    
    try {
      const optForBackfill = mapMode('outline' as StepName, mode);
      outline = await backfillMissingBullets(
        outline,
        { title, language: lang, tone, detail, reference },
        optForBackfill
      );
    } catch { /* ignore */ }

    try {
      const optForEnrich = mapMode('outline' as StepName, mode);
      outline = await enrichBullets(
        outline,
        { title, language: lang, tone },
        optForEnrich
      );
    } catch { /* ignore */ }

    // 將新段落插入到完整大綱中
    const lines = currentOutline.split('\n');
    const newLines = outline.split('\n');
    
    // 找到要替換的段落範圍
    const pointNum = regeneratePointId;
    const pointPattern = lang === '中文' || lang.includes('中')
      ? new RegExp(`^[${['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][pointNum - 1]}]、`)
      : new RegExp(`^${pointNum}\\.`);
    
    let startIdx = -1;
    let endIdx = lines.length;
    
    // 找到段落開始位置
    for (let i = 0; i < lines.length; i++) {
      if (pointPattern.test(lines[i].trim())) {
        startIdx = i;
        break;
      }
    }
    
    // 找到段落結束位置（下一個段落開始或文件結束）
    if (startIdx >= 0) {
      const nextPointNum = pointNum + 1;
      const nextPointPattern = lang === '中文' || lang.includes('中')
        ? new RegExp(`^[${['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][nextPointNum - 1]}]、`)
        : new RegExp(`^${nextPointNum}\\.`);
      
      for (let i = startIdx + 1; i < lines.length; i++) {
        if (nextPointPattern.test(lines[i].trim())) {
          endIdx = i;
          break;
        }
      }
      
      // 替換段落
      const before = lines.slice(0, startIdx).join('\n');
      const after = lines.slice(endIdx).join('\n');
      finalOutline = [before, outline.trim(), after].filter(Boolean).join('\n\n');
    } else {
      // 如果找不到段落，直接使用新生成的大綱
      finalOutline = outline;
    }
    
    // 重新添加字數預算
    finalOutline = appendWordBudgets(finalOutline, lang, wc, paragraphPlan);
  } else {
    // 正常生成完整大綱
    outline = normalizeHeaders(outline, lang);
    outline = outline
      .replace(/(^|\n)([一二三四五六七八九十]+[、]|[IVXLCDMivxlcdm]+\.)\s*/g, '$1$2 ')
      .replace(/(^|\n)([A-Z])\.\s*/g, '$1$2. ')
      .replace(/\n{2,}/g, '\n')
      .trim();

    const desiredBodyCount =
      Number((req.body as any)?.paragraphPlan?.bodyCount) ||
      (Number.isFinite(parseInt(String(paragraph), 10)) ? parseInt(String(paragraph), 10) : 3);

    outline = ensureMinSections(outline, lang, desiredBodyCount);
    outline = normalizeSectionTitles(outline, lang);
    outline = attachCustomBodyTitles(outline, lang, paragraphPlan); // add 「主體段N：副標」
    outline = clipBodiesTo(outline, lang, desiredBodyCount);
    outline = sanitizeAllBullets(outline, lang);

    try {
      const optForBackfill = mapMode('outline' as StepName, mode);
      outline = await backfillMissingBullets(
        outline,
        { title, language: lang, tone, detail, reference },
        optForBackfill
      );
    } catch { /* ignore */ }

    try {
      const optForEnrich = mapMode('outline' as StepName, mode);
      outline = await enrichBullets(
        outline,
        { title, language: lang, tone },
        optForEnrich
      );
    } catch { /* ignore */ }

    outline = appendWordBudgets(outline, lang, wc, paragraphPlan);
    finalOutline = outline.slice(0, 100_000);
  }

  /* ---- persist ---- */
  try {
    const rec = await prisma.outline.create({
      data: {
        userId: testUserId, // 使用測試用戶ID
        title: String(title).slice(0, 512),
        content: finalOutline,
      },
      select: { id: true },
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('[outline:ok]', { outlineId: rec.id, modelUsed });
    }
    return res.status(200).json({ outline: finalOutline, outlineId: rec.id });
  } catch (dbErr: any) {
    console.error('[outline:db]', { err: String(dbErr?.message ?? dbErr) });
    // 即使数据库保存失败，也返回生成的大纲（只是不保存到数据库）
    // 这样用户仍然可以使用生成的大纲，只是无法持久化
    console.warn('[outline:db-warn] 数据库保存失败，但返回生成的大纲内容');
    return res.status(200).json({ 
      outline: finalOutline, 
      outlineId: undefined,
      warning: '大綱已生成，但無法保存到資料庫。請檢查資料庫連接。'
    });
  }
}
