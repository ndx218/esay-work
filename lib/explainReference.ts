// /lib/reference/explainReference.ts
import { callLLM } from '@/lib/ai';

export async function explainReference(
  reference: {
    title: string;
    authors?: string | null;
    source?: string | null;
    url: string;
    sectionKey: string;
  },
  topicHint: string
): Promise<string> {
  const prompt = `請你擔任學術寫作助理，幫我分析一篇引用文獻。請產出三件事：

1. 從該文獻中提取一句最適合直接引用的句子（若無原文內容，請根據標題推測一個可能的引述內容）。
2. 說明這篇文獻的價值、可信度，以及為何值得被引用。
3. 推薦將它放進段落 ${reference.sectionKey}（${topicHint}）的哪個位置（如開頭、支持論據、對照觀點、結論等）。

請用條列式清楚列出這三項，文字要簡潔有力。

文獻資料如下：
- 標題：${reference.title}
- 作者：${reference.authors ?? '未知'}
- 來源：${reference.source ?? '未知'}
- 網址：${reference.url}`;

  try {
    const response = await callLLM(
      [{ role: 'user', content: prompt }],
      { model: 'openai/gpt-4', temperature: 0.4, timeoutMs: 20000 }
    );
    return response.trim();
  } catch (e) {
    console.warn('[explainReference] LLM error:', e);
    return '此文獻的分析暫時無法提供。';
  }
}
