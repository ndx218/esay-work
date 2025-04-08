// ✅ Debug 模式強化版 /api/humanize.ts
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

    console.log("📦 Humanizer 回傳內容:", result); // ✅ DEBUG LOG

    if (!response.ok || !result.humanized_text) {
      return res.status(500).json({
        result: `❌ Humanizer 回傳錯誤\n${JSON.stringify(result, null, 2)}`,
      });
    }

    res.status(200).json({ result: result.humanized_text });
  } catch (error) {
    console.error("❌ Humanizer API 發生錯誤：", error);
    res.status(500).json({ result: `❌ 系統錯誤：${error.message}` });
  }
}
