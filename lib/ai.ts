// /lib/ai.ts

// 訊息型別（OpenAI/OR 相容）
export type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

// 可選：給外部用的步驟型別
export type StepName = 'outline' | 'draft' | 'review' | 'revise' | 'final';

// 呼叫選項
export type LlmOpts = {
  model: string;                // OpenRouter 的 model slug
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  referer?: string;             // 會塞進 HTTP-Referer（OpenRouter 建議）
  title?: string;               // 會塞進 X-Title（OpenRouter 建議）
};

/** 內部預設（可用環境變數覆蓋） */
// ⚠️ 重要：必須使用支援 chat/completions 的模型 ID
// ❌ 不要用：embedding models, base models, token models
// ✅ 要用：chat completion models

// 顶级模型配置
const GPT41_DEFAULT =
  process.env.OPENROUTER_GPT41_MODEL ?? 'openai/gpt-4.1'; // ⭐⭐⭐⭐⭐ 最高质量
const GPT41_MINI_DEFAULT =
  process.env.OPENROUTER_GPT41_MINI_MODEL ?? 'openai/gpt-4.1-mini'; // ⭐⭐⭐⭐ 性价比高
const GPT4O_DEFAULT =
  process.env.OPENROUTER_GPT4O_MODEL ?? 'openai/gpt-4o'; // ⭐⭐⭐⭐ 平衡选择
const GPT4O_MINI_DEFAULT =
  process.env.OPENROUTER_GPT4O_MINI_MODEL ?? 'openai/gpt-4o-mini'; // ⭐⭐⭐ 当前默认
const GPT5_DEFAULT =
  process.env.OPENROUTER_GPT5_MODEL ?? GPT4O_MINI_DEFAULT; // GPT-5 未公開，使用 4o-mini

const CLAUDE_SONNET_45_DEFAULT =
  process.env.OPENROUTER_CLAUDE_SONNET_45_MODEL ?? 'anthropic/claude-3.5-sonnet'; // ⭐⭐⭐⭐⭐ 最高质量
const GEMINI3_PRO_DEFAULT =
  process.env.OPENROUTER_GEMINI3_PRO_MODEL ?? 'google/gemini-2.0-flash-exp';
const GROK_CODE_FAST_1_DEFAULT =
  process.env.OPENROUTER_GROK_CODE_FAST_1_MODEL ?? 'x-ai/grok-code-fast-1';
const GROK_41_FAST_DEFAULT =
  process.env.OPENROUTER_GROK_41_FAST_MODEL ?? 'x-ai/grok-beta';
const FALLBACK_DEFAULT =
  process.env.OPENROUTER_FALLBACK_MODEL ?? GPT4O_MINI_DEFAULT; // Fallback 使用 4o-mini

/**
 * 把 UI 的 mode 正規化並映射到 OpenRouter 模型。
 * ⚠️ 所有模型 ID 必須支援 chat/completions endpoint
 * 
 * 顶级模型映射：
 * - 'gpt-4.1' / 'gpt41' → openai/gpt-4.1 (⭐⭐⭐⭐⭐ 最高质量)
 * - 'gpt-4.1-mini' / 'gpt41mini' → openai/gpt-4.1-mini (⭐⭐⭐⭐ 性价比高)
 * - 'gpt-4o' / 'gpt4o' → openai/gpt-4o (⭐⭐⭐⭐ 平衡选择)
 * - 'gpt-4o-mini' / 'gpt4omini' → openai/gpt-4o-mini (⭐⭐⭐ 当前默认)
 * - 'gpt-5' / 'gpt5' → openai/gpt-4o-mini (GPT-5 未公開，使用 4o-mini)
 * 
 * 其他模型：
 * - 'claude-sonnet-4.5' / 'claudesonnet45' → anthropic/claude-3.5-sonnet (⭐⭐⭐⭐⭐ 最高质量)
 * - 'gemini-3-pro' / 'gemini3pro' → google/gemini-2.0-flash-exp
 * - 'grok-code-fast-1' / 'grokcodefast1' → x-ai/grok-code-fast-1
 * - 'grok-4.1-fast' / 'grok41fast' → x-ai/grok-beta
 * - 'free' / 空字串 / 其他 → 預設走 openai/gpt-4o-mini
 */
