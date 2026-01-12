// API: undetectable conversion (人性化處理)
// ✅ /pages/api/undetectable.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode } from '@/lib/ai';

type ResBody = { result?: string; humanized?: string; resultZh?: string; humanizedZh?: string; error?: string };

function detectLang(text: string): 'zh' | 'en' {
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResBody>) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求' });
  }

  const {
    text,
    mode = 'free',
    language,
    generateBoth = false, // ✅ 是否同时生成中英文版本
  } = (req.body ?? {}) as Record<string, any>;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: '請提供要優化的文本' });
  }

  const lang: 'zh' | 'en' =
    language === 'zh' || language === 'en' ? language : detectLang(text);

  // 构建人性化处理的系统提示
  const systemHumanizeZH = `你是一位專業的文本人性化處理專家。

請對提供的文本進行優化，使其更難被 AI 偵測工具識別，同時保持：
1. 內容的核心含義和論點完全一致
2. 學術語氣和專業性
3. 段落結構和邏輯順序
4. 原有的標題和格式（如果有）

優化策略：
- 使用更自然的語句表達方式
- 適當調整句式結構，增加變化
- 使用更口語化但保持學術規範的措辭
- 避免過於機械或重複的表達模式
- 保持專業術語的準確性

輸出格式：
直接輸出優化後的文本，不要添加任何額外的說明、標記或註釋。`;

  const systemHumanizeEN = `You are a professional text humanization expert.

Please optimize the provided text to make it harder for AI detection tools to identify, while maintaining:
1. The core meaning and arguments completely unchanged
2. Academic tone and professionalism
3. Paragraph structure and logical order
4. Original headings and formatting (if any)

Optimization strategies:
- Use more natural sentence expressions
- Appropriately adjust sentence structures for variety
- Use more conversational but academically appropriate phrasing
- Avoid overly mechanical or repetitive expression patterns
- Maintain accuracy of technical terms

Output format:
Directly output the optimized text without any additional explanations, markers, or annotations.`;

  const system = lang === 'zh' ? systemHumanizeZH : systemHumanizeEN;

  // 构建用户提示
  const userPrompt = lang === 'zh'
    ? `請對以下文本進行人性化處理，使其更難被 AI 偵測，但保持內容與語意一致：\n\n${text}`
    : `Please humanize the following text to make it harder for AI detection while keeping the content and meaning consistent:\n\n${text}`;

  try {
    const llmOpts = mapMode('review', mode);

    const humanized = await callLLM(
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

    const result = humanized || (lang === 'zh' ? '⚠️ 人性化處理失敗' : '⚠️ Humanization failed');
    
    let resultZh: string | undefined;
    
    // 如果要求同时生成中文版本，且当前是英文版本，则生成中文翻译
    if (generateBoth && lang === 'en' && result) {
      try {
        const systemZh = systemHumanizeZH;
        const userPromptZh = `請對以下文本進行人性化處理，使其更難被 AI 偵測，但保持內容與語意一致：\n\n${result}`;
        
        resultZh = await callLLM(
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
        console.error('[humanization zh generation failed]', err);
        // 如果中文生成失败，继续返回英文版本
      }
    }

    return res.status(200).json({
      result,
      humanized: result, // 向后兼容
      resultZh: resultZh,
      humanizedZh: resultZh,
    });
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    console.error('[undetectable]', { mode, err: msg });

    // fallback
    if (msg.startsWith('OPENROUTER_HTTP_')) {
      try {
        const humanized2 = await callLLM(
          [
            { role: 'system', content: system },
            { role: 'user', content: userPrompt },
          ],
          {
            model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
            temperature: 0.7,
            timeoutMs: 45_000,
            title: 'Humanization Fallback',
            referer: process.env.NEXT_PUBLIC_APP_URL,
          }
        );
        const result2 = humanized2 || (lang === 'zh' ? '⚠️ 人性化處理失敗' : '⚠️ Humanization failed');
        return res.status(200).json({
          result: result2,
          humanized: result2,
        });
      } catch (e: any) {
        console.error('[undetectable fallback failed]', e?.message);
      }
    }

    const errorMsg = err?.message || (lang === 'zh' ? '未知錯誤' : 'Unknown error');
    return res.status(500).json({ error: errorMsg });
  }
}
