// /pages/api/draft.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { buildPrompt, validateParagraph, buildRepairPrompt, PRESET_SPECS, ParagraphSpec } from '@/lib/paragraphSpec';

type ResBody = { draft: string; draftZh?: string } | { error: string };

// ✅ 1) 止血版：检测和清理 ciphertext（gAAAAA...）
function looksLikeFernet(s?: string | null): boolean {
  if (!s) return false;
  const t = s.trim();
  return /^gAAAAA[A-Za-z0-9_-]+$/.test(t) && t.length > 80;
}

function stripCiphertextEverywhere(input: string): string {
  if (!input) return input;
  const t = input.trim();
  if (looksLikeFernet(t)) return ''; // 整段就是 ciphertext -> 直接清空
  // 混在文字里 -> 替换掉长 token
  return input.replace(/\bgAAAAA[A-Za-z0-9_-]{60,}\b/g, '[REDACTED_CIPHERTEXT]');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>
) {
  // 确保所有响应都是 JSON
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: '只接受 POST 請求' });

  const session = await getAuthSession(req, res); // 讀取登入者（抓 DB 文獻用）

  const {
    title,
    wordCount,
    language,
    tone,
    detail = '',
    reference = '',
    rubric = '',
    outline,
    outlineId,            // ✅ 新增：用來抓已儲存的參考文獻
    sectionId,            // ✅ 新增：分段生成ID（1=引言，2=主体，3=结论）
    totalSections,        // ✅ 新增：总段落数（用于判断最后一个段落是否为结论）
    sectionRole,          // ✅ 新增：段落角色（'introduction' | 'body' | 'conclusion'）
    spec,                 // ✅ paragraph spec system
    mode = 'free',        // 'gemini' | 'flash' | 'gpt-3.5' | 'free'
  } = (req.body ?? {}) as Record<string, any>;

  // 驗證
  const wc = typeof wordCount === 'number' ? wordCount : parseInt(String(wordCount || ''), 10);
  if (
    typeof title !== 'string' ||
    !Number.isFinite(wc) ||
    typeof language !== 'string' ||
    typeof tone !== 'string' ||
    typeof outline !== 'string' ||
    outline.trim().length === 0
  ) {
    return res.status(400).json({
      error: '缺少必要字段：title, wordCount, language, tone, outline',
    });
  }

  // ✅ Normalize sectionId (frontend often sends string)
  const sectionIdNum = sectionId === undefined || sectionId === null ? null : Number(sectionId);
  const isSectionGeneration = Number.isFinite(sectionIdNum);
  const totalSectionsNum = totalSections ? Number(totalSections) : null;
  
  // ✅ 确定段落角色（优先使用 sectionRole，否则根据 sectionId 和 totalSections 推断）
  const determineSectionRole = (): 'introduction' | 'body' | 'conclusion' | null => {
    if (sectionRole) {
      const role = String(sectionRole).toLowerCase();
      if (role === 'introduction' || role === 'intro') return 'introduction';
      if (role === 'conclusion' || role === 'concl') return 'conclusion';
      if (role === 'body') return 'body';
    }
    
    if (!isSectionGeneration) return null;
    
    // 如果 sectionId === 1，肯定是引言
    if (sectionIdNum === 1) return 'introduction';
    
    // 如果 sectionId === totalSections，且 totalSections > 1，则是结论
    if (Number.isFinite(totalSectionsNum) && totalSectionsNum !== null && totalSectionsNum > 1 && sectionIdNum === totalSectionsNum) {
      return 'conclusion';
    }
    
    // 其他情况都是 body
    return 'body';
  };
  
  const sectionRoleDetermined = determineSectionRole();

  // ✅ 调试辅助函数
  const head = (s: any, n = 80) => String(s ?? '').slice(0, n);
  
  // ✅ 注意：looksLikeFernet 和 stripCiphertextEverywhere 已在文件顶部定义

  // ✅ 禁止结论性语言（用于 body 段落）
  const forbidConclusionOpeners = (text: string): string => {
    if (!text) return text;
    // 移除开头的结论性短语
    return text.replace(/^\s*(In conclusion|To conclude|Overall|In summary|To summarize|In closing|To sum up|In brief|To wrap up)\b[:,]?\s*/i, '');
  };

  // ✅ 只移除明确 meta 废话（供 spec-first & legacy 共用）
  const filterExplanatoryText = (text: string): string => {
    if (!text) return text;
    const patterns = [
      /^\s*✨\s*(已生成內容|generated content)\s*[:：]?\s*/gmi,
      /^⚠️.*$/gmi,
      /無法續寫[^。]*?(未提供|原文|已寫內容)[^。]*[。.!?]?/g,
      /請貼上原文段落[^。]*[。.!?]?/g,
      /若原文一時無法提供[^。]*[。.!?]?/g,
      /本段亦補充[^。]*[。.!?]?/g,
      // 英文常见 meta 前缀（非常保守，只删开头）
      /^\s*(Here is|Here's)\s+(the|an)\s+(paragraph|draft)\s*[:：]\s*/gmi,
      /^\s*(Sure|Of course)\s*[,，:：]\s*/gmi,
    ];
    let cleaned = text;
    for (const pattern of patterns) cleaned = cleaned.replace(pattern, '');

    const lines = cleaned.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !trimmed.match(/^(無法續寫|請貼上|若原文|本段亦補充|✨|⚠️)/i);
    });
    return filteredLines.join('\n').trim();
  };

  // ✅ 保守去引用：只在不允许引用时启用
  const stripDisallowedCitations = (text: string): string => {
    if (!text) return text;

    let s = text;

    // APA-ish in-text citations: (Smith, 2021) / (Smith et al., 2021) / (Sagar Badjate et al., 2024) / (Sagar Badjate, 2024)
    // ✅ 支持"名+姓"格式：最多匹配 2 个名字 + et al.
    s = s.replace(
      /\(\s*[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2}(?:\s+et\s+al\.)?\s*,\s*\d{4}[a-z]?\s*\)/g,
      ''
    );

    // 中文引用：(王小明，2021) / (王小明等，2021)
    s = s.replace(/（\s*[^（）]{1,30}，\s*\d{4}[a-z]?\s*）/g, '');

    // Numeric citations: [1], [2–4]
    s = s.replace(/\[\s*\d+(?:\s*[-–]\s*\d+)?\s*\]/g, '');

    // 清理多余空格与标点
    s = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();

    return s;
  };

  // ✅ spec 标准化：补默认 + 基本校验（避免 NaN / 崩）
  const normalizeSpec = (raw: any, fallback?: Partial<ParagraphSpec>): ParagraphSpec | null => {
    if (!raw || typeof raw !== 'object') return null;
    const merged: any = {
      ...(fallback || {}),
      ...(raw || {}),
    };

    // 关键必填字段：若缺失就不给过（或你也可以选择给默认，但这里建议严一点）
    const requiredKeys: Array<keyof ParagraphSpec> = [
      'targetCount', 'unit', 'tolerancePct', 'oneParagraph', 'paragraphType', 'rhetoricalMove'
    ];
    for (const k of requiredKeys) {
      if (merged[k] === undefined || merged[k] === null) return null;
    }

    // defaults（可选字段）
    merged.allowLineBreaks = merged.allowLineBreaks ?? false;
    merged.allowBullets = merged.allowBullets ?? false;
    merged.allowHeadings = merged.allowHeadings ?? false;
    merged.allowCitations = merged.allowCitations ?? false;
    merged.allowExamples = merged.allowExamples ?? true;

    // ✅ 强制类型归一化（coerce + validate）
    merged.targetCount = Number(merged.targetCount);
    merged.tolerancePct = Number(merged.tolerancePct);

    const toBool = (v: any) => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === 'true') return true;
        if (s === 'false') return false;
        if (s === '1') return true;
        if (s === '0') return false;
      }
      return Boolean(v);
    };
    merged.oneParagraph = toBool(merged.oneParagraph);

    // validate numbers
    if (!Number.isFinite(merged.targetCount) || merged.targetCount <= 0) return null;
    if (!Number.isFinite(merged.tolerancePct) || merged.tolerancePct <= 0 || merged.tolerancePct > 0.5) {
      merged.tolerancePct = 0.1;
    }

    // validate enums
    if (!['zh_chars', 'chars', 'words'].includes(merged.unit)) return null;

    // validate strings
    if (typeof merged.paragraphType !== 'string' || !merged.paragraphType.trim()) return null;
    if (typeof merged.rhetoricalMove !== 'string' || !merged.rhetoricalMove.trim()) return null;

    return merged as ParagraphSpec;
  };

  // 🔥 更严格的语言判断（白名单而非正则猜测）
  const lang = String(language).toLowerCase();
  const isZH = lang === 'zh' || lang.includes('中文') || lang.includes('chinese');
  const isEN = lang === 'en' || lang.includes('english') || lang.includes('英文') || lang.includes('英語');
  
  // ✅ Spec-first: 确定最终使用的 spec
  let finalSpec: ParagraphSpec | null = null;
  
  if (spec && typeof spec === 'object') {
    // 1) 用户直接传 spec（最强）
    // 先暂存，后面会 normalize
    finalSpec = spec as ParagraphSpec;
  } else if (isSectionGeneration) {
    // 2) 用户没传 spec，但传了 sectionId → 根据 sectionRole 自动套 preset（Intro/Body/Conclusion）
    const key =
      sectionRoleDetermined === 'introduction' ? 'introduction'
      : sectionRoleDetermined === 'conclusion' ? 'conclusion'
      : sectionRoleDetermined === 'body' ? (wc < 160 && !isZH ? 'body_single_paragraph' : 'body_general')
      : null;
    
    if (key && PRESET_SPECS[key]) {
      const presetFilled: ParagraphSpec = {
        // ✅ preset base
        ...(PRESET_SPECS[key] as ParagraphSpec),
        // ✅ fill required fields
        targetCount: wc,
        unit: isZH ? 'zh_chars' : 'words',
        tolerancePct: 0.1,
        // ✅ ensure defaults
        allowLineBreaks: PRESET_SPECS[key].allowLineBreaks ?? false,
        allowBullets: PRESET_SPECS[key].allowBullets ?? false,
        allowHeadings: PRESET_SPECS[key].allowHeadings ?? false,
        allowCitations: PRESET_SPECS[key].allowCitations ?? false,
        allowExamples: PRESET_SPECS[key].allowExamples ?? true,
        maxExamples: PRESET_SPECS[key].maxExamples,
      };
      finalSpec = presetFilled;
    }
  }
  // 3) 两个都没有 → 用旧硬编码逻辑（完全向后兼容）

  // ✅ 從 DB 抓此大綱的「已儲存參考文獻」+ 验证状态
  let savedRefs: Array<{
    title: string;
    url: string;
    doi: string | null;
    source: string | null;
    authors: string | null;
    publishedAt: string | null;
    summary: string | null;
    verified: boolean;
  }> = [];

  if (outlineId && session?.user?.id) {
    try {
      const rows = await prisma.reference.findMany({
        where: { outlineId, userId: session.user.id },
        orderBy: { credibility: 'desc' },
        take: 12, // 最多帶 12 筆給模型
        select: { 
          title: true, 
          url: true, 
          doi: true, 
          source: true, 
          authors: true, 
          publishedAt: true,
          summary: true,  // 使用 summary 字段（schema 中存在）
          credibility: true  // 使用 credibility 作为验证指标
        },
      });
      
      // ✅ 1) 先定位：检查 DB 的 reference.summary 是否是加密的
      rows.forEach((r: any, i: number) => {
        const head = (r.summary || '').slice(0, 24);
        console.log(`[ref#${i}] summary head=`, head, 'looksLikeFernet=', looksLikeFernet(r.summary));
      });
      
      // 🔒 Fail-Closed守门机制：只接收有摘要的文献（summary 长度 >= 100 视为已验证）
      // ✅ A1. 在 refs 验证时，把 ciphertext summary 当作「未验证」
      const verifiedRefs = rows.filter((r: any) => {
        if (!r.summary) return false;
        if (looksLikeFernet(r.summary)) {
          console.warn(`[refs] 跳过加密的 summary (ref#${rows.indexOf(r)})`);
          return false; // 🔥 直接视为未验证
        }
        return r.summary.length >= 100;
      });
      
      console.log(`[draft] 总文献数: ${rows.length}, 已验证: ${verifiedRefs.length}`);
      
      if (verifiedRefs.length === 0 && rows.length > 0) {
        console.warn('[draft] ⚠️ 所有文献均未验证，无法生成草稿');
      }
      
      savedRefs = verifiedRefs.map((r: any) => ({
        title: r.title,
        url: r.url,
        doi: r.doi,
        source: r.source,
        authors: r.authors,
        publishedAt: r.publishedAt ? String(r.publishedAt).slice(0, 10) : null,
        summary: r.summary,
        // ✅ 关键：必须同时满足 length >= 100 且 !looksLikeFernet(summary) 才算 verified
        verified: !!(r.summary && r.summary.length >= 100 && !looksLikeFernet(r.summary))
      }));
    } catch (e) {
      // 讀不到就當作沒有，不擋流程
      console.warn('[draft] load refs failed', e);
    }
  }

  // 🔒 Fail-Closed检查：至少需要一篇已验证文献（但不阻止Intro，因为Intro不允许引用）
  const needsVerifiedSources = !!outlineId && (
    (!isSectionGeneration) || (isSectionGeneration && sectionIdNum !== 1)
  );
  
  if (needsVerifiedSources && savedRefs.length === 0) {
    const errorMsg = isZH
      ? "来源未验证：目前无法提供草稿。请确保至少有一篇文献包含完整摘要或正文。"
      : "Source not verified: Draft generation is blocked. Please ensure at least one reference contains a full abstract or body text.";
    
    console.log(`[draft] 🔒 Fail-Closed: 无已验证文献，阻止草稿生成`);
    return res.status(400).json({ error: errorMsg });
  }
  
  // ✅ 调试日志：检查 refLines 和 summary 是否包含加密内容
  console.log('[debug] outline head:', head(outline));
  console.log('[debug] reference head:', head(reference));
  if (savedRefs.length > 0) {
    console.log('[debug] savedRefs[0] summary head:', head(savedRefs[0]?.summary));
    if (savedRefs[0]?.summary && looksLikeFernet(savedRefs[0].summary)) {
      console.error('[debug] ⚠️ 检测到加密的 summary！', savedRefs[0].summary.slice(0, 120));
    }
  }

  // 整理參考文獻清單（提供給模型用；不保證全用）
  // 现在只包含已验证的文献
  const refLines = savedRefs.map((r, i) => {
    const year = r.publishedAt?.slice(0, 4) || 'n.d.';
    const tail = r.doi
      ? `https://doi.org/${r.doi.replace(/^https?:\/\/(doi\.org\/)?/, '')}`
      : r.url || '';
    // ✅ 如果 summary 是加密的，不要包含在 refLines 中
    const summaryHint = r.summary && !looksLikeFernet(r.summary) 
      ? ` [已验证 - 摘要${r.summary.length}字符]` 
      : '';
    return `${i + 1}. ${r.authors || 'Unknown'} (${year}). ${r.title}. ${r.source || ''} ${tail}${summaryHint}`.trim();
  }).join('\n');
  
  // ✅ 调试日志：检查 refLines 头部
  console.log('[debug] refLines head:', head(refLines));

  // 🔥 兜底：默认当英文处理（避免两边都 false 走错分支）
  const outputLang = isZH ? 'zh' : 'en';
  const langLabel = isZH ? 'Chinese' : 'English';
  
  // ✅ 英文引言的统一判定：只要不是中文，就按英文引言处理（与你的 prompt 分支一致）
  const isIntroEN = isSectionGeneration && sectionIdNum === 1 && !isZH;
  
  const apaNote = isZH
    ? '若引用，下文請用 APA7 文內引用格式（例如：（王小明，2021）或（Smith, 2021）），文末加「參考文獻」列表，只列實際引用來源；不得捏造或虛構資訊。'
    : 'When citing, use APA 7 in-text citations (e.g., (Smith, 2021)) and include a final “References” section listing only sources you actually cited. Do not fabricate sources or facts.';

  // 🔥 添加日志确认参数
  console.log('[draft] title=', title, 'sectionId=', sectionId, 'sectionIdNum=', sectionIdNum, 'language=', language, 'wc=', wc, 'isZH=', isZH, 'isEN=', isEN, 'isSectionGeneration=', isSectionGeneration, 'hasSpec=', !!finalSpec);
  
  // ✅ Spec-first 生成流程
  if (finalSpec) {
    // ✅ 统一 normalize（用户 spec 也要补默认/校验）
    const normalized = normalizeSpec(finalSpec);
    if (!normalized) {
      return res.status(400).json({
        error: isZH
          ? 'spec 不完整或非法：请提供 targetCount/unit/tolerancePct/oneParagraph/paragraphType/rhetoricalMove 等必要字段。'
          : 'Invalid spec: missing required fields like targetCount/unit/tolerancePct/oneParagraph/paragraphType/rhetoricalMove.',
      });
    }

    // ✅ 记录归一化前后的对照（排查更快）
    console.log('[spec] normalized', {
      raw: {
        targetCount: (finalSpec as any)?.targetCount,
        tolerancePct: (finalSpec as any)?.tolerancePct,
        oneParagraph: (finalSpec as any)?.oneParagraph,
        unit: (finalSpec as any)?.unit,
        paragraphType: (finalSpec as any)?.paragraphType,
        rhetoricalMove: (finalSpec as any)?.rhetoricalMove,
      },
      normalized: {
        targetCount: normalized.targetCount,
        tolerancePct: normalized.tolerancePct,
        oneParagraph: normalized.oneParagraph,
        unit: normalized.unit,
        paragraphType: normalized.paragraphType,
        rhetoricalMove: normalized.rhetoricalMove,
      },
    });

    // ✅ 不 mutate 原始 spec：复制一份作为本次请求的 effectiveSpec
    const effectiveSpec: ParagraphSpec = { ...normalized };

    // 🔒 citation gating: 如果 spec 允许引用，但没有 verified refs，就强制关闭引用
    const specNeedsSources = !!effectiveSpec.allowCitations;
    const hasSources = !!refLines && refLines.trim().length > 0;
    if (specNeedsSources && !hasSources) {
      effectiveSpec.allowCitations = false;
    }

    // ✅ B) buildPrompt 前：清洗 title/outline/reference/refLines（挡住从前端塞进来的 ciphertext）
    const userPrompt = buildPrompt(
      stripCiphertextEverywhere(title),
      stripCiphertextEverywhere(outline),
      tone,
      language,
      effectiveSpec,
      stripCiphertextEverywhere(refLines),
      stripCiphertextEverywhere(reference)
    );
    const llmOpts = mapMode('draft', mode);
    const systemMessage = isZH
      ? `你是嚴謹的學術寫作助手。只輸出內容本身，不要任何說明或提示。`
      : `You are a rigorous academic writing assistant. Output the writing only, no meta text.`;

    try {
      // ✅ 按 unit 计算长度的 helper（替代 v.metrics.length 做长度决策）
      const measureByUnit = (s: string, unit: ParagraphSpec['unit'], isZH: boolean) => {
        const t = (s || '').trim();
        if (!t) return 0;
        if (unit === 'words') {
          return t.split(/\s+/).filter(Boolean).length;
        }
        if (unit === 'zh_chars') {
          return (t.match(/[\u4e00-\u9fff]/g) || []).length;
        }
        // chars: 统计非空白字符
        return t.replace(/\s/g, '').length;
      };

      // ✅ 统一 sanitize 函数（spec-first 专用）
      const sanitizeSpecOutput = (raw: string) => {
        let t = filterExplanatoryText((raw || '').trim());
        // 如果是 body 段落，禁止结论性语言
        if (effectiveSpec.paragraphType !== 'conclusion') {
          t = forbidConclusionOpeners(t);
        }
        
        // 清理 HTML 标签和 bullet points
        t = t.replace(/<br\s*\/?>/gi, ' ');
        t = t.replace(/\s*•\s*/g, ' ');

        // spec 禁止换行：强制合并为单段落（oneParagraph 时）
        if (effectiveSpec.oneParagraph || effectiveSpec.allowLineBreaks === false) {
          t = t.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        }

        // ✅ 不允许引用 or 没 sources：强制去掉模型硬塞的引用
        if (!effectiveSpec.allowCitations || !hasSources) {
          t = stripDisallowedCitations(t);
        }

        return t.trim();
      };

      // 1) first draft
      let text = (await callLLM(
        [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt },
        ],
        {
          ...llmOpts,
          maxTokens: Math.min(isZH ? Math.ceil(wc * 1.4) : Math.ceil(wc * 2.4), 8000),
          title: process.env.OPENROUTER_TITLE ?? 'Assignment Terminator',
          referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
        }
      ))?.trim() || '';

      // ✅ spec-first 统一清洗
      text = sanitizeSpecOutput(text);
      
      // ✅ C) LLM 输出后：如果模型回的是 ciphertext，直接抛错（最后保险）
      if (looksLikeFernet(text)) {
        throw new Error('MODEL_RETURNED_CIPHERTEXT');
      }

      // 2) validate + repair loop
      let v = validateParagraph(text, effectiveSpec, isZH);
      let attempts = 0;
      while (!v.isValid && attempts < 2) {
        attempts++;
        console.log('[spec] validate', {
          attempt: attempts,
          len: v.metrics.length,
          violations: v.violations,
          preview: text.slice(0, 120),
        });
        
        const repairPrompt = buildRepairPrompt(text, effectiveSpec, v, language);
        const repaired = await callLLM(
          [
            { role: 'system', content: systemMessage },
            { role: 'user', content: repairPrompt },
          ],
          {
            ...llmOpts,
            maxTokens: Math.min(isZH ? Math.ceil(wc * 1.4) : Math.ceil(wc * 2.4), 8000),
            title: 'Paragraph Repair',
            referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
          }
        );
        text = sanitizeSpecOutput((repaired || '').trim());
        v = validateParagraph(text, effectiveSpec, isZH);
      }

      // 3) 最终兜底：若仍不合格，至少保证返回内容（但带日志）
      if (!text || text.length < 10) {
        return res.status(500).json({
          error: isZH
            ? 'AI 未返回有效内容，请更换模型或稍后再试。'
            : 'AI did not return valid content. Please switch model or try again.',
        });
      }

      // 4) length-adjust（expand/shorten）如果 repair 后仍不合格
      const minLen = Math.floor(effectiveSpec.targetCount * (1 - effectiveSpec.tolerancePct));
      const maxLen = Math.ceil(effectiveSpec.targetCount * (1 + effectiveSpec.tolerancePct));
      const measuredLen = measureByUnit(text, effectiveSpec.unit, isZH);

      console.log('[spec] post-repair', {
        attempts,
        measuredLen,
        validatorLen: v.metrics.length,   // ✅ 先保留对照，方便确认 validate 里到底算的是什么
        unit: effectiveSpec.unit,
        range: [minLen, maxLen],
        valid: v.isValid,
        violations: v.violations,
        preview: text.slice(0, 160),
      });

      if (!v.isValid) {
        const needsExpand = measuredLen < minLen;
        const needsShorten = measuredLen > maxLen;

        if (needsExpand || needsShorten) {
          const unitLabel = effectiveSpec.unit === 'zh_chars' ? (isZH ? '字' : 'characters')
            : effectiveSpec.unit === 'chars' ? 'characters'
            : 'words';
          const adjustPrompt = isZH
            ? `${needsExpand ? '扩写' : '压缩'}以下段落，使长度落在 ${minLen}-${maxLen} ${unitLabel}之间。保持为**单段落**，不要添加标题/列表。${
                (!effectiveSpec.allowCitations || !hasSources) ? '不要添加任何引用。' : ''
              }\n\n文本：\n"""${text}"""\n`
            : `${needsExpand ? 'Expand' : 'Shorten'} the paragraph so the length is within ${minLen}-${maxLen} ${unitLabel}. Keep it **one paragraph** only; no headings/bullets. ${
                (!effectiveSpec.allowCitations || !hasSources) ? 'Do NOT add citations.' : ''
              }\n\nText:\n"""${text}"""\n`;

          const adjusted = await callLLM(
            [
              { role: 'system', content: systemMessage },
              { role: 'user', content: adjustPrompt },
            ],
            {
              ...llmOpts,
              maxTokens: Math.min(isZH ? Math.ceil(effectiveSpec.targetCount * 1.6) : Math.ceil(effectiveSpec.targetCount * 2.6), 3000),
              title: needsExpand ? 'Paragraph Expand' : 'Paragraph Shorten',
              referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
            }
          );

          text = sanitizeSpecOutput((adjusted || '').trim());
          v = validateParagraph(text, effectiveSpec, isZH);

          const postAdjustMeasuredLen = measureByUnit(text, effectiveSpec.unit, isZH);
          console.log('[spec] post-adjust', {
            measuredLen: postAdjustMeasuredLen,
            validatorLen: v.metrics.length,
            unit: effectiveSpec.unit,
            range: [minLen, maxLen],
            valid: v.isValid,
            violations: v.violations,
            preview: text.slice(0, 160),
          });
        }
      }

      // ✅ 关键：仍然不合格就不要直接返回，throw 让它 fallback 或报错
      // 同时检查长度是否在范围内（即使 validator 误判为 valid）
      const finalMeasuredLen = measureByUnit(text, effectiveSpec.unit, isZH);
      if (!v.isValid || finalMeasuredLen < minLen || finalMeasuredLen > maxLen) {
        console.warn('[spec] still invalid after adjust, fallback to legacy', {
          finalMeasuredLen,
          validatorLen: v.metrics.length,
          unit: effectiveSpec.unit,
          range: [minLen, maxLen],
          valid: v.isValid,
          violations: v.violations,
        });
        throw new Error('SPEC_INVALID_AFTER_REPAIR');
      }

      // ✅ 成功日志（必须在 return 之前）
      console.log('[spec] success', { 
        valid: v.isValid, 
        length: v.metrics.length, 
        paragraphCount: v.metrics.paragraphCount, 
        violations: v.violations,
        spec: {
          paragraphType: effectiveSpec.paragraphType,
          unit: effectiveSpec.unit,
          targetCount: effectiveSpec.targetCount,
        }
      });
      
      // ✅ 5. 最保险的最后一道闸：API 回传前拦截 ciphertext（spec-first 模式）
      if (looksLikeFernet(text)) {
        console.error('[draft] ciphertext about to return (spec-first)', text.slice(0, 24));
        return res.status(500).json({
          error: isZH
            ? '生成結果異常：偵測到加密字串（ciphertext）。請檢查 reference.summary 解密或 callLLM cache 解密流程。'
            : 'Generation result abnormal: ciphertext detected. Please check reference.summary decryption or callLLM cache decryption flow.',
        });
      }
      
      let draftZh: string | undefined;
      
      // 如果要求同时生成中文版本，且当前是英文版本，则生成中文翻译
      if (generateBoth && !isZH && text) {
        try {
          const systemZh = `你是嚴謹的學術寫作助手。只輸出內容本身，不要任何說明或提示。`;
          const userPromptZh = buildPrompt(
            stripCiphertextEverywhere(title),
            stripCiphertextEverywhere(outline),
            tone,
            '中文',
            effectiveSpec,
            stripCiphertextEverywhere(refLines),
            stripCiphertextEverywhere(reference)
          );
          
          draftZh = await callLLM(
            [
              { role: 'system', content: systemZh },
              { role: 'user', content: userPromptZh },
            ],
            {
              ...llmOpts,
              title: process.env.OPENROUTER_TITLE ?? 'Assignment Terminator',
              referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
            }
          ) || '';
        } catch (err) {
          console.error('[draft zh generation failed]', err);
          // 如果中文生成失败，继续返回英文版本
        }
      }
      
      return res.status(200).json({ 
        draft: text,
        draftZh: draftZh,
      });
    } catch (specError: any) {
      // ✅ 处理 MODEL_RETURNED_CIPHERTEXT 错误
      if (specError?.message === 'MODEL_RETURNED_CIPHERTEXT') {
        console.error('[draft] MODEL_RETURNED_CIPHERTEXT in spec-first mode');
        return res.status(500).json({
          error: isZH
            ? '生成結果異常：偵測到加密字串（ciphertext）。請檢查 reference.summary 解密或 callLLM cache 解密流程。'
            : 'Generation result abnormal: ciphertext detected. Please check reference.summary decryption or callLLM cache decryption flow.',
        });
      }
      console.error('[spec] generation failed:', {
        error: specError?.message,
        spec: finalSpec ? {
          paragraphType: finalSpec.paragraphType,
          unit: finalSpec.unit,
          targetCount: finalSpec.targetCount,
        } : null,
        stack: specError?.stack,
      });
      // Fall through to legacy hardcoded logic
    }
  }

  // Legacy hardcoded prompt logic (fallback when no spec)
  let prompt = '';
  
  if (isSectionGeneration) {
    // 分段生成提示词 - 使用 sectionRole 而不是硬编码的 sectionId
    const sectionName = 
      sectionRoleDetermined === 'introduction' ? '引言'
      : sectionRoleDetermined === 'conclusion' ? '结论'
      : sectionRoleDetermined === 'body' ? '主体'
      : '段落';
    
    const languageInstruction = isZH 
      ? `⚠️ 必須使用${language}撰寫，不得使用其他語言（如英文）！`
      : `⚠️ Must write in ${language}, no other languages allowed!`;
    
    // 引言部分使用特殊的結構化 prompt
    const isIntroduction = sectionIdNum === 1;
    
    // 提取大纲中的 Hook、Background、Thesis 子点（支持多行内容）
    const extractOutlineSubPoints = (outlineText: string): { hook: string[], background: string[], thesis: string[] } => {
      const hook: string[] = [];
      const background: string[] = [];
      const thesis: string[] = [];
      
      const lines = outlineText.split('\n');
      let currentSection: 'hook' | 'background' | 'thesis' | null = null;
      let currentContent: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // 检测新的 section 标签
        if (/^Hook:|^hook:/i.test(trimmed)) {
          // 保存之前 section 的内容
          if (currentSection && currentContent.length > 0) {
            const content = currentContent.join(' ').trim();
            if (content) {
              if (currentSection === 'hook') hook.push(content);
              else if (currentSection === 'background') background.push(content);
              else if (currentSection === 'thesis') thesis.push(content);
            }
          }
          // 开始新的 hook section
          currentSection = 'hook';
          currentContent = [];
          const afterLabel = trimmed.replace(/^Hook:\s*/i, '').replace(/^hook:\s*/i, '').trim();
          if (afterLabel) currentContent.push(afterLabel);
        } else if (/^Background:|^background:/i.test(trimmed)) {
          // 保存之前 section 的内容
          if (currentSection && currentContent.length > 0) {
            const content = currentContent.join(' ').trim();
            if (content) {
              if (currentSection === 'hook') hook.push(content);
              else if (currentSection === 'background') background.push(content);
              else if (currentSection === 'thesis') thesis.push(content);
            }
          }
          // 开始新的 background section
          currentSection = 'background';
          currentContent = [];
          const afterLabel = trimmed.replace(/^Background:\s*/i, '').replace(/^background:\s*/i, '').trim();
          if (afterLabel) currentContent.push(afterLabel);
        } else if (/^Thesis:|^thesis:/i.test(trimmed)) {
          // 保存之前 section 的内容
          if (currentSection && currentContent.length > 0) {
            const content = currentContent.join(' ').trim();
            if (content) {
              if (currentSection === 'hook') hook.push(content);
              else if (currentSection === 'background') background.push(content);
              else if (currentSection === 'thesis') thesis.push(content);
            }
          }
          // 开始新的 thesis section
          currentSection = 'thesis';
          currentContent = [];
          const afterLabel = trimmed.replace(/^Thesis:\s*/i, '').replace(/^thesis:\s*/i, '').trim();
          if (afterLabel) currentContent.push(afterLabel);
        } else if (/^•\s*Hook:/i.test(trimmed)) {
          // 保存之前 section 的内容
          if (currentSection && currentContent.length > 0) {
            const content = currentContent.join(' ').trim();
            if (content) {
              if (currentSection === 'hook') hook.push(content);
              else if (currentSection === 'background') background.push(content);
              else if (currentSection === 'thesis') thesis.push(content);
            }
          }
          currentSection = 'hook';
          currentContent = [];
          const afterLabel = trimmed.replace(/^•\s*Hook:\s*/i, '').trim();
          if (afterLabel) currentContent.push(afterLabel);
        } else if (/^•\s*Background:/i.test(trimmed)) {
          // 保存之前 section 的内容
          if (currentSection && currentContent.length > 0) {
            const content = currentContent.join(' ').trim();
            if (content) {
              if (currentSection === 'hook') hook.push(content);
              else if (currentSection === 'background') background.push(content);
              else if (currentSection === 'thesis') thesis.push(content);
            }
          }
          currentSection = 'background';
          currentContent = [];
          const afterLabel = trimmed.replace(/^•\s*Background:\s*/i, '').trim();
          if (afterLabel) currentContent.push(afterLabel);
        } else if (/^•\s*Thesis:/i.test(trimmed)) {
          // 保存之前 section 的内容
          if (currentSection && currentContent.length > 0) {
            const content = currentContent.join(' ').trim();
            if (content) {
              if (currentSection === 'hook') hook.push(content);
              else if (currentSection === 'background') background.push(content);
              else if (currentSection === 'thesis') thesis.push(content);
            }
          }
          currentSection = 'thesis';
          currentContent = [];
          const afterLabel = trimmed.replace(/^•\s*Thesis:\s*/i, '').trim();
          if (afterLabel) currentContent.push(afterLabel);
        } else if (currentSection && trimmed) {
          // 如果当前在某个 section 中，且这行不是空行也不是新标题，则添加到当前 section
          // 检查是否是新的段落标题（数字开头或中文编号）
          if (/^[\d一二三四五六七八九十]+[\.、]/.test(trimmed) || /^[A-Z][a-z]+:/.test(trimmed)) {
            // 遇到新标题，保存当前 section 并重置
            if (currentContent.length > 0) {
              const content = currentContent.join(' ').trim();
              if (content) {
                if (currentSection === 'hook') hook.push(content);
                else if (currentSection === 'background') background.push(content);
                else if (currentSection === 'thesis') thesis.push(content);
              }
            }
            currentSection = null;
            currentContent = [];
          } else {
            // 继续添加到当前 section
            currentContent.push(trimmed);
          }
        }
      }
      
      // 保存最后一个 section 的内容
      if (currentSection && currentContent.length > 0) {
        const content = currentContent.join(' ').trim();
        if (content) {
          if (currentSection === 'hook') hook.push(content);
          else if (currentSection === 'background') background.push(content);
          else if (currentSection === 'thesis') thesis.push(content);
        }
      }
      
      return { hook, background, thesis };
    };
    
    const subPoints = extractOutlineSubPoints(outline);
    
    if (isIntroduction && (isEN || !isZH)) {
      // 英文引言：一个段落、禁止标签、禁止换行（兜底：非中文默认走英文）
      prompt = `
You are an academic writing assistant.

Write ONE cohesive English introduction paragraph of about ${wc} words.

The outline points below may be Chinese or mixed languages.

You must understand them and incorporate ALL key ideas at a high level, but OUTPUT ENGLISH ONLY.

Required structure (single paragraph, no labels):
- Sentence 1: Hook (engaging but academic; 1 sentence)
- Sentences 2–3: Background (definitions/context; 2–3 sentences)
- Final sentence: Thesis statement (1 sentence; clear scope of the essay)

STRICT RULES:
1) Output ONE paragraph only. No headings, no labels (do NOT write "Hook:", "Background:", "Thesis:").
2) No bullet points, no numbering, no line breaks.
3) Do NOT include "In conclusion" or any concluding phrases.
4) Do NOT add any citations in the introduction.
5) Use smooth transitions so it reads like a natural paragraph, not a list.
6) Do NOT elaborate with detailed examples or mini body sections (e.g., "In healthcare..., In finance...").
7) If you mention sectors, do so only as a short list without explanation.

Topic: ${title}
Tone: ${tone}

Outline:
${outline}

${subPoints.hook.length || subPoints.background.length || subPoints.thesis.length ? `
Outline sub-points (must be covered):

Hook:
${subPoints.hook.map((h, i) => `${i + 1}. ${h}`).join('\n') || '(none)'}

Background:
${subPoints.background.map((b, i) => `${i + 1}. ${b}`).join('\n') || '(none)'}

Thesis:
${subPoints.thesis.map((t, i) => `${i + 1}. ${t}`).join('\n') || '(none)'}
` : ''}

${reference ? `Other requirements:\n${reference}\n` : ''}

${refLines ? `Verified sources are provided for later sections. Do not cite them in the introduction.\n${refLines}` : ''}

Return ONLY the paragraph text.
`.trim();
    } else if (isIntroduction && isZH) {
      // 中文引言：使用 Hook、Background、Thesis 結構
      prompt = `你是一位專業的學術寫作助手。請根據以下要求，**直接撰寫**引言段落的完整內容，約 ${wc} 字。

⚠️ 核心要求：
1. **直接輸出段落內容**，不要解釋如何寫作，不要提供續寫說明
2. **必須達到 ${wc} 字**，不能少於 ${wc} 字
3. **必須使用${language}撰寫**，語氣：${tone}
4. **以段落形式呈現**，不要使用條列符號或編號列表
5. **必須基於以下 Hook、Background、Thesis 的具體要點撰寫**，確保涵蓋所有子點內容
6. **絕對禁止輸出任何說明性文字**

題目：${title}

【引言段落大綱】
${outline}

${subPoints.hook.length > 0 || subPoints.background.length > 0 || subPoints.thesis.length > 0 ? `【大綱子點詳情（必須使用）】
${subPoints.hook.length > 0 ? `Hook 要點：
${subPoints.hook.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n` : ''}${subPoints.background.length > 0 ? `Background 要點：
${subPoints.background.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n` : ''}${subPoints.thesis.length > 0 ? `Thesis 要點：
${subPoints.thesis.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n` : ''}
⚠️ 重要：請根據以上 Hook、Background、Thesis 的具體要點來撰寫引言，必須涵蓋所有子點內容，並將它們自然地整合到段落中。不要只是列舉，要將這些要點轉換成流暢的段落文字。` : ''}

${reference ? `【其他可對齊之參考或要求】\n${reference}\n` : ''}${
refLines ? `【已驗證的資料來源（僅使用以下已驗證文獻）】\n${refLines}\n\n⚠️ 重要提示：
1. 以上所有文獻均已驗證並包含完整摘要或正文
2. 請僅使用提供的已驗證文獻，不得引用未提供的資料來源
3. 禁止虛構作者、年份或DOI
4. 引用時必須使用上述列表中的實際作者姓名和年份
5. 如果沒有提供文獻，則不要添加任何引用\n` : ''
}
寫作要求：
- 內容要有邏輯性和連貫性，專注於引言的主題
- 使用正式的學術寫作語氣
- 內容要詳細、充分，不要簡略
- 引言應包含問題背景、研究意義和論文結構預覽
- ${apaNote}
- 🔒 嚴格規則：只能使用上述【已驗證的資料來源】中提供的文獻。禁止引用未提供的資料或虛構內容。

**請直接輸出這一段的完整內容（約 ${wc} 字），不要包含任何說明、解釋或續寫提示。**`;
    } else {
      prompt = `你是一位專業的學術寫作助手。請根據以下要求，**直接撰寫**第${sectionId}段（${sectionName}）的完整內容，約 ${wc} ${isZH ? '字' : 'words'}。

⚠️ 核心要求：
1. **直接輸出段落內容**，不要解釋如何寫作，不要提供續寫說明
2. **必須達到 ${wc} ${isZH ? '字' : 'words'}**，不能少於 ${wc} ${isZH ? '字' : 'words'}
3. **必須使用${language}撰寫**，語氣：${tone}
${sectionRoleDetermined === 'body' ? '4. **禁止使用結論性語言**：不要使用 "In conclusion"、"To conclude"、"Overall"、"In summary" 等開頭。這是主體段落，不是結論。\n' : ''}${sectionRoleDetermined === 'body' ? '5' : '4'}. **以段落形式呈現**，不要使用條列符號或編號列表
${sectionRoleDetermined === 'body' ? '6' : '5'}. **絕對禁止輸出任何說明性文字**，包括：
   - 「無法續寫，因為未提供『已寫內容』」
   - 「本段亦補充...」
   - 「請貼上原文段落」
   - 「若原文一時無法提供」
   - 「已生成内容」
   - 任何以「⚠️」、「請」、「若」開頭的說明性文字
${sectionRoleDetermined === 'body' ? '7' : '6'}. **只輸出實際的段落內容**，直接開始寫作，不要任何前綴或說明

題目：${title}

【${sectionName}段落大綱】
${outline}

${isIntroduction && (subPoints.hook.length > 0 || subPoints.background.length > 0 || subPoints.thesis.length > 0) ? `【大綱子點詳情（必須使用）】
${subPoints.hook.length > 0 ? `Hook 要點：
${subPoints.hook.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n` : ''}${subPoints.background.length > 0 ? `Background 要點：
${subPoints.background.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n` : ''}${subPoints.thesis.length > 0 ? `Thesis 要點：
${subPoints.thesis.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n` : ''}
⚠️ 重要：請根據以上 Hook、Background、Thesis 的具體要點來撰寫引言，必須涵蓋所有子點內容，並將它們自然地整合到段落中。` : ''}

${reference ? `【其他可對齊之參考或要求】\n${reference}\n` : ''}${
refLines ? `【已驗證的資料來源（僅使用以下已驗證文獻）】\n${refLines}\n\n⚠️ 重要提示：
1. 以上所有文獻均已驗證並包含完整摘要或正文
2. 請僅使用提供的已驗證文獻，不得引用未提供的資料來源
3. 禁止虛構作者、年份或DOI
4. 引用時必須使用上述列表中的實際作者姓名和年份
5. 如果沒有提供文獻，則不要添加任何引用\n` : ''
}
寫作要求：
- 內容要有邏輯性和連貫性，專注於${sectionName}的主題
- 使用正式的學術寫作語氣
- 內容要詳細、充分，不要簡略
- ${sectionIdNum === 1 ? '引言應包含問題背景、研究意義和論文結構預覽' : sectionIdNum === 2 ? '主體應深入分析主題，提供具體例子和數據支撐' : sectionIdNum === 3 ? '結論應總結主要觀點，提出未來展望' : '段落內容要詳細充實'}
- ${apaNote}
- 🔒 嚴格規則：只能使用上述【已驗證的資料來源】中提供的文獻。禁止引用未提供的資料或虛構內容。

**請直接輸出這一段的完整內容（約 ${wc} ${isZH ? '字' : 'words'}），不要包含任何說明、解釋或續寫提示。**`;
    }
  } else {
    // 完整文章生成提示词
    const languageInstruction = isZH 
      ? `⚠️ 必須使用${language}撰寫，不得使用其他語言（如英文）！`
      : `⚠️ Must write in ${language}, no other languages allowed!`;
    
    prompt = `你是一位專業的學術寫作助手。請根據以下大綱與寫作要求，**直接撰寫**一篇約 ${wc} ${isZH ? '字' : 'words'}的完整文章。

⚠️ 核心要求：
1. **直接輸出完整的文章內容**，不要解釋如何寫作，不要提供續寫說明
2. **必須達到 ${wc} ${isZH ? '字' : 'words'}**，不能少於 ${wc} ${isZH ? '字' : 'words'}
3. **必須使用${language}撰寫全文**，語氣：${tone}
4. **以段落形式呈現**，不要使用條列符號或編號列表
5. **絕對禁止輸出任何說明性文字**，包括：
   - 「無法續寫，因為未提供『已寫內容』」
   - 「本段亦補充...」
   - 「請貼上原文段落」
   - 「若原文一時無法提供」
   - 「已生成内容」
   - 任何以「⚠️」、「請」、「若」開頭的說明性文字
6. **只輸出實際的文章內容**，直接開始寫作，不要任何前綴或說明

題目：${title}
${detail ? `細節：${detail}\n` : ''}${rubric ? `評分準則：${rubric}\n` : ''}
【段落大綱】
${outline}

${reference ? `【其他可對齊之參考或要求】\n${reference}\n` : ''}${
refLines ? `【已驗證的資料來源（僅使用以下已驗證文獻）】\n${refLines}\n\n⚠️ 重要提示：
1. 以上所有文獻均已驗證並包含完整摘要或正文
2. 請僅使用提供的已驗證文獻，不得引用未提供的資料來源
3. 禁止虛構作者、年份或DOI
4. 引用時必須使用上述列表中的實際作者姓名和年份
5. 如果沒有提供文獻，則不要添加任何引用\n` : ''
}
寫作規範：
- 結構採「引言 → 主體段落（2–4 段）→ 結論」，以段落呈現
- 內容要有解釋、例子或數據支撐，避免空泛與重複
- **必須達到 ${wc} ${isZH ? '字' : 'words'}的要求**：引言約${Math.ceil(wc * 0.2)}-${Math.ceil(wc * 0.3)}${isZH ? '字' : 'words'}，每個主體段落約${Math.ceil(wc * 0.2)}-${Math.ceil(wc * 0.4)}${isZH ? '字' : 'words'}，結論約${Math.ceil(wc * 0.2)}-${Math.ceil(wc * 0.3)}${isZH ? '字' : 'words'}
- 每個段落都要有充分的內容和詳細的解釋，不要簡略
- ${apaNote}
- 🔒 嚴格規則：只能使用上述【已驗證的資料來源】中提供的文獻。禁止引用未提供的資料或虛構內容

**請直接輸出完整的文章草稿（多段落、連貫過渡），必須達到 ${wc} ${isZH ? '字' : 'words'}，不要包含任何說明、解釋或續寫提示。**`;
  }

  try {
    const llmOpts = mapMode('draft', mode);
    console.log(`[draft] 模型映射结果: mode="${mode}", mappedModel="${llmOpts.model}", maxTokens=${llmOpts.maxTokens}`);
    
    // 精确估算tokens（区分中英文）
    const estimatedOutputTokens = isZH
      ? Math.ceil(wc * 1.2)         // Chinese chars ~ tokens
      : Math.ceil(wc * 2.2);        // English words -> tokens (safe-ish)
    // 保险阈值：绝大多数模型的单次输出极限不会超过8k
    const maxTokens = Math.min(estimatedOutputTokens, 8000);
    
    console.log(`字数要求: ${wc}, 预估tokens: ${estimatedOutputTokens}, 设置max_tokens: ${maxTokens}`);
    
    // 首段生成
    const systemMessage = isZH 
      ? `你是嚴謹的中文學術寫作助手，重視清晰結構與可讀性。

⚠️ 核心規則（必須嚴格遵守）：
1. **直接生成段落內容**，不要解釋如何寫作，不要提供續寫說明或提示
2. 必須使用${language}撰寫全文，禁止使用其他語言
3. 必須達到指定的字數要求，不能少於要求的字數
4. 只能引用用戶提供的已驗證文獻，禁止虛構作者、年份或DOI
5. 如果沒有提供文獻，則不要添加任何引用或參考文獻列表
6. **絕對禁止輸出任何說明性文字**，包括但不限於：
   - 「無法續寫，因為未提供『已寫內容』」
   - 「本段亦補充...」
   - 「請貼上原文段落」
   - 「若原文一時無法提供」
   - 「已生成内容」
   - 任何以「⚠️」、「請」、「若」開頭的說明性文字
7. **只輸出實際的段落內容**，直接開始寫作，不要任何前綴或說明

違反以上任何規則都將被視為嚴重錯誤。你的輸出應該直接是段落內容，沒有任何說明、提示或解釋。`
      : `You are a rigorous academic writing assistant. Write clearly and coherently.

⚠️ Core Rules (Must Strictly Follow):
1. **Generate paragraph content directly**, do not explain how to write or provide continuation instructions
2. Must write in ${language}, no other languages allowed
3. Must meet the specified word count requirement, cannot be less than required
4. Only cite verified references provided by the user, do not fabricate authors, years, or DOIs
5. If no references are provided, do not add any citations or reference list
6. **Absolutely forbidden to output any explanatory text**, including but not limited to:
   - "Cannot continue writing because..."
   - "This section also supplements..."
   - "Please paste the original paragraph"
   - "If the original text is temporarily unavailable"
   - "Generated content"
   - Any explanatory text starting with "⚠️", "Please", "If"
7. **Output only actual paragraph content**, start writing directly without any prefix or explanation

Violating any of these rules will be considered a serious error. Your output should be paragraph content directly, without any explanations, prompts, or instructions.`;
    
    const first = await callLLM(
      [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt },
      ],
      {
        ...llmOpts,
        maxTokens: maxTokens,
        title: process.env.OPENROUTER_TITLE ?? 'Assignment Terminator',
        referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
      }
    );

    // 精确字数计算函数
    function visibleLength(s: string) {
      if (isZH) {
        // 中文：统计汉字数量
        const chineseChars = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
        return chineseChars;
      } else {
        // 英文：统计单词数量
        const words = s.trim().split(/\s+/).filter(w => w.length > 0).length;
        return words;
      }
    }

    // 英文单词计数辅助函数
    function wordCountEN(s: string) {
      return s.trim().split(/\s+/).filter(Boolean).length;
    }

    // 清洗引言输出：移除标签、合并成单段落
    function normalizeIntro(text: string): string {
      if (!text) return text;

      return text
        // 去掉生成标记
        .replace(/^\s*✨\s*已生成內容\s*[:：]?\s*/gmi, "")
        .replace(/^\s*✨\s*generated\s*content\s*[:：]?\s*/gmi, "")
        // 去掉结构标签
        .replace(/^\s*(Hook|Background|Thesis)\s*:\s*/gmi, "")
        // 去掉引言不该出现的结尾/收束句开头
        .replace(/^\s*In conclusion,?\s*/gmi, "")
        // 🔥 强制单段：所有换行 -> 空格
        .replace(/\r?\n+/g, " ")
        // 清理空格/标点
        .replace(/\s{2,}/g, " ")
        .replace(/,\s*,+/g, ", ")
        .replace(/。\s*。+/g, "。")
        .trim();
    }

    let draft = filterExplanatoryText((first || '').trim());
    
    // ✅ C) LLM 输出后：如果模型回的是 ciphertext，直接抛错（最后保险）
    if (looksLikeFernet(draft)) {
      throw new Error('MODEL_RETURNED_CIPHERTEXT');
    }
    // 如果是 body 段落，禁止结论性语言
    if (sectionRoleDetermined === 'body') {
      draft = forbidConclusionOpeners(draft);
    }
    
    // 如果是引言，进行特殊清洗（移除标签、合并成单段落）
    if (isSectionGeneration && sectionIdNum === 1) {
      draft = normalizeIntro(draft);
    }
    
    console.log(`[draft] 首段生成结果: length=${draft.length}, preview=${draft.substring(0, 100)}...`);
    const actualLength = visibleLength(draft);
    console.log(`首段生成完成，当前${isZH ? '字数' : '单词数'}: ${actualLength}/${wc}`);
    
    // 如果首段为空，记录详细错误
    if (!draft || draft.length < 10) {
      console.error(`[draft] 首段生成失败: draft为空或过短`, { 
        draftLength: draft?.length, 
        model: llmOpts.model,
        mode 
      });
    }

    // ⬇️ 不足就自动续写一次（最多2次，避免超时）
    // Intro should not be continued (use expand/shorten instead)
    let retryCount = 0;
    const maxRetries = 2;
    
    while (!isIntroEN && visibleLength(draft) < wc && retryCount < maxRetries) {
      retryCount++;
      const remain = wc - visibleLength(draft) + 100; // 多要一点做结尾缓冲
      
      const continuePrompt = isZH
        ? `以下是已寫內容，請從斷點無縫續寫，直到總長至少達到 ${wc} 字。不要重複已有內容，也不要重新開頭或總結，直接延續主體內容。`
        : `Continue seamlessly from the cutoff until total length reaches at least ${wc} words. Do not repeat or restart; just continue.`

      console.log(`第${retryCount}次续写，还需${remain}字`);

      // 🔥 引言续写 maxTokens 限制（避免模型写太长）
      const contMaxTokens = isIntroEN ? 500 : Math.min(Math.ceil(remain * 1.2), 6000);
      
      const cont = await callLLM(
        [
          { role: 'system', content: isZH
            ? `你是嚴謹的中文學術寫作助手。僅續寫剩餘內容，避免重複與重新開場或總結。

⚠️ 續寫規則：
1. 必須使用${language}撰寫
2. 僅續寫新內容，不要重複已有內容
3. 保持與前文相同的風格和語氣
4. 不要添加未提供的引用資料`
            : `You are a rigorous academic writing assistant. Only continue the text to reach the required length.

⚠️ Continuation Rules:
1. Must write in ${language}
2. Only add new content, do not repeat existing text
3. Maintain the same style and tone as previous text
4. Do not add citations not provided` },
          { role: 'user', content: `${continuePrompt}\n\n【已寫內容】\n${draft}\n\n【續寫要求】\n- 僅續寫新內容\n- 風格保持一致\n- 使用${language}\n- 不得少於剩餘目標${isZH ? '字' : '單詞'}數` },
        ],
        { 
          ...llmOpts, 
          maxTokens: contMaxTokens, 
          title: 'Draft Continue',
          referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
        }
      );
      
      // 🔥 续写内容清洗：如果是引言，立即 normalize（避免多段落）
      let continuation = filterExplanatoryText((cont || '').trim());
      if (isSectionGeneration && sectionIdNum === 1) {
        continuation = normalizeIntro(continuation);
      }
      
      // 🔥 拼接防御：避免空白或重复内容
      if (continuation && continuation.trim().length > 0) {
        // 🔥 引言拼接用空格，不要用换行（避免多段落）
        const separator = (isSectionGeneration && sectionIdNum === 1) ? ' ' : '\n';
        draft = draft.trimEnd() + separator + continuation.trim();
        const currentLength = visibleLength(draft);
        console.log(`续写完成，当前${isZH ? '字数' : '单词数'}: ${currentLength}/${wc}`);
      } else {
        console.log('续写失败，停止尝试');
        break;
      }
    }

    // 🔥 引言最终清洗和长度控制（在续写循环之后、return 之前）
    if (isSectionGeneration && sectionIdNum === 1) {
      draft = normalizeIntro(draft);

      // ✅ 统一范围：150±10 => lower=135 upper=165（如果 wc=150）
      const upper = Math.round(wc * 1.1);
      const lower = Math.round(wc * 0.9);

      // ✅ 英文引言：不足 -> 补写；过长 -> 压缩
      if (isIntroEN) {
        let wcNow = wordCountEN(draft);

        // --- A) 不足：Expand pass ---
        if (wcNow < lower) {
          console.log(`[draft] 引言过短 (${wcNow} words)，触发补写到 ${wc}±10`);

          const expandPrompt = `
Expand the following English introduction to about ${wc} words (acceptable range ${lower}-${upper}).
Keep it ONE paragraph only (no line breaks).
Do NOT add citations.
Do NOT add headings or labels.
Preserve the original meaning and improve coherence with smooth transitions.

Text:

"""${draft}"""

`.trim();

          try {
            const expanded = await callLLM(
              [
                { role: 'system', content: 'You expand text precisely to meet word count and formatting constraints.' },
                { role: 'user', content: expandPrompt },
              ],
              {
                ...llmOpts,
                maxTokens: 600, // 补写够用，避免爆长
                title: 'Expand Introduction',
                referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
              }
            );

            draft = normalizeIntro(filterExplanatoryText((expanded || '').trim()));
            wcNow = wordCountEN(draft);
            console.log(`[draft] 补写后: ${wcNow} words`);
          } catch (expandError: any) {
            console.warn('[draft] 补写失败，使用原始内容:', expandError?.message);
          }
        }

        // --- B) 过长：Shorten pass ---
        wcNow = wordCountEN(draft);
        if (wcNow > upper) {
          console.log(`[draft] 引言过长 (${wcNow} words)，触发压缩到 ${wc}±10`);

          const shortenPrompt = `
Shorten the following English introduction to about ${wc} words (acceptable range ${lower}-${upper}).
Keep ALL key ideas (hook + background + thesis), but remove redundancy.
Return ONE paragraph only (no line breaks). Do not add citations.

Text:

"""${draft}"""

`.trim();

          try {
            const shortened = await callLLM(
              [
                { role: 'system', content: 'You rewrite text precisely to meet word count and formatting constraints.' },
                { role: 'user', content: shortenPrompt },
              ],
              {
                ...llmOpts,
                maxTokens: 600,
                title: 'Shorten Introduction',
                referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
              }
            );

            draft = normalizeIntro(filterExplanatoryText((shortened || '').trim()));
            console.log(`[draft] 压缩后: ${wordCountEN(draft)} words`);
          } catch (shortenError: any) {
            console.warn('[draft] 压缩失败，使用原始内容:', shortenError?.message);
          }
        }
      }

      // ✅ 再 normalize 一次，确保无论 expand/shorten 都是单段落
      draft = normalizeIntro(draft);
    }

    const finalLength = visibleLength(draft);
    console.log(`最终${isZH ? '字数' : '单词数'}: ${finalLength}/${wc}, 续写次数: ${retryCount}`);

    // 验证生成的内容是否有效
    if (!draft || draft.trim().length < 10) {
      const errorMsg = isZH
        ? `AI 模型未返回有效內容（返回长度: ${draft?.length || 0}字符）。可能是模型 "${mode}" 暂时不可用，请尝试切换到其他模型（如 GPT-5）。`
        : `AI model did not return valid content (returned length: ${draft?.length || 0} chars). Model "${mode}" may be temporarily unavailable, please try switching to another model (e.g., GPT-5).`;
      console.error('[draft] 生成的内容无效:', { 
        draftLength: draft?.length, 
        draftPreview: draft?.substring(0, 100),
        model: llmOpts.model,
        mode,
        finalLength,
        retryCount
      });
      return res.status(500).json({ error: errorMsg });
    }

    // ✅ 5. 最保险的最后一道闸：API 回传前拦截 ciphertext（legacy 模式）
    if (looksLikeFernet(draft)) {
      console.error('[draft] ciphertext about to return (legacy)', draft.slice(0, 24));
      return res.status(500).json({
        error: isZH
          ? '生成結果異常：偵測到加密字串（ciphertext）。請檢查 reference.summary 解密或 callLLM cache 解密流程。'
          : 'Generation result abnormal: ciphertext detected. Please check reference.summary decryption or callLLM cache decryption flow.',
      });
    }

    return res.status(200).json({ draft });
  } catch (err: any) {
    // ✅ 处理 MODEL_RETURNED_CIPHERTEXT 错误
    if (err?.message === 'MODEL_RETURNED_CIPHERTEXT') {
      console.error('[draft] MODEL_RETURNED_CIPHERTEXT in legacy mode');
      return res.status(500).json({
        error: isZH
          ? '生成結果異常：偵測到加密字串（ciphertext）。請檢查 reference.summary 解密或 callLLM cache 解密流程。'
          : 'Generation result abnormal: ciphertext detected. Please check reference.summary decryption or callLLM cache decryption flow.',
      });
    }
    const msg = String(err?.message ?? '');
    // 🔥 使用外层 isZH，不要重新声明（避免覆盖逻辑）
    
    // 检查是否是模型相关的错误
    if (msg.startsWith('OPENROUTER_HTTP_')) {
      // 解析错误信息，检查是否是无效模型 ID
      const errorMatch = msg.match(/OPENROUTER_HTTP_(\d+):\s*(.+)/);
      const statusCode = errorMatch?.[1];
      const errorBody = errorMatch?.[2] || '';
      
      // 检查是否是无效模型 ID (400 错误通常表示模型无效)
      if (statusCode === '400' && (errorBody.includes('not a valid model') || errorBody.includes('invalid model'))) {
        const errorMsg = isZH
          ? `❌ 模型錯誤：選定的 AI 模型 "${mode}" 無效或不可用。請嘗試選擇其他模型（如 GPT-5 或 Claude Sonnet 4.5）。`
          : `❌ Model Error: The selected AI model "${mode}" is invalid or unavailable. Please try a different model (e.g., GPT-5 or Claude Sonnet 4.5).`;
        
        console.error('[draft] Invalid model:', { mode, errorBody: errorBody.slice(0, 200) });
        return res.status(400).json({ error: errorMsg });
      }
      
      // 其他 HTTP 错误，尝试降级到 GPT-3.5
      try {
        console.log(`[draft] Primary model failed, falling back to GPT-3.5...`);
        const draft2 = await callLLM(
          [
            { role: 'system', content: isZH ? '你是嚴謹的中文學術寫作助手，重視清晰結構與可讀性。' : 'You are a rigorous academic writing assistant. Write clearly and coherently.' },
            { role: 'user', content: prompt },
          ],
          {
            model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-4o-mini', // Fallback 改用更可靠的模型
            temperature: 0.7,
            timeoutMs: 45_000,
            title: 'Draft Fallback',
            referer: process.env.NEXT_PUBLIC_APP_URL,
          }
        );
        if (!draft2 || draft2.trim().length < 10) {
          const errorMsg = isZH
            ? '降级模型也未返回有效內容。請檢查網絡連接或嘗試更換其他模型。'
            : 'Fallback model also did not return valid content. Please check your network connection or try a different model.';
          return res.status(500).json({ error: errorMsg });
        }
        // ✅ 5. 最保险的最后一道闸：API 回传前拦截 ciphertext
        if (looksLikeFernet(draft2)) {
          console.error('[draft] ciphertext about to return (fallback)', draft2.slice(0, 24));
          return res.status(500).json({
            error: isZH
              ? '生成結果異常：偵測到加密字串（ciphertext）。請檢查 reference.summary 解密或 callLLM cache 解密流程。'
              : 'Generation result abnormal: ciphertext detected. Please check reference.summary decryption or callLLM cache decryption flow.',
          });
        }
        
        let draft2Zh: string | undefined;
        
        // 如果要求同时生成中文版本，且当前是英文版本，则生成中文翻译
        if (generateBoth && !isZH && draft2) {
          try {
            const translateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/translate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: draft2,
                targetLang: 'zh',
              }),
            });
            
            if (translateResponse.ok) {
              const translateData = await translateResponse.json();
              draft2Zh = translateData.translated || '';
            }
          } catch (err) {
            console.error('[draft2 zh generation failed]', err);
          }
        }
        
        return res.status(200).json({ 
          draft: draft2,
          draftZh: draft2Zh,
        });
      } catch (fallbackError: any) {
        const errorMsg = isZH
          ? `❌ AI 模型錯誤：無法使用選定的模型 "${mode}"。請檢查模型是否可用，或嘗試更換其他模型。`
          : `❌ AI Model Error: Cannot use selected model "${mode}". Please check if the model is available or try a different one.`;
        
        console.error('[draft] Both primary and fallback failed:', { mode, error: fallbackError?.message });
        return res.status(500).json({ error: errorMsg });
      }
    }
    
    console.error('[draft raw error]', err);

    if (msg.startsWith('OPENROUTER_JSON_PARSE_ERROR')) {
      const errorMsg = isZH
        ? 'AI 回傳格式解析失敗，可能是模型回傳了非標準格式。請稍後再試或更換模型。'
        : 'Failed to parse AI response. The model may have returned a non-standard format. Try again or switch models.';
      return res.status(500).json({ error: errorMsg });
    }

    if (msg.startsWith('OPENROUTER_EMPTY_CONTENT')) {
      const errorMsg = isZH
        ? 'AI 回傳內容為空（0 字），請稍後再試或更換模型。'
        : 'AI returned empty content (0 chars). Please try again or switch models.';
      return res.status(500).json({ error: errorMsg });
    }

    console.error('[draft]', { mode, err: msg });
    return res.status(500).json({ 
      error: isZH 
        ? `AI 回傳失敗，請稍後再試。錯誤：${msg.slice(0, 100)}`
        : `AI request failed, please try again later. Error: ${msg.slice(0, 100)}`
    });
  }
  } catch (unexpectedError: any) {
    // 捕获所有未预期的错误（外层 catch），确保返回 JSON
    console.error('[draft] 未预期的错误:', unexpectedError);
    // 🔥 外层 catch 无法访问内层 isZH，使用兜底判断
    const fallbackIsZH = /中|中文|zh/i.test(String(req.body?.language || ''));
    return res.status(500).json({
      error: fallbackIsZH
        ? `服务器内部错误：${unexpectedError?.message || '未知错误'}。请检查服务器日志。`
        : `Internal server error: ${unexpectedError?.message || 'Unknown error'}. Please check server logs.`
    });
  }
}
