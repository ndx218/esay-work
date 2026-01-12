# OpenRouter 模型映射指南

## ✅ 正确的 Chat Completion 模型（推荐使用）

### OpenAI 系列
```
openai/gpt-4o-mini          # 快速、便宜、质量好（推荐）
openai/gpt-4o               # 高质量
openai/gpt-4.1-mini         # 最新版本
openai/gpt-4.1              # 最新版本，高质量
openai/gpt-4.1-preview      # 预览版
```

### Anthropic Claude 系列
```
anthropic/claude-3.5-sonnet    # 顶级质量（推荐）
anthropic/claude-3.5-haiku     # 快速版本
anthropic/claude-3-opus        # 最强版本
```

### Google Gemini 系列
```
google/gemini-2.0-flash-exp    # 最新快速版本
google/gemini-pro              # 标准版本
google/gemini-1.5-pro          # 高质量版本
```

### xAI Grok 系列
```
x-ai/grok-code-fast-1         # 代码专用
x-ai/grok-beta                # 通用版本
```

## ❌ 不要使用的模型（会返回乱码）

### Embedding 模型（不支援 chat）
```
openai/gpt-embedding-*
text-embedding-*
```

### Base 模型（只输出 logits/tokens）
```
oai:gpt-4o-mini-base
oai:gpt-4o-base
oai:gpt-base
*-base
```

### Token 模型
```
*-token
*-logit
```

## 🔧 环境变量配置示例

在 `.env.local` 中设置：

```env
# 推荐配置
OPENROUTER_GPT5_MODEL=openai/gpt-4o-mini
OPENROUTER_CLAUDE_SONNET_45_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_GEMINI3_PRO_MODEL=google/gemini-2.0-flash-exp
OPENROUTER_FALLBACK_MODEL=openai/gpt-4o-mini
OPENROUTER_GPT35_MODEL=openai/gpt-4o-mini
```

## 📝 当前代码中的映射

- UI "GPT-5" → `openai/gpt-4o-mini` (因为 GPT-5 未公开)
- UI "Claude Sonnet 4.5" → `anthropic/claude-3.5-sonnet`
- UI "Gemini 3 Pro" → `google/gemini-2.0-flash-exp`
- Fallback → `openai/gpt-4o-mini`

## 🐛 调试提示

如果看到 base64/乱码输出，检查：
1. 服务器日志中的 `[callLLM] 发送请求到 OpenRouter: { model: "???" }`
2. 确认 model ID 不包含 `embedding`、`base`、`token` 等关键词
3. 使用上面列出的正确模型 ID

