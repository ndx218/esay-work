// /pages/api/rewrite.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM, mapMode } from '@/lib/ai';

type ResBody = { result: string } | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResBody>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST requests are allowed' });

  const { text, mode = 'free' } = (req.body ?? {}) as Record<string, any>;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Missing required field: text' });
  }

  const system = '請將以下文章優化，使語句更清楚、結構更合理、保留重點、自然流暢，不要改變原意，也不要加入多餘內容。';

  try {
    const llmOpts = mapMode('revise', mode);
    const rewritten = await callLLM(
      [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
      { ...llmOpts, title: process.env.OPENROUTER_TITLE ?? 'Assignment Terminator', referer: process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL }
    );
    return res.status(200).json({ result: rewritten || '⚠️ 重寫失敗' });
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    if (msg.startsWith('OPENROUTER_HTTP_')) {
      try {
        const rw2 = await callLLM(
          [
            { role: 'system', content: system },
            { role: 'user', content: text },
          ],
          { model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo', temperature: 0.7, timeoutMs: 45_000, title: 'Rewrite Fallback', referer: process.env.NEXT_PUBLIC_APP_URL }
        );
        return res.status(200).json({ result: rw2 || '⚠️ 重寫失敗' });
      } catch {}
    }
    console.error('[rewrite]', { mode, err: msg });
    return res.status(500).json({ error: err?.message || '未知錯誤' });
  }
}
