// lib/paragraphSpec.ts
// 通用段落规格系统：可配置的段落生成规则

export type ParagraphSpec = {
  // 字数要求
  targetCount: number;
  unit: 'zh_chars' | 'chars' | 'words';
  tolerancePct: number; // 0.1 = ±10%

  // 格式要求
  oneParagraph: boolean;
  allowLineBreaks?: boolean;
  allowBullets?: boolean;
  allowHeadings?: boolean;

  // 段落类型和修辞动作
  paragraphType: string; // e.g., "introduction", "term_clarification", "literature_review", "argument", "counter_argument", "method", "discussion", "conclusion"
  rhetoricalMove: string; // e.g., "define", "explain", "compare", "analyze", "evaluate", "argue", "synthesize"

  // 内容约束
  mustInclude?: string[]; // tokens/phrases that must appear
  allowedTopics?: string[]; // tags or phrases (only discuss these)
  bannedTopics?: string[]; // tokens/phrases (do NOT discuss these)
  bannedPatterns?: string[]; // regex strings to match against

  // 引用和例子
  allowCitations?: boolean;
  allowExamples?: boolean;
  maxExamples?: number; // limit number of examples

  // 其他约束
  bannedPhrases?: string[]; // specific phrases to avoid (e.g., "In conclusion")
};

export type ValidationResult = {
  isValid: boolean;
  violations: string[];
  metrics: {
    length: number;
    paragraphCount: number;
    hasBannedTopics: boolean;
    hasBannedPatterns: boolean;
    missingMustInclude: string[];
  };
};

/**
 * 根据规格构建 prompt
 */
