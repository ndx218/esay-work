export default async function handler(req, res) {
  const { content } = req.body;

  const humanized = await fetch("https://api.humanizer.ai/v1/humanize", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.HUMANIZER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  }).then(r => r.json());

  res.status(200).json({ result: humanized.result });
}
