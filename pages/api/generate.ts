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
請根據以上需求寫一篇完整文章，注意語氣、段落、例子與邏輯清晰。`;

  try {
    // 📝 Step 1: 初稿撰寫
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
        messages: [
          { role: "system", content: "你是一位資深老師，請根據學生輸入的功課要求，撰寫出完整、具結構的草稿。" },
          { role: "user", content: basePrompt }
        ],
        max_tokens: 1500
      })
    });

    const step1 = await step1Res.json();
    const firstDraft = step1?.choices?.[0]?.message?.content;

    if (!firstDraft) {
      return res.status(500).json({ result: "⚠️ GPT 初稿失敗", debug: step1 });
    }

    // 🔁 Step 2: 自我修訂（模擬老師審閱）
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
          { role: "system", content: "請扮演老師，審閱以下文章是否符合學生需求。如果不符合請潤飾語氣、補上細節、強化段落邏輯。不要加入評論。" },
          { role: "user", content: firstDraft }
        ],
        max_tokens: 1500
      })
    });

    const step2 = await step2Res.json();
    const revised = step2?.choices?.[0]?.message?.content;

    res.status(200).json({
      step1_draft: firstDraft,
      step2_revised: revised || "⚠️ 第二輪修訂失敗"
    });
  } catch (err) {
    res.status(500).json({ result: `❌ 系統錯誤：${err.message}` });
  }
}
