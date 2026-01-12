// /pages/api/translate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM } from '@/lib/ai';

type ResBody = { translated: string } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>
) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  const { text, targetLang = 'zh' } = (req.body ?? {}) as Record<string, any>;

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Missing required field: text' });
  }

  if (targetLang !== 'zh' && targetLang !== 'en') {
    return res.status(400).json({ error: 'targetLang must be "zh" or "en"' });
  }

  try {
    const systemPrompt = targetLang === 'zh'
      ? `你是一位專業的學術翻譯專家。請將以下英文學術寫作反饋翻譯成中文，保持：
1. 所有評分數字和格式不變
2. 學術術語準確
3. 結構和標題格式完全一致
4. 引用原文的引號內容不變
5. 語氣專業但鼓勵`
      : `You are a professional academic translator. Translate the following Chinese academic writing feedback into English, maintaining:
1. All score numbers and format unchanged
2. Academic terminology accuracy
3. Structure and heading format exactly the same
4. Quoted original text unchanged
5. Professional but encouraging tone`;

    const translated = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      {
        model: process.env.OPENROUTER_GPT4_MODEL ?? 'openai/gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 8000,
        timeoutMs: 60000,
        title: process.env.OPENROUTER_TITLE ?? 'Assignment Terminator',
        referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL,
      }
    );

    return res.status(200).json({
      translated: translated || text, // fallback to original if translation fails
    });
  } catch (err: any) {
    console.error('[translate]', { err: err?.message });
    return res.status(500).json({ error: err?.message || '翻譯失敗' });
  }
}



