import type { NextApiRequest, NextApiResponse } from 'next';
import { gatherForSection, type GatherOpts } from '@/lib/gather';

// 直接导入 fetch 函数以便直接调用
async function fetchCrossrefDirect(query: string, limit: number, opts: any): Promise<any[]> {
  try {
    // 尝试两种查询方式：先使用 query.bibliographic，如果失败则使用简单 query
    const tryQuery = async (queryParam: string, queryValue: string): Promise<any[] | null> => {
      const u = new URL('https://api.crossref.org/works');
      u.searchParams.set(queryParam, queryValue);
      u.searchParams.set('rows', String(Math.max(3, limit)));
      // 移除不支持的 language 字段
      u.searchParams.set('select', 'title,author,issued,container-title,DOI,URL,type,abstract');
      
      // 语言过滤只有在需要时才添加
      if (opts?.language === 'en') {
        u.searchParams.set('filter', 'language:en');
      }
      
      const url = u.toString();
      console.log(`[Direct CrossRef] 搜索: "${query}", 参数: ${queryParam}, URL: ${url}`);
      
      const r = await fetch(url, { 
        headers: { 
          'User-Agent': 'AssignmentTerminator/1.0 (https://assignment-terminator.example)' 
        } 
      });
      
      if (!r.ok) {
        const errorText = await r.text().catch(() => '');
        console.error(`[Direct CrossRef] HTTP错误 ${r.status}: ${errorText.substring(0, 200)}`);
        return null; // 返回 null 表示失败，可以尝试其他方式
      }
      
      const j: any = await r.json().catch((err: any) => {
        console.error(`[Direct CrossRef] JSON解析错误:`, err);
        return null;
      });
      
      if (!j) return null;
      
      return j?.message?.items ?? [];
    };
    
    // 先尝试 query.bibliographic（更精确）
    let items: any[] | null = await tryQuery('query.bibliographic', query);

    // 如果失败，尝试简单的 query 参数
    if (!items || items.length === 0) {
      console.log(`[Direct CrossRef] 尝试使用简单 query 参数`);
      items = await tryQuery('query', query);
    }
    
    if (!items || items.length === 0) {
      console.log(`[Direct CrossRef] 未找到结果`);
      return [];
    }
    
    console.log(`[Direct CrossRef] 找到 ${items.length} 条结果`);
    
    return items.map((it: any) => ({
      title: (it?.title?.[0] ?? '').trim(),
      authors: (it?.author ?? []).map((a: any) => [a?.given, a?.family].filter(Boolean).join(' ')).filter(Boolean).join('; ') || 'Unknown Author',
      year: it?.issued?.['date-parts']?.[0]?.[0] || new Date().getFullYear(),
      source: it?.['container-title']?.[0] || 'Unknown Source',
      url: (it?.URL ?? '').trim() || (it?.DOI ? `https://doi.org/${it.DOI}` : ''),
      doi: it?.DOI || null,
      summary: (it?.abstract?.[0] || '').replace(/<\/?[^>]+>/g, '') || '',
    })).filter((v: any) => v.title && v.title.length > 5 && v.url);
  } catch (err: any) {
    console.error(`[Direct CrossRef] 错误:`, err?.message || err);
    return [];
  }
}

