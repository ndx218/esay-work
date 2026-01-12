# OpenRouter API 连接诊断代码片段

## 核心 API 调用代码（lib/ai.ts）

```typescript
/** 單一路徑呼叫 OpenRouter（OpenAI/Gemini 都走這裡） */
export async function callLLM(messages: Msg[], opts: LlmOpts): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('MISCONFIG_OPENROUTER: missing OPENROUTER_API_KEY');
  if (!opts?.model) throw new Error('MISCONFIG_OPENROUTER: missing model');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000);

  try {
    const requestBody = {
      model: opts.model,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4000,
      messages,
    };
    
    console.log(`[callLLM] 发送请求到 OpenRouter:`, {
      model: opts.model,
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens,
      messagesCount: messages.length,
      timeout: opts.timeoutMs,
      hasApiKey: !!key && key.length > 0,
      apiKeyPrefix: key ? `${key.substring(0, 8)}...` : 'MISSING'
    });
    
    // ⚠️ 关键：这里发起网络请求
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer':
          opts.referer ?? process.env.OPENROUTER_REFERER ?? process.env.NEXT_PUBLIC_APP_URL ?? '',
        'X-Title': opts.title ?? process.env.OPENROUTER_TITLE ?? 'Assignment Terminator',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,  // ⚠️ 用于超时控制
    });

    if (!resp.ok) {
      let body = '';
      try { body = await resp.text(); } catch {}
      console.error('[openrouter error]', {
        status: resp.status,
        model: opts.model,
        body: body.slice(0, 800),
      });
      throw new Error(`OPENROUTER_HTTP_${resp.status}: ${body.slice(0, 500)}`);
    }

    const responseText = await resp.text();
    // ... 后续处理 ...
    
    return trimmed;
  } catch (error) {
    // ⚠️ 这里会捕获网络错误（timeout, TLS, DNS 等）
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
```

## 错误处理代码（pages/api/draft.ts）

```typescript
} catch (err: any) {
  const msg = String(err?.message ?? '');
  const isZH = /中|中文|zh/i.test(String(language));
  
  // 检查是否是模型相关的错误
  if (msg.startsWith('OPENROUTER_HTTP_')) {
    // 解析错误信息，检查是否是无效模型 ID
    const errorMatch = msg.match(/OPENROUTER_HTTP_(\d+):\s*(.+)/);
    const statusCode = errorMatch?.[1];
    const errorBody = errorMatch?.[2] || '';
    
    // 检查是否是无效模型 ID (400 错误通常表示模型无效)
    if (statusCode === '400' && (errorBody.includes('not a valid model') || errorBody.includes('invalid model'))) {
      const errorMsg = isZH
        ? `❌ 模型錯誤：選定的 AI 模型 "${mode}" 無效或不可用。請嘗試選擇其他模型（如 GPT-5 或 Claude Sonnet 4.5）。`
        : `❌ Model Error: The selected AI model "${mode}" is invalid or unavailable. Please try a different model (e.g., GPT-5 or Claude Sonnet 4.5).`;
      
      console.error('[draft] Invalid model:', { mode, errorBody: errorBody.slice(0, 200) });
      return res.status(400).json({ error: errorMsg });
    }
    
    // 其他 HTTP 错误，尝试降级到 GPT-3.5
    try {
      console.log(`[draft] Primary model failed, falling back to GPT-3.5...`);
      const draft2 = await callLLM(
        [
          { role: 'system', content: isZH ? '你是嚴謹的中文學術寫作助手，重視清晰結構與可讀性。' : 'You are a rigorous academic writing assistant. Write clearly and coherently.' },
          { role: 'user', content: prompt },
        ],
        {
          model: process.env.OPENROUTER_GPT35_MODEL ?? 'openai/gpt-3.5-turbo',
          temperature: 0.7,
          timeoutMs: 45_000,
          title: 'Draft Fallback',
          referer: process.env.NEXT_PUBLIC_APP_URL,
        }
      );
      if (!draft2 || draft2.trim().length < 10) {
        const errorMsg = isZH
          ? '降级模型也未返回有效內容。請檢查網絡連接或嘗試更換其他模型。'
          : 'Fallback model also did not return valid content. Please check your network connection or try a different model.';
        return res.status(500).json({ error: errorMsg });
      }
      return res.status(200).json({ draft: draft2 });
    } catch (fallbackError: any) {
      const errorMsg = isZH
        ? `❌ AI 模型錯誤：無法使用選定的模型 "${mode}"。請檢查模型是否可用，或嘗試更換其他模型。`
        : `❌ AI Model Error: Cannot use selected model "${mode}". Please check if the model is available or try a different one.`;
      
      console.error('[draft] Both primary and fallback failed:', { mode, error: fallbackError?.message });
      return res.status(500).json({ error: errorMsg });
    }
  }
  
  console.error('[draft]', { mode, err: msg });
  return res.status(500).json({ 
    error: isZH 
      ? `AI 回傳失敗，請稍後再試。錯誤：${msg.slice(0, 100)}`
      : `AI request failed, please try again later. Error: ${msg.slice(0, 100)}`
  });
}
```

## 关键配置点

1. **API 端点**: `https://openrouter.ai/api/v1/chat/completions`
2. **超时设置**: 默认 45 秒，长文本 180 秒
3. **环境变量**:
   - `OPENROUTER_API_KEY` (必需)
   - `OPENROUTER_REFERER` (可选)
   - `OPENROUTER_TITLE` (可选)

## 常见错误类型

1. **网络错误**: `fetch()` 抛出 (DNS, timeout, TLS)
2. **HTTP 错误**: `OPENROUTER_HTTP_XXX`
3. **JSON 解析错误**: `OPENROUTER_JSON_PARSE_ERROR`
4. **配置错误**: `MISCONFIG_OPENROUTER: missing ...`

## 诊断命令

```bash
# 测试 OpenRouter API 连接（不包含 API key）
curl -I https://openrouter.ai/api/v1

# 测试 DNS 解析
nslookup openrouter.ai

# 测试 TLS 连接
openssl s_client -connect openrouter.ai:443 -servername openrouter.ai
```

