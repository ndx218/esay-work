export default async function handler(req, res) {
  const { text } = req.body;

  try {
    const response = await fetch("https://api.undetectable.ai/api/content/humanize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.UNDETECTABLE_API_KEY}`,
      },
      body: JSON.stringify({
        content: text,
        mode: "accurate",          // 或 "balanced", "creative" 根據需求更換
        output_type: "plain_text"  // 可以選 "plain_text" or "html"
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.humanized_content) {
      return res.status(500).json({
        result: result.error || "⚠️ Undetectable API 回傳格式有誤。",
      });
    }

    res.status(200).json({ result: result.humanized_content });

  } catch (error) {
    console.error("❌ Undetectable API 發生錯誤：", error);
    res.status(500).json({ result: `❌ 系統錯誤：${error.message}` });
  }
}