export function mapMode(_step: string | StepName, mode: string): LlmOpts {
  const norm = normalizeMode(mode);
  console.log(`[mapMode] 输入: "${mode}", 规范化后: "${norm}"`);
  // ⬇️ 把默认超时拉长到180秒，长文必备
  const base = { temperature: 0.7, timeoutMs: 180_000, maxTokens: 4000 };

  // GPT-4.1 系列（最高优先级）
  if (/(gpt41|gpt-4\.1)/.test(norm) && !/mini/.test(norm)) {
    console.log(`[mapMode] 匹配到 GPT-4.1: ${GPT41_DEFAULT}`);
    return { ...base, model: GPT41_DEFAULT };
  }

  // GPT-4.1-mini
  if (/(gpt41mini|gpt-4\.1-mini|gpt-4\.1mini)/.test(norm)) {
    console.log(`[mapMode] 匹配到 GPT-4.1-mini: ${GPT41_MINI_DEFAULT}`);
    return { ...base, model: GPT41_MINI_DEFAULT };
  }

  // GPT-4o
  if (/(gpt4o|gpt-4o)/.test(norm) && !/mini/.test(norm)) {
    console.log(`[mapMode] 匹配到 GPT-4o: ${GPT4O_DEFAULT}`);
    return { ...base, model: GPT4O_DEFAULT };
  }

  // GPT-4o-mini
  if (/(gpt4omini|gpt-4o-mini|gpt-4omini)/.test(norm)) {
    console.log(`[mapMode] 匹配到 GPT-4o-mini: ${GPT4O_MINI_DEFAULT}`);
    return { ...base, model: GPT4O_MINI_DEFAULT };
  }

  // GPT-5 / GPT-5.1 支持（向后兼容）
  if (/(gpt5|gpt-5)/.test(norm)) {
    console.log(`[mapMode] 匹配到 GPT-5/5.1: ${GPT5_DEFAULT}`);
    return { ...base, model: GPT5_DEFAULT };
  }

  // Claude Sonnet 4.5
  if (/(claudesonnet45|claude45|sonnet45)/.test(norm)) {
    console.log(`[mapMode] 匹配到 Claude Sonnet 4.5: ${CLAUDE_SONNET_45_DEFAULT}`);
    return { ...base, model: CLAUDE_SONNET_45_DEFAULT };
  }

  // 已删除不稳定的模型选项（Gemini、Grok 等）
  // 如需使用，可通过环境变量配置

  // free / 預設：使用 GPT-4o-mini
  if (!norm || norm === 'free' || norm === 'default') {
    return { ...base, model: GPT4O_MINI_DEFAULT };
  }

  // 其他未知字串 → fallback to GPT-4o-mini
  return { ...base, model: GPT4O_MINI_DEFAULT };
}

/** 將 UI 傳入的 mode 正規化（去空白、去裝飾字、統一大小寫與符號） */
export function normalizeMode(mode?: string): string {
  return String(mode ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）【】\[\]＋+點]/g, '')
    .replace(/-/g, ''); // gpt-3.5 -> gpt35
}

/** 把任意東西變成字串 */
function normalizeToString(input: any): string {
  if (input == null) return '';
  if (Array.isArray(input)) {
    return input
      .map((x) => {
        if (typeof x === 'string') return x;
        if (x == null) return '';
        if (typeof x === 'object') {
          if (typeof x.text === 'string') return x.text;
          if (typeof x.content === 'string') return x.content;
        }
        return String(x ?? '');
      })
      .join('');
  }
  if (typeof input === 'object') {
    if (typeof (input as any).text === 'string') return (input as any).text;
    if (typeof (input as any).content === 'string') return (input as any).content;
  }
  return String(input ?? '');
}

/** 優先用已知欄位抽內容 */
function extractTextFromKnownFields(data: any): string {
  if (!data || typeof data !== 'object') return '';

  // 1. OpenAI 標準格式：choices[].message.content / delta.content
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const merged = data.choices
      .map((ch: any) => {
        const msg = ch.message ?? ch.delta ?? ch;
        return normalizeToString(msg?.content);
      })
      .join('');
    if (merged.trim()) return merged.trim();
  }

  // 2. OpenRouter 常見 output_text
  if (data.output_text) {
    const txt = normalizeToString(data.output_text).trim();
    if (txt) return txt;
  }

  // 3. OpenRouter 自家 "o" 格式
  if (Array.isArray(data.o) && data.o.length > 0) {
    const merged = data.o
      .map((x: any) =>
        normalizeToString(
          x?.content ??
            x?.text ??
            x?.response ??
            (Array.isArray(x?.choices) ? x.choices[0]?.message?.content : ''),
        ),
      )
      .join('');
    if (merged.trim()) return merged.trim();
  }

  // 4. 其他常見字段
  const alt =
    data.result ??
    data.response ??
    data.message ??
    data.completion ??
    data.text;
  if (alt) {
    const txt = normalizeToString(alt).trim();
    if (txt) return txt;
  }

  return '';
}

