# OpenRouter 顶级模型列表

## 🏆 最高质量模型（推荐用于学术写作）

### 1. OpenAI 系列（顶级质量）

#### GPT-4.1 系列（最新、最强）
```
openai/gpt-4.1              # 最强版本，质量最高（最贵）
openai/gpt-4.1-mini          # 4.1 的快速版本，性价比高（推荐）
openai/gpt-4.1-preview       # 预览版本
```

#### GPT-4o 系列（高质量）
```
openai/gpt-4o                # 高质量，平衡性能和成本（推荐）
openai/gpt-4o-mini           # 快速版本，性价比极高（当前默认）
openai/gpt-4o-2024-08-06     # 特定版本
```

#### GPT-4 Turbo 系列
```
openai/gpt-4-turbo           # 高质量长文本
openai/gpt-4-0125-preview    # 预览版本
```

### 2. Anthropic Claude 系列（顶级质量）

#### Claude 3.5 系列（最强）
```
anthropic/claude-3.5-sonnet     # 最强版本，顶级质量（强烈推荐）
anthropic/claude-3.5-haiku      # 快速版本，质量也很好
anthropic/claude-3-opus-20240229 # Opus 版本（最强但最贵）
```

#### Claude 3 系列
```
anthropic/claude-3-opus         # 最强版本
anthropic/claude-3-sonnet       # 高质量版本
anthropic/claude-3-haiku        # 快速版本
```

### 3. Google Gemini 系列（高质量）

#### Gemini 2.0 系列（最新）
```
google/gemini-2.0-flash-exp     # 最新快速版本（当前配置）
google/gemini-2.0-flash-thinking-exp # 思考版本
```

#### Gemini 1.5 系列
```
google/gemini-1.5-pro           # 高质量版本
google/gemini-1.5-flash         # 快速版本
google/gemini-pro               # 标准版本
```

### 4. 其他高质量模型

```
x-ai/grok-beta                  # Grok 通用版本
x-ai/grok-2-vision-1212         # Grok 2 视觉版本
meta-llama/llama-3.1-405b-instruct # Llama 3.1 405B（开源最强）
```

## 💰 价格参考（相对）

| 模型 | 质量 | 速度 | 价格 | 推荐场景 |
|------|------|------|------|----------|
| `openai/gpt-4.1` | ⭐⭐⭐⭐⭐ | 慢 | 最贵 | 最重要文档 |
| `anthropic/claude-3.5-sonnet` | ⭐⭐⭐⭐⭐ | 中 | 贵 | 高质量学术写作 |
| `openai/gpt-4o` | ⭐⭐⭐⭐ | 快 | 中 | 平衡选择 |
| `openai/gpt-4.1-mini` | ⭐⭐⭐⭐ | 快 | 中 | 性价比高 |
| `openai/gpt-4o-mini` | ⭐⭐⭐ | 很快 | 便宜 | 当前默认 |
| `google/gemini-2.0-flash-exp` | ⭐⭐⭐⭐ | 很快 | 便宜 | 快速生成 |

## 🎯 推荐配置

### 方案 1：最高质量（不考虑成本）
```env
OPENROUTER_GPT5_MODEL=openai/gpt-4.1
OPENROUTER_CLAUDE_SONNET_45_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_GEMINI3_PRO_MODEL=google/gemini-1.5-pro
```

### 方案 2：平衡质量和成本（推荐）
```env
OPENROUTER_GPT5_MODEL=openai/gpt-4.1-mini
OPENROUTER_CLAUDE_SONNET_45_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_GEMINI3_PRO_MODEL=google/gemini-2.0-flash-exp
```

### 方案 3：性价比优先（当前配置）
```env
OPENROUTER_GPT5_MODEL=openai/gpt-4o-mini
OPENROUTER_CLAUDE_SONNET_45_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_GEMINI3_PRO_MODEL=google/gemini-2.0-flash-exp
```

## 📝 如何更新配置

1. 创建或编辑 `.env.local` 文件
2. 添加上述环境变量
3. 重启开发服务器：`npm run dev`

## ⚠️ 注意事项

- 所有模型 ID 必须支持 `chat/completions` endpoint
- 不要使用 embedding、base、token 模型
- 价格会根据 OpenRouter 实时调整
- 某些模型可能有速率限制

