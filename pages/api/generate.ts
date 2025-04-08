export default async function handler(req, res) {
  const { title, wordCount, language, tone, detail, reference, rubric, paragraph } = req.body;

  const content = `
題目：${title}
字數：${wordCount}
語言：${language}，語氣：${tone}
內容要求：${detail}
引用方式：${reference}
評分準則：${rubric}
段落要求：${paragraph}
請根據以上需求寫一篇完整文章。
  `;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, // ✅ 在 Vercel 設定 ENV
      "Content-Type": "application/json",
      "HTTP-Referer": "https://yourproject.vercel.app", // ✅ 改成你的網址
      "X-Title": "EasyWork", // ✅ 顯示在 OpenRouter 排行榜的名稱
    },
    body: JSON.stringify({
      model: "openai/chatgpt-4o", // ✅ 支援 GPT-4o
      messages: [
        {
          role: "user",
          content: content,
        },
      ],
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.choices) {
    return res.status(500).json({ result: "⚠️ GPT-4o 回傳失敗，請確認內容與 API Key。" });
  }

  res.status(200).json({ result: result.choices[0].message.content });
}
