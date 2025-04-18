// /pages/api/generate.ts

export default async function handler(req, res) {
  const { title, wordCount, language, tone, detail, reference, rubric, paragraph } = req.body;

  const basePrompt = `
題目：${title}
字數：${wordCount}
語言：${language}，語氣：${tone}
內容要求：${detail}
引用方式：${reference}
評分準則：${rubric}
段落要求：${paragraph}
請根據以上需求寫一篇完整文章。
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 秒 timeout

  try {
    // Step 1: 初稿
    const step1Res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://easy-work103.vercel.app",
        "X-Title": "EasyWork"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: basePrompt }],
        max_tokens: 2000
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const step1 = await step1Res.json();
    const firstDraft = step1?.choices?.[0]?.message?.content;

    if (!firstDraft) {
      return res.status(500).json({ result: "⚠️ 初稿失敗，請稍後再試。", debug: step1 });
    }

    // Step 2: 自我修訂
    const step2Res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://easy-work103.vercel.app",
        "X-Title": "EasyWork"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "請將以下文章完整重寫，讓語言更清晰、自然、具邏輯，語氣保持一致。不要刪減任何段落或重點。"
          },
          { role: "user", content: firstDraft }
        ],
        max_tokens: 2000
      })
    });

    const step2 = await step2Res.json();
    const revised = step2?.choices?.[0]?.message?.content;

    res.status(200).json({
      step1_draft: firstDraft,
      step2_revised: revised || "⚠️ 第二輪修訂失敗"
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(500).json({ result: "❌ 請求超時，請稍後重試。" });
    }
    res.status(500).json({ result: `❌ 系統錯誤：${err.message}` });
  }
}