export function buildPrompt(
  title: string,
  outline: string,
  tone: string,
  language: string,
  spec: ParagraphSpec,
  refLines?: string,
  reference?: string
): string {
  const rangeLow = Math.round(spec.targetCount * (1 - spec.tolerancePct));
  const rangeHigh = Math.round(spec.targetCount * (1 + spec.tolerancePct));
  const isZH = /中|中文|zh/i.test(language);

  const unitLabel = spec.unit === 'zh_chars' ? (isZH ? '字' : 'characters') 
    : spec.unit === 'chars' ? 'characters' 
    : 'words';

  const formatRules: string[] = [];
  if (spec.oneParagraph) {
    formatRules.push(spec.allowLineBreaks ? 'ONE paragraph only.' : 'ONE paragraph only. No line breaks.');
  } else {
    formatRules.push('Multiple paragraphs allowed.');
    if (!spec.allowLineBreaks) {
      formatRules.push('Line breaks allowed only between paragraphs (blank lines), not inside paragraphs.');
    }
  }
  if (!spec.allowBullets) {
    formatRules.push('No bullet points or numbered lists.');
  }
  if (!spec.allowHeadings) {
    formatRules.push('No headings or subheadings.');
  }

  const contentConstraints: string[] = [];
  if (spec.mustInclude?.length) {
    contentConstraints.push(`Must include: ${spec.mustInclude.join(', ')}`);
  }
  if (spec.allowedTopics?.length) {
    contentConstraints.push(`Only discuss: ${spec.allowedTopics.join(', ')}`);
  }
  if (spec.bannedTopics?.length) {
    contentConstraints.push(`Do NOT discuss: ${spec.bannedTopics.join(', ')}`);
  }
  if (spec.bannedPhrases?.length) {
    contentConstraints.push(`Do NOT use phrases: ${spec.bannedPhrases.join(', ')}`);
  }

  const citationRule = spec.allowCitations
    ? 'Citations allowed only if provided sources exist.'
    : 'No citations.';

  const exampleRule = spec.allowExamples
    ? spec.maxExamples
      ? `Examples allowed (max ${spec.maxExamples}).`
      : 'Examples allowed.'
    : 'Do not add new examples unless explicitly provided.';

  // Intro gap requirement (CARS Move 2)
  const introGapRule = spec.paragraphType === 'introduction'
    ? (isZH
        ? '⚠️ 必须明确提出研究缺口/不足（例如「然而，目前研究仍…」「现有讨论多聚焦…但…仍不足」）。'
        : 'CRITICAL: You MUST state an explicit gap/limitation/tension (e.g., "however, little research…", "existing studies focus on X, but Y remains…").'
      )
    : '';

  // Body claim-evidence-analysis requirement
  const bodyCEARule = (spec.paragraphType === 'body' || spec.paragraphType === 'body_paragraph' || spec.paragraphType === 'argument' || spec.paragraphType === 'discussion')
    ? (isZH
        ? '每个段落必须包含：主题句（claim）→ 证据（evidence）→ 分析（analysis）→ 过渡。'
        : 'Each paragraph MUST follow: topic sentence (claim) → evidence → analysis → transition.'
      )
    : '';

  // 针对术语澄清段落的特殊约束
  const isTermClarification = spec.paragraphType === 'term_clarification';
  const termClarificationWarning = isTermClarification
    ? (isZH
      ? `\n⚠️ 重要：這是「術語澄清」段落，你必須：
- **只澄清和定義術語**，不要討論應用、影響、倫理、政策等
- **不要展開討論**這些術語的社會意義、經濟影響或未來發展
- **只解釋術語本身**：定義、範疇、區別、基本概念
- **不要寫成主體段落**，不要討論實例的深層含義或廣泛影響\n`
      : `\n⚠️ CRITICAL: This is a "term clarification" paragraph. You MUST:
- **ONLY clarify and define terms**, do NOT discuss applications, implications, ethics, policies, etc.
- **Do NOT elaborate** on societal significance, economic impact, or future developments
- **ONLY explain the terms themselves**: definitions, scope, distinctions, basic concepts
- **Do NOT write as a body paragraph**, do NOT discuss deep meanings or broad implications of examples\n`)
    : '';

  const prompt = isZH
    ? `你是一位專業的學術寫作助手。請根據以下要求，**直接撰寫**段落內容。

⚠️ 核心要求：
1. **直接輸出段落內容**，不要解釋如何寫作，不要提供續寫說明
2. **必須達到 ${spec.targetCount} ${unitLabel}**（可接受範圍：${rangeLow}-${rangeHigh}）
3. **必須使用${language}撰寫**，語氣：${tone}
4. **格式要求**：${formatRules.join(' ')}
5. **絕對禁止輸出任何說明性文字**
${introGapRule ? `${introGapRule}\n` : ''}${bodyCEARule ? `${bodyCEARule}\n` : ''}${termClarificationWarning}
題目：${title}

【段落類型】${spec.paragraphType}
【修辭動作】${spec.rhetoricalMove}

【段落大綱】
${outline}

${contentConstraints.length ? `【內容約束】
${contentConstraints.map(c => `- ${c}`).join('\n')}\n` : ''}

${reference ? `【其他可對齊之參考或要求】\n${reference}\n` : ''}

${refLines ? `【已驗證的資料來源（僅使用以下已驗證文獻）】\n${refLines}\n\n⚠️ 重要提示：
1. 以上所有文獻均已驗證並包含完整摘要或正文
2. 請僅使用提供的已驗證文獻，不得引用未提供的資料來源
3. 禁止虛構作者、年份或DOI
4. 引用時必須使用上述列表中的實際作者姓名和年份
5. 如果沒有提供文獻，則不要添加任何引用\n` : ''}

寫作要求：
- ${citationRule}
- ${exampleRule}
- 內容要有邏輯性和連貫性
- 使用正式的學術寫作語氣

**請直接輸出這一段的完整內容（約 ${spec.targetCount} ${unitLabel}），不要包含任何說明、解釋或續寫提示。**`
    : `You are an academic writing assistant.

Task: Write a ${spec.paragraphType} paragraph.
Rhetorical move: ${spec.rhetoricalMove}.

Topic: ${title}
Tone: ${tone}
Language: ${language}
${termClarificationWarning}
HARD CONSTRAINTS:
- ${formatRules.join('\n- ')}
- Length: ${spec.targetCount} ${unitLabel} (acceptable range ${rangeLow}-${rangeHigh}).
- ${citationRule}
- ${exampleRule}
${introGapRule ? `- ${introGapRule}\n` : ''}${bodyCEARule ? `- ${bodyCEARule}\n` : ''}

${contentConstraints.length ? `CONTENT CONSTRAINTS:\n${contentConstraints.map(c => `- ${c}`).join('\n')}\n` : ''}

Outline notes (incorporate, but do not copy as a list):
${outline}

${reference ? `Other requirements:\n${reference}\n` : ''}

${refLines ? `Verified sources (use only if provided):\n${refLines}\n\n⚠️ Important:
1. All sources above are verified and contain full abstracts or body text
2. Use only the verified sources provided, do not cite sources not in the list
3. Do not fabricate authors, years, or DOIs
4. When citing, use actual author names and years from the list above
5. If no sources are provided, do not add any citations\n` : ''}

Return ONLY the paragraph text.`;

  return prompt.trim();
}

/**
 * 验证段落是否符合规格
 */
