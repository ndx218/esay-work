export default async function handler(req, res) {
  const { text } = req.body;

  const response = await fetch("https://api.humanizer.ai/api/humanizer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.HUMANIZER_API_KEY}`,
    },
    body: JSON.stringify({
      text: text,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    return res.status(500).json({ error: result.error || "Humanizer API Error" });
  }

  res.status(200).json({ result: result.humanized_text });
}
