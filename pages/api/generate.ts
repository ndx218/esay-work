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

  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content }],
    }),
  }).then(r => r.json());

  res.status(200).json({ result: completion.choices[0].message.content });
}