/** 最後手段：在整個 JSON 裏面找「最像正文」的一段字串 */
function bruteForceExtractLongestString(data: any): string {
  const candidates: string[] = [];

  function walk(node: any) {
    if (node == null) return;
    if (typeof node === 'string') {
      const s = node.trim();
      if (s.length >= 8) candidates.push(s);
      return;
    }
    if (typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    for (const key of Object.keys(node)) {
      // 避開明顯是錯誤欄位的東西
      if (/error|trace|stack|warning/i.test(key)) continue;
      walk((node as any)[key]);
    }
  }

  walk(data);

  if (!candidates.length) return '';

  // 選最長的一段
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function extractTextFromOpenRouterResponse(data: any): string {
  // 先用「正常」方式抽
  const primary = extractTextFromKnownFields(data);
  if (primary.trim()) return primary.trim();

  // 抽唔到就暴力掃描
  const fallback = bruteForceExtractLongestString(data);
  return fallback.trim();
}

/** 單一路徑呼叫 OpenRouter（OpenAI/Gemini 都走這裡） */
export async function callLLM(messages: Msg[], opts: LlmOpts): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('MISCONFIG_OPENROUTER: missing OPENROUTER_API_KEY');
  if (!opts?.model) throw new Error('MISCONFIG_OPENROUTER: missing model');

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? 45_000,
  );

  try {
    const requestBody = {
      model: opts.model,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4000,
      messages,
    };

    console.log('[callLLM] 发送请求到 OpenRouter:', {
      model: opts.model, // ⚠️ 重要：检查这个 model ID 是否正确
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens,
      messagesCount: messages.length,
      timeout: opts.timeoutMs,
      hasApiKey: !!key && key.length > 0,
      apiKeyPrefix: key ? `${key.substring(0, 8)}...` : 'MISSING',
    });
    
    // ⚠️ 警告：如果 model ID 包含以下关键词，可能不是 chat completion 模型
    if (/embedding|base|token|logit/i.test(opts.model)) {
      console.warn(`[callLLM] ⚠️ 警告：模型 ID "${opts.model}" 可能不是 chat completion 模型！`);
    }

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer':
          opts.referer ??
          process.env.OPENROUTER_REFERER ??
          process.env.NEXT_PUBLIC_APP_URL ??
          '',
        'X-Title': opts.title ?? process.env.OPENROUTER_TITLE ?? 'Assignment Terminator',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const rawText = await resp.text(); // 先拿原文，方便 debug / 記錄

    if (!resp.ok) {
      console.error('[openrouter http error]', {
        status: resp.status,
        model: opts.model,
        body: rawText.slice(0, 800),
      });
      throw new Error(`OPENROUTER_HTTP_${resp.status}: ${rawText.slice(0, 500)}`);
    }

    let data: any;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e: any) {
      console.error('[openrouter json parse error]', {
        model: opts.model,
        error: e?.message,
        raw: rawText.slice(0, 800),
      });
      throw new Error(
        `OPENROUTER_JSON_PARSE_ERROR: ${e?.message ?? String(e)}`,
      );
    }

    const text = extractTextFromOpenRouterResponse(data);
    const trimmed = text.trim();

    if (!trimmed) {
      // 真的完全冇文字才會走到這裡
      console.error('[openrouter empty content AFTER brute force]', {
        model: opts.model,
        dataSnippet: JSON.stringify(data).slice(0, 800),
      });
      throw new Error('OPENROUTER_EMPTY_CONTENT');
    }

    return trimmed;
  } catch (error: any) {
    // 這裡會捕獲網路錯誤 / 超時 / AbortError 等
    console.error('[callLLM error]', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      cause: error?.cause,
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
