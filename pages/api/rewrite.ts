// pages/api/rewrite.ts
export default async function handler(req, res) {
  const { text } = req.body;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://easy-work103.vercel.app",
        "X-Title": "EasyWork"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Rewrite the text in a clear, simple style. Use short sentences. Avoid complex words. Make it sound natural and reduce AI detection likelihood. Delete any conclusion at the end."
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 1000
      })
    });

    const result = await response.json();

    if (!result.choices || !result.choices[0]) {
      return res.status(500).json({ result: "⚠️ GPT 回傳失敗", debug: result });
    }

    res.status(200).json({ result: result.choices[0].message.content });
  } catch (error) {
    console.error("❌ GPT API 發生錯誤：", error);
    res.status(500).json({ result: `❌ 系統錯誤：${error.message}` });
  }
}