async function fetchSemanticScholarDirect(query: string, limit: number): Promise<any[]> {
  try {
    const u = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
    u.searchParams.set('query', query);
    u.searchParams.set('limit', String(Math.max(3, limit)));
    // 移除不支持的 language 字段
    u.searchParams.set('fields', 'title,abstract,year,venue,authors,url,externalIds');
    
    const url = u.toString();
    console.log(`[Direct SemanticScholar] 搜索: "${query}", URL: ${url}`);
    
    const headers: Record<string, string> = {};
    const s2Key = process.env.SEMANTIC_SCHOLAR_API_KEY;
    if (s2Key) headers['x-api-key'] = s2Key;
    
    const r = await fetch(url, { headers });
    
    if (!r.ok) {
      const errorText = await r.text().catch(() => '');
      if (r.status === 429) {
        console.warn(`[Direct SemanticScholar] Rate limit exceeded. 等待 2 秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        // 重试一次
        const retryR = await fetch(url, { headers });
        if (!retryR.ok) {
          console.error(`[Direct SemanticScholar] 重试后仍然失败: ${retryR.status}`);
          return [];
        }
        // 如果重试成功，继续处理
        const retryJ: any = await retryR.json().catch(() => ({}));
        const retryItems = retryJ?.data ?? [];
        console.log(`[Direct SemanticScholar] 重试后找到 ${retryItems.length} 条结果`);
        return retryItems.map((it: any) => ({
          title: it?.title || '',
          authors: (it?.authors ?? []).map((a: any) => a?.name).filter(Boolean).join('; ') || 'Unknown Author',
          year: it?.year || new Date().getFullYear(),
          source: it?.venue || 'Semantic Scholar',
          url: it?.url || '',
          doi: it?.externalIds?.DOI || null,
          summary: it?.abstract || '',
        })).filter((v: any) => v.title && v.title.length > 5 && v.url);
      }
      console.error(`[Direct SemanticScholar] HTTP错误: ${r.status} ${r.statusText}, Response: ${errorText.substring(0, 200)}`);
      return [];
    }
    
    const j: any = await r.json().catch((err) => {
      console.error(`[Direct SemanticScholar] JSON解析错误:`, err);
      return {};
    });
    
    const items = j?.data ?? [];
    console.log(`[Direct SemanticScholar] 找到 ${items.length} 条结果`);
    
    return items.map((it: any) => ({
      title: it?.title || '',
      authors: (it?.authors ?? []).map((a: any) => a?.name).filter(Boolean).join('; ') || 'Unknown Author',
      year: it?.year || new Date().getFullYear(),
      source: it?.venue || 'Semantic Scholar',
      url: it?.url || '',
      doi: it?.externalIds?.DOI || null,
      summary: it?.abstract || '',
    })).filter((v: any) => v.title && v.title.length > 5 && v.url);
  } catch (err) {
    console.error(`[Direct SemanticScholar] 错误:`, err);
    return [];
  }
}

// === 核心函數：建議參考文獻 ===
async function suggestReferences(
  keyword: string,
  paperTitle: string,
  pointId: number,
  settings: any
) {
  try {
    console.log(`开始搜索文献 - keyword: "${keyword}", pointId: ${pointId}`);
    
    // 清理关键词：提取引号内的关键词，移除中文和额外内容
    let cleanKeyword = keyword.trim();
    
    // 提取所有引号内的内容
    const quotedKeywords = cleanKeyword.match(/"([^"]+)"/g) || [];
    if (quotedKeywords.length > 0) {
      // 使用引号内的关键词，用空格连接
      cleanKeyword = quotedKeywords.map((q: string) => q.replace(/"/g, '')).join(' ');
    } else {
      // 如果没有引号，尝试移除中文和特殊字符
      cleanKeyword = cleanKeyword
        .replace(/[\u4e00-\u9fff]+/g, ' ') // 移除中文
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // 如果清理后为空，使用原始关键词
    if (!cleanKeyword) {
      cleanKeyword = keyword.replace(/[\u4e00-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    
    console.log(`清理后的关键词: "${cleanKeyword}"`);
    
    // 将用户设置转换为 GatherOpts 格式
    const sourceMap: Record<string, 'crossref' | 'semanticscholar'> = {
      'googlescholar': 'semanticscholar',
      'crossref': 'crossref',
      'semanticscholar': 'semanticscholar',
      'openalex': 'semanticscholar'
    };
    
    let mappedSources: ('crossref' | 'semanticscholar')[] = [];
    if (settings?.sources && Array.isArray(settings.sources) && settings.sources.length > 0) {
      mappedSources = settings.sources
        .map((s: any) => sourceMap[String(s).toLowerCase()])
        .filter((s: any): s is 'crossref' | 'semanticscholar' => !!s);
    }
    
    // 去重并确保至少包含一个来源
    const uniqueSources = Array.from(new Set(mappedSources));
    if (uniqueSources.length === 0) {
      // 默认使用 Semantic Scholar 和 CrossRef（如果没有选择）
      uniqueSources.push('semanticscholar', 'crossref');
    }
    
    const gatherOpts: GatherOpts = {
      need: 10, // 需要更多结果以便过滤
      sources: uniqueSources,
      language: settings?.language === 'en' ? 'en' : undefined,
      yearRange: settings?.yearRange || undefined,
      documentTypes: settings?.documentTypes,
      enableLLMQueryExpand: false, // 关键词已经由AI生成，不需要再次扩展
      enableLLMRerank: false,
      aiTopicLock: false
    };

    console.log('GatherOpts:', JSON.stringify(gatherOpts, null, 2));

    // 直接使用关键词搜索，而不是通过 gatherForSection
    console.log(`开始直接搜索: "${cleanKeyword}"`);
    
    const allRefs: any[] = [];
    
    // 顺序搜索，避免并发导致的 rate limiting
    for (const source of uniqueSources) {
      try {
        let results: any[] = [];
        if (source === 'crossref') {
          results = await fetchCrossrefDirect(cleanKeyword, 10, { language: gatherOpts.language });
          console.log(`[CrossRef] 返回 ${results.length} 条结果`);
        } else if (source === 'semanticscholar') {
          // 添加延迟以避免 rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          results = await fetchSemanticScholarDirect(cleanKeyword, 10);
          console.log(`[SemanticScholar] 返回 ${results.length} 条结果`);
        }
        allRefs.push(...results);
      } catch (error: any) {
        console.error(`数据源 ${source} 失败:`, error?.message || error);
        // 继续尝试其他数据源
      }
    }
    
    console.log(`搜索完成 - 总共找到 ${allRefs.length} 篇文献`);
    
    // 去重：基于标题和URL
    const seen = new Set<string>();
    const uniqueRefs = allRefs.filter((ref) => {
      const key = `${ref.title?.toLowerCase()}-${ref.url?.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log(`去重后剩余 ${uniqueRefs.length} 篇文献`);
    
    const refs = uniqueRefs;

    // 转换格式以匹配前端期望的格式
    const formattedRefs = refs.map((ref: any, index: number) => ({
      id: `ref-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      title: ref.title || '',
      authors: ref.authors || 'Unknown Author',
      year: ref.year || new Date().getFullYear(),
      source: ref.source || 'Unknown Source',
      url: ref.url || '',
      doi: ref.doi || null,
      summary: ref.summary || '',
      citation: ref.doi ? `DOI: ${ref.doi}` : (ref.url || ''),
      keySentences: ref.summary ? [ref.summary.substring(0, 200)] : [],
      credibility: 75 // 默认可信度
    })).filter((ref: any) => ref.title && ref.title.length > 5 && ref.url); // 过滤掉无效的文献

    let filteredRefs = formattedRefs;
    if (settings?.excludeLoginRequiredPublishers) {
      const blockedDomains = [
        'taylorfrancis.com',
        'link.springer.com',
        'springer.com',
        'sciencedirect.com',
        'onlinelibrary.wiley.com',
        'ieeexplore.ieee.org',
        'dl.acm.org',
        'acm.org',  // 添加 acm.org 以匹配所有 ACM 子域名
        'jstor.org'
      ];
      const isBlockedDomain = (url: string) => {
        try {
          const { hostname } = new URL(url);
          // 更严格的匹配：检查精确匹配或子域名匹配
          return blockedDomains.some(domain => {
            // 精确匹配
            if (hostname === domain) return true;
            // 子域名匹配
            if (hostname.endsWith(`.${domain}`)) return true;
            // 对于 acm.org，也要匹配所有子域名
            if (domain === 'acm.org' && hostname.includes('acm.org')) return true;
            return false;
          });
        } catch {
          return false;
        }
      };
      const beforeCount = filteredRefs.length;
      filteredRefs = filteredRefs.filter((ref: any) => !isBlockedDomain(ref.url));
      console.log(`[Filter] 排除需登入出版商: ${beforeCount - filteredRefs.length} / ${beforeCount}`);
    }

    console.log(`格式化后文献数量: ${filteredRefs.length}`);

    return filteredRefs;
  } catch (error) {
    console.error('搜索文獻時發生錯誤:', error);
    return [];
  }
}

// === HTTP API 處理器 ===
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只允許 POST 請求' });
  }

  try {
    const { keyword, outline, paperTitle, pointId, settings } = req.body;
    
    // 支持两种参数格式：keyword（新格式）或 outline（旧格式）
    const searchKeyword = keyword || outline;
    
    if (!searchKeyword) {
      return res.status(400).json({ error: '缺少 keyword 或 outline 參數' });
    }

    const results = await suggestReferences(
      searchKeyword,
      paperTitle || '',
      pointId || 1,
      settings || {}
    );
    
    res.status(200).json(results);
    
  } catch (error: any) {
    console.error('API 錯誤:', error);
    res.status(500).json({ error: `內部服務器錯誤: ${error?.message || 'Unknown error'}` });
  }
}
