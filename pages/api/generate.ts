export default async function handler(req, res) {
  const { title, wordCount, language, tone, detail, reference, rubric, paragraph } = req.body;

  const basePrompt = `
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
    // Step 1: 初稿生成
    const step1Res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://easy-work103.vercel.app",
        "X-Title": "EasyWork"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: basePrompt }],
        max_tokens: 2000
      })
    });

    const step1 = await step1Res.json();
    const firstDraft = step1?.choices?.[0]?.message?.content;

    if (!firstDraft) {
      return res.status(500).json({ result: "⚠️ GPT 初稿失敗", debug: step1 });
    }

    // Step 2: 第一次修訂
    const step2Res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            content:
              "你是一位嚴謹的老師，請根據學生的要求與評分準則，檢查以下文章是否有語氣不符、內容不完整、重點遺漏、段落不平衡、論點不清等問題。若有問題請立即重寫該段，讓文章邏輯清楚、內容完整、語氣一致，但請保留原意與結構。不要刪減主題。"
          },
          { role: "user", content: firstDraft }
        ],
        max_tokens: 2000
      })
    });

    const step2 = await step2Res.json();
    const firstRevised = step2?.choices?.[0]?.message?.content;

    // Step 3: 第二次修訂
    const step3Res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            content:
              "請再次審查下列文章，針對語氣不一致、內容不夠清晰、段落不平衡等問題進行第二次優化修訂。保留重點與結構，提升邏輯與語感。"
          },
          { role: "user", content: firstRevised }
        ],
        max_tokens: 2000
      })
    });

    const step3 = await step3Res.json();
    const finalDraft = step3?.choices?.[0]?.message?.content || firstRevised;

    res.status(200).json({
      step1_draft: firstDraft,
      step2_revised: finalDraft
    });
  } catch (err) {
    res.status(500).json({ result: `❌ 系統錯誤：${err.message}` });
  }
}
