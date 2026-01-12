// API端点：从页面URL抓取摘要
import { NextApiRequest, NextApiResponse } from 'next';
import { fetchAbstractFromPage, generateChineseSummaryFromAbstract, generateChineseSummaryFromTitle } from '@/lib/pageAbstractFetcher';
import { callLLM } from '@/lib/ai';

type ResBody = {
  success: boolean;
  abstract?: string | null;
  body_excerpt?: string | null;
  source?: string | null;
  summary_mode?: string;
  chineseSummary?: string;
  // 验证信息
  abstract_length?: number;
  body_length?: number;
  has_abstract?: boolean;
  has_body?: boolean;
  verified?: boolean;
  status?: "verified" | "metadata_only";
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Only GET/POST allowed' });
  }

  const url = req.method === 'GET' ? req.query.url as string : req.body.url;
  const title = req.method === 'GET' ? req.query.title as string : req.body.title;

  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    console.log(`开始抓取页面摘要 - URL: ${url}`);

    // 1. 抓取摘要
    const result = await fetchAbstractFromPage(url);
    
    console.log('页面摘要抓取结果:', {
      hasAbstract: !!result.abstract,
      source: result.source,
      summaryMode: result.summary_mode,
      abstractLength: result.abstract?.length || 0
    });

    // 2. 生成中文概述
    let chineseSummary = '';
    
    if (result.abstract) {
      // 有摘要：基于真实摘要生成
      const prompt = generateChineseSummaryFromAbstract(result.abstract);
      
      const llmResponse = await callLLM(
        [{ role: 'user', content: prompt }],
        { 
          model: 'openai/gpt-4', 
          temperature: 0.1, 
          timeoutMs: 30000 
        }
      );
      
      chineseSummary = llmResponse.trim();
      console.log('基于真实摘要生成的中文概述:', chineseSummary);
    } else if (title) {
      // 无摘要：基于标题生成（带警告）
      const prompt = generateChineseSummaryFromTitle(title);
      
      const llmResponse = await callLLM(
        [{ role: 'user', content: prompt }],
        { 
          model: 'openai/gpt-4', 
          temperature: 0.1, 
          timeoutMs: 30000 
        }
      );
      
      chineseSummary = llmResponse.trim();
      console.log('基于标题生成的中文概述:', chineseSummary);
    }

    // 确定验证状态
    const status: "verified" | "metadata_only" = result.verified ? "verified" : "metadata_only";
    
    return res.status(200).json({
      success: true,
      abstract: result.abstract,
      body_excerpt: result.body_excerpt,
      source: result.source,
      summary_mode: result.summary_mode,
      chineseSummary,
      // 验证信息
      abstract_length: result.abstract_length,
      body_length: result.body_length,
      has_abstract: result.has_abstract,
      has_body: result.has_body,
      verified: result.verified,
      status
    });

  } catch (error) {
    console.error('页面摘要抓取失败:', error);
    return res.status(500).json({
      success: false,
      error: `页面摘要抓取失败: ${error}`
    });
  }
}