export function validateParagraph(text: string, spec: ParagraphSpec, isZH: boolean): ValidationResult {
  const violations: string[] = [];
  const missingMustInclude: string[] = [];

  // 计算长度（严格按 unit，不要用 isZH 分支影响 chars/words）
  const trimmed = (text || '').trim();

  let length = 0;
  if (spec.unit === 'words') {
    length = trimmed.split(/\s+/).filter(Boolean).length;
  } else if (spec.unit === 'zh_chars') {
    length = (trimmed.match(/[\u4e00-\u9fff]/g) || []).length;
  } else {
    // chars: 统计非空白字符（避免英文 text.length 因空格虚高）
    length = trimmed.replace(/\s/g, '').length;
  }

  // ✅ 长度对照日志（便于排查）
  const debugWords = trimmed.split(/\s+/).filter(Boolean).length;
  const debugCharsNoSpace = trimmed.replace(/\s/g, '').length;
  console.log('[paragraphSpec] length', {
    unit: spec.unit,
    targetCount: spec.targetCount,
    tolerancePct: spec.tolerancePct,
    measured: length,
    debugWords,
    debugCharsNoSpace,
    preview: trimmed.slice(0, 120),
  });

  const rangeLow = Math.round(spec.targetCount * (1 - spec.tolerancePct));
  const rangeHigh = Math.round(spec.targetCount * (1 + spec.tolerancePct));

  if (length < rangeLow) {
    violations.push(`Length too short: ${length} (minimum: ${rangeLow})`);
  }
  if (length > rangeHigh) {
    violations.push(`Length too long: ${length} (maximum: ${rangeHigh})`);
  }

  // 检查段落数（使用空白行作为段落分隔符，更可靠）
  const paragraphs = text.trim().split(/\n{2,}/).filter(Boolean);
  const paragraphCount = paragraphs.length || 1;
  
  if (spec.oneParagraph && paragraphCount > 1) {
    violations.push(`Multiple paragraphs detected: ${paragraphCount} (required: 1)`);
  }

  // 检查换行
  if (!spec.allowLineBreaks) {
    if (spec.oneParagraph) {
      // oneParagraph means: no line breaks at all
      if (text.includes('\n')) {
        violations.push('Line breaks detected (oneParagraph requires no line breaks)');
      }
    } else {
      // multi-paragraph allowed: allow blank lines between paragraphs, forbid single newlines inside paragraphs
      const hasInternalBreaks = paragraphs.some(p => p.includes('\n'));
      if (hasInternalBreaks) {
        violations.push('Line breaks detected within paragraphs');
      }
    }
  }

  // 检查条列符号
  if (!spec.allowBullets) {
    if (text.match(/^[\s]*[•\-\*\+]\s/m) || text.match(/^[\s]*\d+[\.\)]\s/m)) {
      violations.push('Bullet points or numbered lists detected');
    }
  }

  // 检查标题
  if (!spec.allowHeadings) {
    if (text.match(/^#+\s/m) || text.match(/^[A-Z][^.!?]*:\s*$/m)) {
      violations.push('Headings detected');
    }
  }

  // 检查 mustInclude
  if (spec.mustInclude?.length) {
    const lowerText = text.toLowerCase();
    for (const item of spec.mustInclude) {
      if (!lowerText.includes(item.toLowerCase())) {
        missingMustInclude.push(item);
      }
    }
    if (missingMustInclude.length > 0) {
      violations.push(`Missing required content: ${missingMustInclude.join(', ')}`);
    }
  }

  // 检查 bannedTopics
  let hasBannedTopics = false;
  if (spec.bannedTopics?.length) {
    const lowerText = text.toLowerCase();
    for (const topic of spec.bannedTopics) {
      if (lowerText.includes(topic.toLowerCase())) {
        hasBannedTopics = true;
        violations.push(`Banned topic detected: ${topic}`);
        break;
      }
    }
  }

  // 检查 bannedPatterns
  let hasBannedPatterns = false;
  if (spec.bannedPatterns?.length) {
    for (const pattern of spec.bannedPatterns) {
      try {
        const regex = new RegExp(pattern, 'im'); // Add multiline flag
        if (regex.test(text)) {
          hasBannedPatterns = true;
          violations.push(`Banned pattern detected: ${pattern}`);
          break;
        }
      } catch (e) {
        console.warn(`[paragraphSpec] Invalid regex pattern: ${pattern}`, e);
      }
    }
  }

  // 检查 bannedPhrases
  if (spec.bannedPhrases?.length) {
    const lowerText = text.toLowerCase();
    for (const phrase of spec.bannedPhrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        violations.push(`Banned phrase detected: ${phrase}`);
        break;
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    metrics: {
      length,
      paragraphCount,
      hasBannedTopics,
      hasBannedPatterns,
      missingMustInclude,
    },
  };
}

/**
 * 构建修复 prompt
 */
export function buildRepairPrompt(
  originalText: string,
  spec: ParagraphSpec,
  validationResult: ValidationResult,
  language: string
): string {
  const isZH = /中|中文|zh/i.test(language);
  const rangeLow = Math.round(spec.targetCount * (1 - spec.tolerancePct));
  const rangeHigh = Math.round(spec.targetCount * (1 + spec.tolerancePct));
  const unitLabel = spec.unit === 'zh_chars' ? (isZH ? '字' : 'characters')
    : spec.unit === 'chars' ? 'characters'
    : 'words';

  const violationsList = validationResult.violations.join('\n- ');
  
  // 检查是否有多个段落需要合并
  const hasMultipleParagraphs = validationResult.violations.some(v => v.includes('Multiple paragraphs'));
  const hasBannedTopics = validationResult.violations.some(v => v.includes('Banned topic detected'));
  
  // 针对术语澄清的特殊修复指令
  const isTermClarification = spec.paragraphType === 'term_clarification';
  const termClarificationRepair = isTermClarification
    ? (isZH
      ? `\n⚠️ 重要修复要求：
- **必须合并成单一段落**：将所有段落内容合并，使用过渡词（如"此外"、"同时"、"另外"）连接
- **移除禁止内容**：删除所有关于伦理、社会影响、经济影响、劳动力市场、政策等主体段落的内容
- **只保留术语定义**：只保留术语的定义、范畴、区别、基本概念
- **保持结构清晰**：使用清晰的逻辑顺序（如：定义 → 分类 → 特点 → 例子）
- **承上启下**：确保句子之间流畅过渡，使用适当的连接词\n`
      : `\n⚠️ CRITICAL REPAIR REQUIREMENTS:
- **MUST merge into ONE paragraph**: Combine all paragraph content using transition words (e.g., "Furthermore", "Additionally", "Moreover", "In addition")
- **REMOVE banned content**: Delete all content about ethics, societal impact, economic impact, labor market, policies, etc.
- **KEEP only term definitions**: Keep only definitions, scope, distinctions, and basic concepts of terms
- **Maintain clear structure**: Use clear logical order (e.g., definition → classification → characteristics → examples)
- **Smooth transitions**: Ensure smooth transitions between sentences using appropriate connectors\n`)
    : '';

  const mergeInstruction = hasMultipleParagraphs
    ? (isZH
      ? `\n⚠️ 必须合并段落：
- 将所有段落合并成一个连续段落
- 使用过渡词连接各部分（如"此外"、"同时"、"另外"、"进一步"）
- 删除所有段落间的空行和换行
- 确保内容流畅连贯，结构清晰\n`
      : `\n⚠️ MUST merge paragraphs:
- Combine all paragraphs into ONE continuous paragraph
- Use transition words to connect parts (e.g., "Furthermore", "Additionally", "Moreover", "In addition")
- Remove all blank lines and line breaks between paragraphs
- Ensure smooth flow and clear structure\n`)
    : '';

  const removeBannedInstruction = hasBannedTopics
    ? (isZH
      ? `\n⚠️ 必须移除禁止内容：
- 删除所有关于${spec.bannedTopics?.slice(0, 3).join('、')}等主题的内容
- 只保留术语定义和基本概念
- 不要讨论应用、影响、意义等\n`
      : `\n⚠️ MUST remove banned content:
- Delete all content about ${spec.bannedTopics?.slice(0, 3).join(', ')} and similar topics
- Keep only term definitions and basic concepts
- Do NOT discuss applications, implications, or significance\n`)
    : '';

  return isZH
    ? `請修正以下段落，使其符合所有要求，但不要改變核心意思。

【當前段落】
"""${originalText}"""

【違規項目】
- ${violationsList}
${termClarificationRepair}${mergeInstruction}${removeBannedInstruction}
【要求】
- 長度：${spec.targetCount} ${unitLabel}（可接受範圍：${rangeLow}-${rangeHigh}）
- ${spec.oneParagraph ? '必須是單一段落，無換行，無空行' : '可以是多段落'}
- ${spec.allowCitations ? '可以引用提供的文獻' : '不要添加引用'}
- ${spec.allowExamples ? '可以包含例子（最多' + (spec.maxExamples || 2) + '个）' : '不要添加新例子'}
- 結構清晰，承上啟下，使用適當的過渡詞

請直接輸出修正後的段落，不要包含任何說明。`
    : `Please fix the following paragraph to meet all requirements without changing the core meaning.

Current paragraph:
"""${originalText}"""

Violations:
- ${violationsList}
${termClarificationRepair}${mergeInstruction}${removeBannedInstruction}
Requirements:
- Length: ${spec.targetCount} ${unitLabel} (acceptable range ${rangeLow}-${rangeHigh})
- ${spec.oneParagraph ? 'Must be ONE paragraph, no line breaks, no blank lines' : 'Multiple paragraphs allowed'}
- ${spec.allowCitations ? 'Citations allowed if sources provided' : 'Do not add citations'}
- ${spec.allowExamples ? 'Examples allowed (max ' + (spec.maxExamples || 2) + ')' : 'Do not add new examples'}
- Clear structure with smooth transitions using appropriate connectors

Return ONLY the corrected paragraph text, no explanations.`;
}

/**
 * 预设规格模板
 */
export const PRESET_SPECS: Record<string, Partial<ParagraphSpec>> = {
  introduction: {
    paragraphType: 'introduction',
    rhetoricalMove: 'cars_territory_gap_aim', // CARS model: territory → gap → aim
    oneParagraph: true,
    allowLineBreaks: false,
    allowBullets: false,
    allowHeadings: false,
    allowCitations: false,
    allowExamples: false,
    bannedPhrases: ['In conclusion', 'In summary', 'To conclude'],
  },
  body_general: {
    paragraphType: 'body',
    rhetoricalMove: 'claim_evidence_analysis',
    oneParagraph: false,
    allowLineBreaks: true,
    allowBullets: false,
    allowHeadings: false,
    allowCitations: true,
    allowExamples: true,
    maxExamples: 3,
    bannedPhrases: ['In conclusion', 'In summary', 'To conclude'],
  },
  body_single_paragraph: {
    paragraphType: 'body_paragraph',
    rhetoricalMove: 'claim_evidence_analysis',
    oneParagraph: true,
    allowLineBreaks: false,
    allowBullets: false,
    allowHeadings: false,
    allowCitations: true,
    allowExamples: true,
    maxExamples: 2,
    bannedPhrases: ['In conclusion', 'In summary', 'To conclude'],
  },
  term_clarification: {
    paragraphType: 'term_clarification',
    rhetoricalMove: 'define_explain',
    oneParagraph: true,
    allowLineBreaks: false,
    allowBullets: false,
    allowHeadings: false,
    allowCitations: false,
    allowExamples: true,
    maxExamples: 2, // 限制例子数量
    bannedTopics: [
      'industry applications',
      'policy implications',
      'future work',
      'conclusion phrases',
      'ethical considerations',
      'ethics',
      'labor market',
      'job displacement',
      'automation',
      'societal impact',
      'social implications',
      'economic impact',
      'privacy',
      'accountability',
      'bias',
      'discrimination',
      'transparency',
      'guidelines',
      'regulations',
    ],
    bannedPatterns: ['^In conclusion', '\\n\\n', '^•', '^-\\s', 'Moreover,', 'Furthermore,', '^The implications'],
  },
  literature_review: {
    paragraphType: 'literature_review',
    rhetoricalMove: 'synthesize',
    oneParagraph: false,
    allowLineBreaks: true,
    allowBullets: false,
    allowHeadings: false,
    allowCitations: true,
    allowExamples: false,
  },
  argument: {
    paragraphType: 'argument',
    rhetoricalMove: 'argue',
    oneParagraph: true,
    allowLineBreaks: false,
    allowBullets: false,
    allowHeadings: false,
    allowCitations: true,
    allowExamples: true,
    maxExamples: 2,
  },
  counter_argument: {
    paragraphType: 'counter_argument',
    rhetoricalMove: 'evaluate',
    oneParagraph: true,
    allowLineBreaks: false,
    allowBullets: false,
    allowHeadings: false,
    allowCitations: true,
    allowExamples: true,
  },
  method: {
    paragraphType: 'method',
    rhetoricalMove: 'explain',
    oneParagraph: false,
    allowLineBreaks: true,
    allowBullets: false,
    allowHeadings: false,
    allowCitations: true,
    allowExamples: false,
  },
  discussion: {
    paragraphType: 'discussion',
    rhetoricalMove: 'analyze',
    oneParagraph: false,
    allowLineBreaks: true,
    allowBullets: false,
    allowHeadings: false,
    allowCitations: true,
    allowExamples: true,
  },
  conclusion: {
    paragraphType: 'conclusion',
    rhetoricalMove: 'synthesize',
    oneParagraph: true,
    allowLineBreaks: false,
    allowBullets: false,
    allowHeadings: false,
    allowCitations: false,
    allowExamples: false,
  },
};

