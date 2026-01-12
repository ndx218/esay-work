import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLM } from '@/lib/ai';

type ResBody = {
  success: boolean;
  keywords?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Only POST allowed' });
  }

  const { bulletPoint, pointId, outlineTitle } = req.body;

  if (!bulletPoint) {
    return res.status(400).json({ success: false, error: 'bulletPoint is required' });
  }

  try {
    console.log(`开始生成关键词 - bulletPoint: "${bulletPoint}", pointId: ${pointId}`);

    const prompt = `You are an academic research assistant. Generate search keywords for academic databases (like Google Scholar, Semantic Scholar, Crossref, etc.) based on the following bullet point.

Bullet point content: "${bulletPoint}"
${outlineTitle ? `Paper title context: "${outlineTitle}"` : ''}
${pointId ? `Section ID: ${pointId}` : ''}

Requirements:
1. Generate EXACTLY 3 English keyword phrases suitable for academic search
2. Each phrase should be 2-4 words and wrapped in double quotes
3. Multi-word phrases must be kept together as a single unit (e.g., "website structure" not "website" and "structure")
4. Phrases should be relevant to the bullet point content
5. Use academic terminology appropriate for scholarly databases
6. Return ONLY the keywords in this format: "keyword1" "keyword2" "keyword3"
7. Do not include any explanations or additional text
8. Do not split multi-word phrases - keep them together in quotes

Example output format:
"website structure" "web development" "basic concepts"

Important: Each phrase must be a meaningful unit. If the bullet point mentions "website structure", it should be ONE keyword "website structure", NOT two separate keywords "website" and "structure".

Now generate keywords for: "${bulletPoint}"`;

    const keywords = await callLLM(
      [{ role: 'user', content: prompt }],
      { 
        model: 'openai/gpt-3.5-turbo',
        temperature: 0.3,
        timeoutMs: 15000,
        maxTokens: 100
      }
    );

    // 清理输出，确保格式正确
    // 提取所有带引号的关键词短语
    const quotedKeywords: string[] = [];
    const regex = /"([^"]+)"/g;
    let match;
    while ((match = regex.exec(keywords)) !== null) {
      const keyword = match[1].trim();
      if (keyword.length > 0) {
        quotedKeywords.push(keyword);
      }
    }
    
    // 限制为最多3个关键词
    const limitedKeywords = quotedKeywords.slice(0, 3);
    
    // 如果提取到关键词，使用它们
    let finalKeywords = '';
    if (limitedKeywords.length > 0) {
      finalKeywords = limitedKeywords.map(k => `"${k}"`).join(' ');
    } else {
      // 如果没有找到带引号的关键词，尝试从原始文本中提取
      const cleaned = keywords
        .trim()
        .replace(/^["']|["']$/g, '')
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleaned.length > 0) {
        // 尝试智能分割：优先保留多词短语
        // 先尝试按常见分隔符分割，但不要过度分割
        const parts = cleaned.split(/[,;]/).map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length > 0 && parts.length <= 3) {
          finalKeywords = parts.slice(0, 3).map(p => `"${p}"`).join(' ');
        } else {
          // 如果分割后太多，只取前3个单词作为单个关键词
          const words = cleaned.split(/\s+/).filter(w => w.length > 2);
          if (words.length > 0) {
            // 将前几个词组合成一个关键词
            const firstKeyword = words.slice(0, Math.min(3, words.length)).join(' ');
            finalKeywords = `"${firstKeyword}"`;
          } else {
            finalKeywords = `"${cleaned}"`;
          }
        }
      } else {
        finalKeywords = `"${bulletPoint}"`;
      }
    }

    console.log(`生成的关键词 (限制为3个): ${finalKeywords}`);

    return res.status(200).json({
      success: true,
      keywords: finalKeywords || `"${bulletPoint}"`
    });

  } catch (error: any) {
    console.error('生成关键词失败:', error);
    return res.status(500).json({
      success: false,
      error: `生成关键词失败: ${error?.message || 'Unknown error'}`
    });
  }
}
