// 第一次請求：產出初稿
const draftResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://easy-work103.vercel.app",
    "X-Title": "EasyWork"
  },
  body: JSON.stringify({
    model: "openai/gpt-3.5-turbo",
    messages: [
      { role: "user", content }
    ],
    max_tokens: 1000
  })
});

const draftJson = await draftResponse.json();
const draft = draftJson.choices?.[0]?.message?.content;

// 第二次請求：模擬老師審查後重寫
const reviseResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://easy-work103.vercel.app",
    "X-Title": "EasyWork"
  },
  body: JSON.stringify({
    model: "openai/gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a strict teacher. Read the draft carefully. Check if it meets the requirements. Revise it to fix any missing details, incorrect tone, or bad paragraph structure. Keep it concise and focused."
      },
      {
        role: "user",
        content: draft
      }
    ],
    max_tokens: 1000
  })
});

const revisedJson = await reviseResponse.json();
const revised = revisedJson.choices?.[0]?.message?.content;

res.status(200).json({ result: revised });
