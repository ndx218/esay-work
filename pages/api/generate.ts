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
    const completion = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-domain.com", // 你可以改成自己的網域名稱
        "X-Title": "EasyWork Homework Generator"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o", // 💥 使用 GPT-4o
        messages: [
          { role: "user", content }
        ]
      })
    }).then(r => r.json());

    if (!completion.choices || !completion.choices[0]) {
      return res.status(500).json({ result: '⚠️ GPT-4o 回傳失敗，請確認內容與 API Key。' });
    }

    res.status(200).json({ result: completion.choices[0].message.content });
  } catch (error) {
    console.error("❌ GPT-4o API 錯誤：", error);
    res.status(500).json({ result: '❌ 系統錯誤，請稍後再試。' });
  }
}
