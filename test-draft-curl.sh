#!/bin/bash
# 测试 /api/draft 的响应
# 使用方法：bash test-draft-curl.sh

echo "📤 发送请求到 /api/draft..."
echo ""

curl -X POST http://localhost:3002/api/draft \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试标题",
    "wordCount": 200,
    "language": "中文",
    "tone": "正式",
    "outline": "一、引言\n- 介绍主题\n- 说明重要性",
    "sectionId": 1,
    "mode": "gpt-5"
  }' \
  -w "\n\n---\n状态码: %{http_code}\n响应时间: %{time_total}s\n" \
  -v 2>&1 | tee draft-response.log

echo ""
echo "✅ 响应已保存到 draft-response.log"

