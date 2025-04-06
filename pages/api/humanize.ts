export default async function handler(req, res) {
  const { text } = req.body;

  try {
    const response = await fetch("https://api.humanizer.ai/api/humanizer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.HUMANIZER_API_KEY}`,
      },
      body: JSON.stringify({ text }),
    });

    const result = await response.json();

    if (!response.ok || !result.humanized_text) {
      return res.status(500).json({ result: result.error || "⚠️ Humanizer API 回傳格式有誤。" });
    }

    res.status(200).json({ result: result.humanized_text });
  } catch (error) {
    console.error("❌ Humanizer API 發生錯誤：", error);
    res.status(500).json({ result: "❌ 發生錯誤，請稍後再試。" });
  }
}
