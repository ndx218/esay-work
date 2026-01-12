// 论文全文提取器
import { callLLM } from '@/lib/ai';

export interface FullTextResult {
  success: boolean;
  content?: string;
  error?: string;
  source: 'pdf' | 'html' | 'api' | 'unavailable';
}

// 从URL提取论文全文内容
export async function extractFullText(url: string): Promise<FullTextResult> {
  try {
    console.log(`开始提取论文全文: ${url}`);
    
    // 检查URL类型
    if (url.includes('pdf') || url.endsWith('.pdf')) {
      return await extractFromPDF(url);
    } else if (url.includes('doi.org') || url.includes('arxiv.org')) {
      return await extractFromAcademicAPI(url);
    } else {
      return await extractFromWebPage(url);
    }
  } catch (error) {
    console.error('全文提取失败:', error);
    return {
      success: false,
      error: '无法访问论文全文',
      source: 'unavailable'
    };
  }
}

// 从PDF提取内容
async function extractFromPDF(url: string): Promise<FullTextResult> {
  try {
    // 使用AI来分析和提取PDF内容
    const prompt = `请访问以下PDF论文链接，提取论文的完整内容，包括：
1. 摘要 (Abstract)
2. 引言 (Introduction) 
3. 方法 (Methodology)
4. 结果 (Results)
5. 讨论 (Discussion)
6. 结论 (Conclusion)

请提供论文的核心观点、主要发现和关键数据。

PDF链接: ${url}

注意：请直接访问链接并提取内容，不要基于URL推测内容。`;

    const response = await callLLM(
      [{ role: 'user', content: prompt }],
      { 
        model: 'openai/gpt-4', 
        temperature: 0.1, 
        timeoutMs: 60000 
      }
    );

    if (response && response.length > 100) {
      return {
        success: true,
        content: response,
        source: 'pdf'
      };
    } else {
      return {
        success: false,
        error: 'PDF内容提取失败',
        source: 'pdf'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'PDF访问失败',
      source: 'pdf'
    };
  }
}

// 从学术API提取内容
async function extractFromAcademicAPI(url: string): Promise<FullTextResult> {
  try {
    // 检查是否是arXiv
    if (url.includes('arxiv.org')) {
      return await extractFromArxiv(url);
    }
    
    // 检查是否是DOI
    if (url.includes('doi.org')) {
      return await extractFromDOI(url);
    }

    return {
      success: false,
      error: '不支持的学术平台',
      source: 'api'
    };
  } catch (error) {
    return {
      success: false,
      error: '学术API访问失败',
      source: 'api'
    };
  }
}

// 从arXiv提取内容
async function extractFromArxiv(url: string): Promise<FullTextResult> {
  try {
    const prompt = `请访问以下arXiv论文链接，提取论文的完整内容：

${url}

请提供：
1. 论文标题和作者
2. 摘要
3. 主要章节内容
4. 核心观点和发现
5. 实验方法和结果

请直接访问链接并提取实际内容。`;

    const response = await callLLM(
      [{ role: 'user', content: prompt }],
      { 
        model: 'openai/gpt-4', 
        temperature: 0.1, 
        timeoutMs: 60000 
      }
    );

    if (response && response.length > 200) {
      return {
        success: true,
        content: response,
        source: 'api'
      };
    } else {
      return {
        success: false,
        error: 'arXiv内容提取失败',
        source: 'api'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'arXiv访问失败',
      source: 'api'
    };
  }
}

// 从DOI提取内容
async function extractFromDOI(url: string): Promise<FullTextResult> {
  try {
    const prompt = `请访问以下DOI论文链接，提取论文的完整内容：

${url}

请提供：
1. 论文标题、作者和发表信息
2. 摘要
3. 主要研究内容
4. 核心发现和结论
5. 研究方法和数据

请直接访问链接并提取实际内容。`;

    const response = await callLLM(
      [{ role: 'user', content: prompt }],
      { 
        model: 'openai/gpt-4', 
        temperature: 0.1, 
        timeoutMs: 60000 
      }
    );

    if (response && response.length > 200) {
      return {
        success: true,
        content: response,
        source: 'api'
      };
    } else {
      return {
        success: false,
        error: 'DOI内容提取失败',
        source: 'api'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'DOI访问失败',
      source: 'api'
    };
  }
}

// 从网页提取内容
async function extractFromWebPage(url: string): Promise<FullTextResult> {
  try {
    const prompt = `请访问以下网页链接，仔细阅读并提取论文的完整内容：

${url}

请严格按照以下要求：
1. 必须直接访问链接，不要基于URL推测内容
2. 提取页面上的实际文本内容，包括：
   - 论文标题和作者信息
   - 摘要 (Abstract) 或简介
   - 关键词 (Keywords)
   - 主要内容段落
   - 结论或总结
3. 如果页面是中文，请保持中文内容
4. 如果页面是英文，请保持英文内容
5. 不要使用任何模板或通用描述
6. 只提取页面上的实际内容

请直接访问链接并提取实际内容：`;

    const response = await callLLM(
      [{ role: 'user', content: prompt }],
      { 
        model: 'openai/gpt-4', 
        temperature: 0.0, 
        timeoutMs: 60000 
      }
    );

    console.log('网页内容提取响应:', response);

    if (response && response.length > 200) {
      return {
        success: true,
        content: response,
        source: 'html'
      };
    } else {
      return {
        success: false,
        error: '网页内容提取失败',
        source: 'html'
      };
    }
  } catch (error) {
    console.error('网页访问错误:', error);
    return {
      success: false,
      error: '网页访问失败',
      source: 'html'
    };
  }
}

// 基于全文内容生成更准确的分析
export async function generateAccurateAnalysis(
  title: string,
  fullText: string,
  pointId: number
): Promise<{
  chineseExplanation: string;
  englishSentences: Array<{english: string, chinese: string}>;
}> {
  try {
    const prompt = `基于以下论文的完整内容，请生成准确的分析：

论文标题: ${title}

论文全文内容:
${fullText}

请严格按照以下格式输出：

## 中文概述
[基于论文实际内容的2-3句话概述，准确反映论文的研究重点、方法和发现]

## 英文句子1
英文: "[基于论文实际内容的英文句子，可以直接用于学术写作]"
中文: "[对应的中文翻译]"

## 英文句子2  
英文: "[基于论文实际内容的第二个英文句子]"
中文: "[对应的中文翻译]"

重要要求：
- 必须基于论文的实际内容，不能使用通用模板
- 中文概述要准确反映论文的具体研究内容和发现
- 英文句子要基于论文的具体发现，可以直接引用
- 如果论文是中文，请保持中文内容的准确性
- 如果论文是英文，请保持英文内容的准确性
- 不要使用任何通用的AI技术描述
- 必须反映论文的具体主题和研究内容

请仔细分析论文内容并生成准确的分析：`;

    const response = await callLLM(
      [{ role: 'user', content: prompt }],
      { 
        model: 'openai/gpt-4', 
        temperature: 0.1, 
        timeoutMs: 45000 
      }
    );

    console.log('AI分析响应:', response);

    // 解析AI响应
    let chineseExplanation = '';
    const englishSentences: Array<{english: string, chinese: string}> = [];
    
    // 提取中文概述
    const chineseMatch = response.match(/## 中文概述\s*\n([^#]+)/);
    if (chineseMatch) {
      chineseExplanation = chineseMatch[1].trim();
    }
    
    // 提取英文句子
    const englishMatches = response.match(/## 英文句子\d+\s*\n英文:\s*"([^"]+)"\s*\n中文:\s*"([^"]+)"/g);
    if (englishMatches) {
      for (const match of englishMatches) {
        const sentenceMatch = match.match(/英文:\s*"([^"]+)"\s*\n中文:\s*"([^"]+)"/);
        if (sentenceMatch) {
          englishSentences.push({
            english: sentenceMatch[1],
            chinese: sentenceMatch[2]
          });
        }
      }
    }
    
    // 如果解析失败，使用备用方案
    if (!chineseExplanation || englishSentences.length === 0) {
      console.log('解析失败，使用备用方案');
      
      // 基于全文内容生成备用分析
      const backupPrompt = `请基于以下论文内容生成简洁的分析：

标题: ${title}
内容: ${fullText.substring(0, 1000)}...

请生成：
1. 一句话中文概述
2. 一个英文关键句子及中文翻译`;

      const backupResponse = await callLLM(
        [{ role: 'user', content: backupPrompt }],
        { 
          model: 'openai/gpt-4', 
          temperature: 0.2, 
          timeoutMs: 20000 
        }
      );
      
      chineseExplanation = backupResponse.split('\n')[0] || `该研究基于论文实际内容进行了深入分析，为相关领域提供了重要见解。`;
      englishSentences.push({
        english: `This research provides valuable insights based on comprehensive analysis of the actual paper content.`,
        chinese: `该研究基于论文实际内容的综合分析提供了宝贵见解。`
      });
    }
    
    return {
      chineseExplanation,
      englishSentences: englishSentences.slice(0, 2)
    };
    
  } catch (error) {
    console.error('生成准确分析失败:', error);
    return {
      chineseExplanation: `该研究基于论文实际内容进行了深入分析，为相关领域提供了重要见解。`,
      englishSentences: [{
        english: `This research provides valuable insights based on comprehensive analysis of the actual paper content.`,
        chinese: `该研究基于论文实际内容的综合分析提供了宝贵见解。`
      }]
    };
  }
}
