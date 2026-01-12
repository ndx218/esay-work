// 测试脚本：查看 /api/draft 的实际响应
// 使用方法：node test-draft-api.js

const fetch = require('node-fetch');

async function testDraftAPI() {
  const url = 'http://localhost:3002/api/draft';
  
  // 最小化的测试请求
  const testBody = {
    title: '测试标题',
    wordCount: 200,
    language: '中文',
    tone: '正式',
    outline: '一、引言\n- 介绍主题\n- 说明重要性',
    sectionId: 1,
    mode: 'gpt-5'
  };

  try {
    console.log('📤 发送请求到:', url);
    console.log('📋 请求体:', JSON.stringify(testBody, null, 2));
    console.log('\n---\n');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testBody),
    });

    console.log('📥 响应状态:', response.status, response.statusText);
    console.log('📋 响应头:', Object.fromEntries(response.headers.entries()));
    console.log('\n---\n');

    const responseText = await response.text();
    console.log('📄 原始响应文本:');
    console.log(responseText);
    console.log('\n---\n');

    try {
      const responseJson = JSON.parse(responseText);
      console.log('✅ JSON 解析成功:');
      console.log(JSON.stringify(responseJson, null, 2));
      
      if (responseJson.draft) {
        console.log('\n📝 Draft 内容长度:', responseJson.draft.length);
        console.log('📝 Draft 内容预览:', responseJson.draft.substring(0, 200));
      }
      if (responseJson.error) {
        console.log('\n❌ 错误信息:', responseJson.error);
      }
    } catch (e) {
      console.log('❌ JSON 解析失败:', e.message);
      console.log('原始文本前500字符:', responseText.substring(0, 500));
    }

  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    console.error('错误详情:', error);
  }
}

// 运行测试
testDraftAPI();

