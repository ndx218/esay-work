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

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://easy-work103.vercel.app",
        "X-Title": "EasyWork"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        max_tokens: 1000,
        messages: [{ role: "user", content }]
      }),
    });

    const completion = await response.json();

    if (!completion.choices || !completion.choices[0]) {
      // 顯示完整錯誤回傳（這步最重要）
      return res.status(500).json({ result: `⚠️ GPT-4o 回傳失敗\n${JSON.stringify(completion, null, 2)}` });
    }

    res.status(200).json({ result: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ result: `❌ 系統錯誤：${error.message}` });
  }
}
