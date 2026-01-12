# 段落规格系统使用指南

## 概述

段落规格系统（Paragraph Spec System）是一个通用的、可配置的段落生成引擎，允许你通过配置而不是硬编码来定义段落生成规则。

## 基本用法

### 1. 在 API 请求中包含 `spec` 参数

```typescript
const response = await fetch('/api/draft', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'AI 的定义与应用',
    wordCount: 240,
    language: '中文',
    tone: '正式',
    outline: '• 定义 AI\n• 区分强 AI 和弱 AI',
    sectionId: 2,
    spec: {
      targetCount: 240,
      unit: 'zh_chars',
      tolerancePct: 0.1,
      oneParagraph: true,
      paragraphType: 'term_clarification',
      rhetoricalMove: 'define_explain',
      allowCitations: false,
      allowExamples: true,
      bannedTopics: ['industry applications', 'future work'],
      mustInclude: ['definition', 'distinction'],
    },
  }),
});
```

## 规格字段说明

### 必填字段

- **targetCount**: 目标字数/词数
- **unit**: 单位类型
  - `'zh_chars'`: 中文字符数
  - `'chars'`: 字符数（英文）
  - `'words'`: 单词数（英文）
- **tolerancePct**: 容差百分比（0.1 = ±10%）
- **oneParagraph**: 是否单段落
- **paragraphType**: 段落类型（见预设模板）
- **rhetoricalMove**: 修辞动作（见预设模板）

### 可选字段

- **allowLineBreaks**: 是否允许换行（默认 false）
- **allowBullets**: 是否允许条列符号（默认 false）
- **allowHeadings**: 是否允许标题（默认 false）
- **mustInclude**: 必须包含的关键词/短语数组
- **allowedTopics**: 允许讨论的主题（白名单）
- **bannedTopics**: 禁止讨论的主题（黑名单）
- **bannedPatterns**: 禁止的正则表达式模式数组
- **bannedPhrases**: 禁止使用的短语数组
- **allowCitations**: 是否允许引用（默认 false）
- **allowExamples**: 是否允许例子（默认 true）
- **maxExamples**: 最大例子数量

## 预设模板

系统提供了以下预设模板（在 `lib/paragraphSpec.ts` 中）：

- **introduction**: 引言
- **term_clarification**: 术语澄清
- **literature_review**: 文献回顾
- **argument**: 论证段
- **counter_argument**: 反方段
- **method**: 方法段
- **discussion**: 讨论
- **conclusion**: 结论

### 使用预设模板

```typescript
import { PRESET_SPECS } from '@/lib/paragraphSpec';

const spec = {
  ...PRESET_SPECS.term_clarification,
  targetCount: 240,
  unit: 'zh_chars',
  mustInclude: ['AI', '定义', '区分'],
  bannedTopics: ['industry applications'],
};
```

## 验证和修复

系统会自动验证生成的段落是否符合规格：

1. **长度检查**: 是否在目标范围内
2. **格式检查**: 段落数、换行、条列符号等
3. **内容检查**: 是否包含必须内容、是否触犯禁止项

如果验证失败，系统会自动尝试修复（最多 2 次）。

## 示例：术语澄清段落

```typescript
{
  paragraphType: 'term_clarification',
  rhetoricalMove: 'define_explain',
  targetCount: 240,
  unit: 'zh_chars',
  tolerancePct: 0.1,
  oneParagraph: true,
  allowCitations: false,
  allowExamples: true,
  bannedTopics: ['industry applications', 'policy implications', 'future work'],
  bannedPatterns: ['^In conclusion', '\\n\\n', '^•'],
  mustInclude: ['definition', 'scope', 'distinction (A vs B)']
}
```

## 向后兼容

如果没有提供 `spec` 参数，系统会使用原有的硬编码逻辑，保持完全向后兼容。

## 优势

1. **通用性**: 适用于任何题目，不限于 AI
2. **可配置**: 通过配置而非代码定义规则
3. **可扩展**: 轻松添加新的段落类型和约束
4. **质量保证**: 自动验证和修复机制
5. **向后兼容**: 不影响现有代码

