// /pages/api/revision.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode } from '@/lib/ai';

type ResBody = { revision: { en: string, zh: string } } | { revision: string; revisionZh?: string } | { error: string };

function detectLang(text: string): 'zh' | 'en' {
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>
) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  const {
    draftText,
    reviewText,
    title = '',
    sectionId,
    sectionType, // ✅ 段落类型（introduction/body/conclusion）
    wordCount, // ✅ 目标字数
    language,
    mode = 'free',
    generateBoth = false, // ✅ 是否同时生成中英文版本
  } = (req.body ?? {}) as Record<string, any>;

  if (!draftText || typeof draftText !== 'string' || !draftText.trim()) {
    return res.status(400).json({ error: 'Missing required field: draftText' });
  }

  if (!reviewText || typeof reviewText !== 'string' || !reviewText.trim()) {
    return res.status(400).json({ error: 'Missing required field: reviewText' });
  }

  const lang: 'zh' | 'en' =
    language === 'zh' || language === 'en' ? language : detectLang(draftText);

  // 构建修订稿生成的系统提示
  const systemRevisionZH = `你是一位專業的學術寫作教練和編輯。

根據提供的草稿內容和教師評論，生成改進後的修訂稿（單一段落）。

要求：
1. 必須認真閱讀並理解教師評論中的所有建議和問題
2. 針對評論中指出的問題進行具體修改
3. 保持原文的核心論點和結構
4. 改進語言表達、邏輯結構、論證品質等方面
5. 確保修訂後的內容更加清晰、學術、準確
6. 不要只是重寫，而是要根據評論進行有針對性的改進

【段落連接詞規則】（必須遵守）：
- **每個段落只能使用一個連接詞**，根據段落位置選擇對應的連接詞：
  * **引言段落（Introduction）**：
    - 中文：近年來、隨著、首先等
    - 英文：In recent years, With the development of, First等
  * **主體段一（Body Paragraph 1）**：
    - 中文：**首先**
    - 英文：**First**
  * **主體段二（Body Paragraph 2）**：
    - 中文：**其次**
    - 英文：**Second**
  * **主體段三（Body Paragraph 3）**：
    - 中文：**此外** 或 **再者**
    - 英文：**Furthermore** 或 **Moreover**
  * **結論段落（Conclusion）**：
    - 中文：**總而言之** 或 **綜上所述** 或 **因此**
    - 英文：**In conclusion** 或 **To summarize** 或 **Therefore**
- **重要**：不要在同一段落中使用多個連接詞（如"首先、其次、此外"），每個段落只使用一個與其位置對應的連接詞

【硬性規則】（必須遵守）：
- 禁止編造研究、統計數據、作者姓名、年份、期刊名稱或引用文獻
- 如果草稿/評論中沒有提供經過驗證的參考資料，寫作時不要使用作者-年份引用格式，也不要使用數值聲稱
- 如果教師評論要求提供證據但草稿中沒有提供，修訂時應：
  (a) 使聲稱更加謹慎，或
  (b) 添加佔位符如 [需要來源] 而不是編造數據
- **只輸出單一段落的修訂稿內容**，不要包含段落編號、標題或其他段落的內容
- **必須達到目標字數**：如果目標字數是500字，你必須生成約500字的內容，不能只有200-300字
- 如果字數不足，需要擴展內容、添加更多細節和論證，直到達到目標字數

輸出格式：
- 直接輸出修訂後的單一段落文本內容，不要添加任何額外的說明、標記、段落編號或標題
- 確保使用適當的段落連接詞來組織內容`;

  const systemRevisionEN = `You are a professional academic writing coach and editor.

Generate an improved revision based on the provided draft content and teacher feedback (single paragraph only).

Requirements:
1. Carefully read and understand all suggestions and issues in the teacher feedback
2. Make specific revisions addressing the issues mentioned in the feedback
3. Maintain the core arguments and structure of the original text
4. Improve aspects such as language expression, logical structure, and argument quality
5. Ensure the revised content is clearer, more academic, and more accurate
6. Do not simply rewrite; make targeted improvements based on the feedback

【Paragraph Connectors Rules】(must follow):
- **Use ONLY ONE connector per paragraph**, based on the paragraph's position:
  * **Introduction paragraph**:
    - In recent years, With the development of, First, etc.
  * **Body Paragraph 1**:
    - Use: **First**
  * **Body Paragraph 2**:
    - Use: **Second**
  * **Body Paragraph 3**:
    - Use: **Furthermore** or **Moreover**
  * **Conclusion paragraph**:
    - Use: **In conclusion** or **To summarize** or **Therefore**
- **IMPORTANT**: Do NOT use multiple connectors in one paragraph (e.g., "First, Second, Furthermore"). Each paragraph should use ONLY ONE connector that matches its position.

Hard rules (must follow):
- Do NOT invent studies, statistics, author names, years, journal names, or citations
- If the draft/review does not provide verified references, write WITHOUT author-year citations and WITHOUT numeric claims
- If teacher feedback asks for evidence but none is provided, revise by:
  (a) making the claim more cautious, or
  (b) adding a placeholder like [ADD SOURCE] instead of fabricating
- **Output ONLY the content of a single paragraph revision**, do NOT include section numbers, headings, or content from other paragraphs
- **MUST reach the target word count**: If the target is 500 words, you MUST generate approximately 500 words, not just 200-300 words
- If the word count is insufficient, expand the content with more details and arguments until the target word count is reached

Output format:
- Directly output the revised single paragraph text content without any additional explanations, markers, section numbers, or headings
- Ensure appropriate paragraph connectors are used to organize the content`;

  const system = lang === 'zh' ? systemRevisionZH : systemRevisionEN;

  // 检测是否为整篇文章（包含多个段落）
  const isFullArticle = typeof sectionId === 'string' && sectionId.toLowerCase() === 'all' ||
                        (typeof sectionId === 'undefined' || sectionId === null) ||
                        /(?:1\.|2\.|3\.|4\.|5\.|引言|主體|結論|Introduction|Body|Conclusion)/i.test(draftText);

  // ✅ 确定段落类型（用于添加适当的连接词）
  const actualSectionType = sectionType || (
    sectionId === 1 ? 'introduction' 
    : (sectionId && sectionId >= 2 && sectionId <= 4) ? 'body' 
    : sectionId === 5 ? 'conclusion' 
    : 'body' // 默认为body段落
  );
  
  // ✅ 根据段落ID确定应该使用的连接词
  const getConnectorInstruction = (sectionId: number, lang: 'zh' | 'en'): string => {
    if (sectionId === 1) {
      return lang === 'zh' 
        ? '使用引言性連接詞（如"近年來"、"隨著"、"首先"），但不要使用"首先"如果後面還有主體段落。'
        : 'Use introductory connectors (e.g., "In recent years", "With the development of", "First"), but avoid "First" if there are body paragraphs following.';
    } else if (sectionId === 2) {
      return lang === 'zh'
        ? '必須使用"首先"作為段落開頭的連接詞。'
        : 'MUST use "First" as the connector at the beginning of the paragraph.';
    } else if (sectionId === 3) {
      return lang === 'zh'
        ? '必須使用"其次"作為段落開頭的連接詞。'
        : 'MUST use "Second" as the connector at the beginning of the paragraph.';
    } else if (sectionId === 4) {
      return lang === 'zh'
        ? '必須使用"此外"或"再者"作為段落開頭的連接詞。'
        : 'MUST use "Furthermore" or "Moreover" as the connector at the beginning of the paragraph.';
    } else if (sectionId >= 5) {
      return lang === 'zh'
        ? '必須使用結論性連接詞（如"總而言之"、"綜上所述"、"因此"）作為段落開頭。'
        : 'MUST use a conclusive connector (e.g., "In conclusion", "To summarize", "Therefore") at the beginning of the paragraph.';
    }
    return '';
  };
  
  // ✅ 获取目标字数（如果有提供）
  const targetWordCount = wordCount ? Number(wordCount) : null;

  // ✅ 构建用户提示（包含目标字数）
  const wordCountInstruction = targetWordCount 
    ? (lang === 'zh' ? `目標字數：約${targetWordCount}字。` : `Target word count: approximately ${targetWordCount} words.`)
    : '';
  
  const userPrompt = lang === 'zh' 
    ? isFullArticle
      ? `論文標題：${title || '未提供'}\n\n這是一篇完整文章，請你輸出完整的 1–5 段修訂稿，保留原標題與段落編號（1. 引言、2. 主體段一、3. 主體段二、4. 主體段三、5. 結論）。\n\n【原始草稿】\n${draftText}\n\n【教師評論】\n${reviewText}\n\n請開始修訂，輸出完整的修訂稿：`
      : `論文標題：${title || '未提供'}\n\n段落編號：${sectionId || '未知'}\n段落類型：${actualSectionType === 'introduction' ? '引言' : actualSectionType === 'conclusion' ? '結論' : '主體段落'}\n${wordCountInstruction}\n\n【重要要求】\n- 只輸出這一個段落的修訂稿內容\n- 不要輸出其他段落的內容（如引言、主體段一、主體段二等）\n- 不要包含段落編號（如"1. Introduction"、"2. Body Paragraph 1"等）\n- 不要包含標題\n- 必須達到目標字數，如果目標是${targetWordCount || '指定'}字，必須生成約${targetWordCount || '目標'}字的內容\n\n【連接詞要求】\n${sectionId ? getConnectorInstruction(sectionId, 'zh') : ''}\n\n【原始草稿】\n${draftText}\n\n【教師評論】\n${reviewText}\n\n請根據教師評論對草稿進行修訂，輸出改進後的單一段落修訂稿（只輸出這個段落本身的內容，不要在段落開頭使用一個指定的連接詞）：`
    : isFullArticle
      ? `Paper Title: ${title || 'Not provided'}\n\nThis is a full article. Output the FULL revised essay (Sections 1–5). Preserve headings and numbering (1. Introduction, 2. Body Paragraph 1, 3. Body Paragraph 2, 4. Body Paragraph 3, 5. Conclusion).\n\n【Original Draft】\n${draftText}\n\n【Teacher Feedback】\n${reviewText}\n\nStart revising and output the complete revision:`
      : `Paper Title: ${title || 'Not provided'}\n\nSection ID: ${sectionId || 'Unknown'}\nSection Type: ${actualSectionType === 'introduction' ? 'Introduction' : actualSectionType === 'conclusion' ? 'Conclusion' : 'Body Paragraph'}\n${wordCountInstruction}\n\n【IMPORTANT REQUIREMENTS】\n- Output ONLY the content of this ONE paragraph revision\n- Do NOT output content from other paragraphs (e.g., Introduction, Body Paragraph 1, Body Paragraph 2, etc.)\n- Do NOT include section numbers (e.g., "1. Introduction", "2. Body Paragraph 1", etc.)\n- Do NOT include headings\n- MUST reach the target word count. If the target is ${targetWordCount || 'specified'} words, you MUST generate approximately ${targetWordCount || 'target'} words of content\n\n【Connector Requirement】\n${sectionId ? getConnectorInstruction(sectionId, 'en') : ''}\n\n【Original Draft】\n${draftText}\n\n【Teacher Feedback】\n${reviewText}\n\nPlease revise the draft based on the teacher feedback and output the improved single paragraph revision (output ONLY this paragraph's content, use ONLY ONE connector at the beginning of the paragraph as specified):`;

  try {
    const llmOpts = mapMode('review', mode);
    
    // ✅ 根据目标字数计算maxTokens，确保有足够的token空间来生成目标字数
    const isZH = lang === 'zh';
    if (targetWordCount && targetWordCount > 0) {
      const estimatedTokens = isZH
        ? Math.ceil(targetWordCount * 1.5)  // 中文：字符数约等于token数，1.5倍保险
        : Math.ceil(targetWordCount * 2.5); // 英文：单词数转token，2.5倍保险
      const maxTokens = Math.min(Math.max(estimatedTokens, 500), 8000); // 最少500，最多8000
      llmOpts.maxTokens = maxTokens;
      console.log(`[revision] Target word count: ${targetWordCount}, Estimated tokens: ${estimatedTokens}, Setting maxTokens: ${maxTokens}`);
    }

    const revision = await callLLM(
      [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      {
        ...llmOpts,
        title: process.env.OPENROUTER_TITLE ?? 'Assignment Terminator',
        referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
      }
    );

    let revisionZh: string | undefined;
    let revisionEn: string | undefined;
    
    // ✅ 如果要求同时生成中英文版本
    if (generateBoth) {
      if (lang === 'en') {
        // 当前生成的是英文，需要再生成中文版本
        revisionEn = revision;
        try {
          const systemZh = systemRevisionZH;
          const userPromptZh = isFullArticle
            ? `論文標題：${title || '未提供'}\n\n這是一篇完整文章，請你輸出完整的 1–5 段修訂稿（中文版本），保留原標題與段落編號。\n\n【連接詞要求】\n- 段落1（引言）：使用引言性連接詞（如"近年來"、"隨著"）\n- 段落2（主體段一）：必須使用"首先"\n- 段落3（主體段二）：必須使用"其次"\n- 段落4（主體段三）：必須使用"此外"或"再者"\n- 段落5（結論）：必須使用"總而言之"或"綜上所述"或"因此"\n每段只使用一個連接詞，不要重複。\n\n【原始草稿】\n${draftText}\n\n【教師評論】\n${reviewText}\n\n請開始修訂，輸出完整的修訂稿（中文）：`
            : `論文標題：${title || '未提供'}\n\n段落編號：${sectionId || '未知'}\n段落類型：${actualSectionType === 'introduction' ? '引言' : actualSectionType === 'conclusion' ? '結論' : '主體段落'}\n${wordCountInstruction}\n\n【重要要求】\n- 只輸出這一個段落的修訂稿內容（${actualSectionType === 'introduction' ? '引言' : actualSectionType === 'conclusion' ? '結論' : '主體段落'}）\n- 不要輸出其他段落的內容（如引言、主體段一、主體段二、結論等）\n- 不要包含段落編號（如"1. Introduction"、"2. Body Paragraph 1"等）\n- 不要包含標題\n- 必須達到目標字數：如果目標是${targetWordCount || '指定'}字，必須生成約${targetWordCount || '目標'}字的內容，不能只有200-300字\n\n【連接詞要求】\n${sectionId ? getConnectorInstruction(sectionId, 'zh') : ''}\n\n【原始草稿】\n${draftText}\n\n【教師評論】\n${reviewText}\n\n請根據教師評論對草稿進行修訂，輸出改進後的單一段落修訂稿（中文，只輸出這個段落本身的內容，在段落開頭使用一個指定的連接詞）：`;
          
          revisionZh = await callLLM(
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
          console.error('[revision zh generation failed]', err);
        }
      } else {
        // 当前生成的是中文，需要再生成英文版本
        revisionZh = revision;
        try {
          const systemEn = systemRevisionEN;
          const userPromptEn = isFullArticle
            ? `Paper Title: ${title || 'Not provided'}\n\nThis is a full article. Output the FULL revised essay (Sections 1–5) in English. Preserve headings and numbering.\n\n【Connector Requirements】\n- Section 1 (Introduction): Use introductory connectors (e.g., "In recent years", "With the development of")\n- Section 2 (Body Paragraph 1): MUST use "First"\n- Section 3 (Body Paragraph 2): MUST use "Second"\n- Section 4 (Body Paragraph 3): MUST use "Furthermore" or "Moreover"\n- Section 5 (Conclusion): MUST use "In conclusion" or "To summarize" or "Therefore"\nEach section should use ONLY ONE connector, do not repeat connectors across sections.\n\n【Original Draft】\n${draftText}\n\n【Teacher Feedback】\n${reviewText}\n\nStart revising and output the complete revision in English:`
            : `Paper Title: ${title || 'Not provided'}\n\nSection ID: ${sectionId || 'Unknown'}\nSection Type: ${actualSectionType === 'introduction' ? 'Introduction' : actualSectionType === 'conclusion' ? 'Conclusion' : 'Body Paragraph'}\n${wordCountInstruction}\n\n【IMPORTANT REQUIREMENTS】\n- Output ONLY the content of this ONE paragraph revision (${actualSectionType === 'introduction' ? 'Introduction' : actualSectionType === 'conclusion' ? 'Conclusion' : 'Body Paragraph'})\n- Do NOT output content from other paragraphs (e.g., Introduction, Body Paragraph 1, Body Paragraph 2, Conclusion, etc.)\n- Do NOT include section numbers (e.g., "1. Introduction", "2. Body Paragraph 1", etc.)\n- Do NOT include headings\n- MUST reach the target word count. If the target is ${targetWordCount || 'specified'} words, you MUST generate approximately ${targetWordCount || 'target'} words of content, not just 200-300 words\n\n【Connector Requirement】\n${sectionId ? getConnectorInstruction(sectionId, 'en') : ''}\n\n【Original Draft】\n${draftText}\n\n【Teacher Feedback】\n${reviewText}\n\nPlease revise the draft based on the teacher feedback and output the improved single paragraph revision in English (output ONLY this paragraph's content, use ONLY ONE connector at the beginning of the paragraph as specified):`;
          
          revisionEn = await callLLM(
            [
              { role: 'system', content: systemEn },
              { role: 'user', content: userPromptEn },
            ],
            {
              ...llmOpts, // ✅ 使用相同的maxTokens设置
              title: process.env.OPENROUTER_TITLE ?? 'Assignment Terminator',
              referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
            }
          ) || '';
        } catch (err) {
          console.error('[revision en generation failed]', err);
        }
      }
      
      return res.status(200).json({
        revision: {
          en: revisionEn || revision || '',
          zh: revisionZh || revision || '',
        },
      });
    }

    // ✅ 只生成单一语言版本
    const singleLangResult: { en: string, zh: string } = {
      en: lang === 'en' ? (revision || '⚠️ Revision generation failed') : '',
      zh: lang === 'zh' ? (revision || '⚠️ 修訂稿生成失敗') : '',
    };
    
    return res.status(200).json({
      revision: singleLangResult,
    });
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    console.error('[revision]', { mode, err: msg });

    // fallback
    if (msg.startsWith('OPENROUTER_HTTP_')) {
      try {
        const rev2 = await callLLM(
          [
            { role: 'system', content: system },
            { role: 'user', content: userPrompt },
          ],
          {
            model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
            temperature: 0.7,
            timeoutMs: 45_000,
            title: 'Revision Fallback',
            referer: process.env.NEXT_PUBLIC_APP_URL,
          }
        );
        return res.status(200).json({
          revision: rev2 || (lang === 'zh' ? '⚠️ 修訂稿生成失敗' : '⚠️ Revision generation failed'),
        });
      } catch (e: any) {
        console.error('[revision fallback failed]', e?.message);
      }
    }

    return res.status(500).json({ error: err?.message || '未知錯誤' });
  }
}

