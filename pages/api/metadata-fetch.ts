// API端点：文献元数据抓取
import { NextApiRequest, NextApiResponse } from 'next';
import { fetchMetadata, generateChineseSummaryPrompt } from '@/lib/metadataFetcher';
import { callLLM } from '@/lib/ai';

type ResBody = {
  success: boolean;
  metadata?: any;
  chineseSummary?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResBody>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { title, doi } = req.body;

  if (!title && !doi) {
    return res.status(400).json({ error: 'Title or DOI is required' });
  }

  try {
    console.log(`开始抓取文献元数据 - DOI: ${doi}, Title: ${title}`);

    // 1. 抓取元数据
    const metadata = await fetchMetadata({ title, doi });
    
    console.log('元数据抓取结果:', {
      title: metadata.title,
      hasAbstract: !!metadata.abstract,
      abstractSource: metadata.abstract_source,
      summaryMode: metadata.summary_mode,
      sourceTrace: metadata.source_trace
    });

    // 2. 生成中文说明
    let chineseSummary = '';
    if (metadata.title) {
      const prompt = generateChineseSummaryPrompt(metadata);
      
      const llmResponse = await callLLM(
        [{ role: 'user', content: prompt }],
        { 
          model: 'openai/gpt-4', 
          temperature: 0.1, 
          timeoutMs: 30000 
        }
      );
      
      chineseSummary = llmResponse.trim();
      console.log('生成的中文说明:', chineseSummary);
    }

    return res.status(200).json({
      success: true,
      metadata,
      chineseSummary
    });

  } catch (error) {
    console.error('元数据抓取失败:', error);
    return res.status(500).json({
      success: false,
      error: `元数据抓取失败: ${error}`
    });
  }
}
