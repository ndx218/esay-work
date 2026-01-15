// 英文only文献元数据抓取系统
// 严格按照最终指令实现：只接受英文摘要，非英文摘要一律视为无摘要
import fetch from "node-fetch";
import * as cheerio from "cheerio";

export type EnglishMetaOut = {
  title: string | null;
  abstract: string | null;        // MUST be English; otherwise null
  authors: string[];
  venue: string | null;
  year: number | null;
  doi: string | null;
  abstract_source: "SemanticScholar" | "Unpaywall" | "DOI_Landing" | "OpenAlex" | null;
  summary_mode: "AI_from_abstract" | "AI_from_metadata_only";
  source_trace: Array<{name: string; ok: boolean; fields: string[]}>;
};

const UA = "Mozilla/5.0 (MetadataFetcher; +assignment-terminator)";
const ALLOW_AI_FALLBACK = false;  // 🚫 严禁AI补全摘要

// 英文检测函数
function langIsEnglish(text: string): boolean {
  if (!text || text.length < 16) {
    return false;
  }
  
  // 极简英语检测：英文字母比例 + 无大量CJK
  const cjk = text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || [];
  const latin = text.match(/[A-Za-z]/g) || [];
  const allWords = text.match(/\w/g) || [];
  
  return latin.length >= 0.5 * Math.max(1, allWords.length) && cjk.length === 0;
}

// 清理文本函数
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().substring(0, 5000);
}

// 验证摘要有效性
function validAbstract(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  
  // 长度检查：至少50字符
  if (trimmed.length < 50) return false;
  
  // 杂讯检查：排除导航、版权等内容
  const noise = [
    'cookie', 'subscribe', 'newsletter', 'rights reserved', 
    'ieee xplore', 'springerlink', 'click here', 'read more',
    'table of contents', 'download pdf', 'view article'
  ];
  const lowerText = trimmed.toLowerCase();
  return !noise.some(n => lowerText.includes(n));
}

// 作者信息标准化函数
function normalizeAuthorsCrossRef(item: any): string[] {
  const a = item?.author || [];
  return a.map((x: any) => `${x.given || ''} ${x.family || ''}`.trim()).filter(Boolean);
}

function normalizeAuthorsS2(a: any[]): string[] {
  return (a || []).map(x => x?.name).filter(Boolean);
}

function normalizeAuthorsOpenAlex(work: any): string[] {
  const a = work?.authorships || [];
  return a.map((x: any) => x?.author?.display_name).filter(Boolean);
}

// 从JSON-LD中提取摘要
function parseJsonLdForAbstract($: cheerio.CheerioAPI): string | null {
  const scripts = $('script[type="application/ld+json"]');
  
  for (let i = 0; i < scripts.length; i++) {
    try {
      const scriptContent = $(scripts[i]).html();
      if (!scriptContent) continue;
      
      const data = JSON.parse(scriptContent);
      
      // 处理单个对象
      if (typeof data === 'object' && !Array.isArray(data)) {
        const candidate = data.description || data.abstract;
        if (candidate && validAbstract(candidate)) {
          return cleanText(candidate);
        }
      }
      
      // 处理数组
      if (Array.isArray(data)) {
        for (const item of data) {
          if (typeof item === 'object') {
            const candidate = item.description || item.abstract;
            if (candidate && validAbstract(candidate)) {
              return cleanText(candidate);
            }
          }
        }
      }
    } catch (error) {
      // JSON解析失败，继续下一个
      continue;
    }
  }
  
  return null;
}

// DOI Landing页面摘要抓取（强化版）
async function doiLandingAbstract(doi: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, { 
      headers: { "User-Agent": UA }, 
      redirect: "follow" as any 
    });
    const html = await resp.text();
    const $ = cheerio.load(html);
    
    // 1) 常见meta标签（按优先级排序）
    const candidates = [
      'meta[name="citation_abstract"]',
      'meta[name="dc.Description"]',
      'meta[name="DC.Description"]',
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]',
      'meta[property="article:description"]'
    ];
    
    for (const sel of candidates) {
      const content = $(sel).attr('content');
      if (content) {
        const cleaned = cleanText(content);
        if (validAbstract(cleaned)) {
          console.log(`从meta标签提取摘要: ${sel}, 长度: ${cleaned.length}`);
          return cleaned;
        }
      }
    }
    
    // 2) JSON-LD结构化数据
    const jsonLdAbstract = parseJsonLdForAbstract($);
    if (jsonLdAbstract) {
      console.log(`从JSON-LD提取摘要, 长度: ${jsonLdAbstract.length}`);
      return jsonLdAbstract;
    }
    
    console.log(`DOI Landing未找到有效摘要: ${doi}`);
    return null;
  } catch (error) {
    console.log(`DOI Landing访问失败: ${doi}`, error);
    return null;
  }
}

// 主要英文元数据抓取函数
export async function fetchEnglishMetadata({ title, doi }: { title?: string; doi?: string; }): Promise<EnglishMetaOut> {
  const out: EnglishMetaOut = {
    title: null,
    abstract: null,        // MUST be English; otherwise null
    authors: [],
    venue: null,
    year: null,
    doi: doi || null,
    abstract_source: null,
    summary_mode: "AI_from_metadata_only",
    source_trace: []
  };

  console.log(`开始抓取英文元数据 - DOI: ${doi}, Title: ${title}`);

  // 1) CrossRef (DOI > title)
  try {
    if (doi) {
      const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { 
        headers: { "User-Agent": UA } 
      });
      if (r.ok) {
        const j = await r.json() as any;
        const m = j?.message;
        out.title = out.title || (Array.isArray(m?.title) ? m.title[0] : m?.title);
        out.authors = out.authors.length ? out.authors : normalizeAuthorsCrossRef(m);
        out.venue = out.venue || m?.["container-title"]?.[0] || m?.publisher;
        out.year = out.year || (m?.issued?.["date-parts"]?.[0]?.[0] ?? null);
        out.doi = out.doi || m?.DOI || null;
        out.source_trace.push({ name: "CrossRef", ok: true, fields: ["title", "authors", "venue", "year", "doi"] });
        console.log(`CrossRef成功 - 标题: ${out.title}`);
      } else {
        out.source_trace.push({ name: "CrossRef", ok: false, fields: [] });
        console.log(`CrossRef失败 - 状态: ${r.status}`);
      }
    }
    
    if (!out.title && title) {
      const r = await fetch(`https://api.crossref.org/works?query.title=${encodeURIComponent(title)}&rows=3`, { 
        headers: { "User-Agent": UA } 
      });
      if (r.ok) {
        const j = await r.json() as any;
        const item = j?.message?.items?.[0];
        if (item) {
          out.title = (Array.isArray(item?.title) ? item.title[0] : item?.title) || out.title;
          out.authors = out.authors.length ? out.authors : normalizeAuthorsCrossRef(item);
          out.venue = out.venue || item?.["container-title"]?.[0] || item?.publisher;
          out.year = out.year || (item?.issued?.["date-parts"]?.[0]?.[0] ?? null);
          out.doi = out.doi || item?.DOI || null;
          out.source_trace.push({ name: "CrossRef", ok: true, fields: ["title", "authors", "venue", "year", "doi"] });
          console.log(`CrossRef标题搜索成功 - 标题: ${out.title}`);
        } else {
          out.source_trace.push({ name: "CrossRef", ok: false, fields: [] });
        }
      }
    }
  } catch (error) {
    out.source_trace.push({ name: "CrossRef", ok: false, fields: [] });
    console.log(`CrossRef异常:`, error);
  }

  // 2) Semantic Scholar (fill abstract/authors/year/venue)
  try {
    const q = out.doi 
      ? `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(out.doi)}?fields=title,abstract,authors,year,venue,doi`
      : `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(title || out.title || "")}&fields=title,abstract,authors,year,venue,doi&limit=1`;
    
    const r = await fetch(q, { headers: { "User-Agent": UA } });
    if (r.ok) {
      const j = await r.json() as any;
      const paper = out.doi ? j : (j?.data?.[0] || null);
      if (paper) {
        // 关键：只接受英文摘要 + 验证有效性
        const absRaw = paper.abstract;
        let absEn: string | null = null;
        
        if (absRaw) {
          const cleaned = cleanText(absRaw);
          if (langIsEnglish(cleaned) && validAbstract(cleaned)) {
            absEn = cleaned;
          }
        }
        
        if (absEn) {
          out.abstract = absEn;
          out.abstract_source = "SemanticScholar";
          console.log(`Semantic Scholar成功获取英文摘要 - 长度: ${absEn.length}`);
        } else if (absRaw) {
          console.log(`Semantic Scholar摘要无效或非英文，已丢弃 - 长度: ${absRaw.length}`);
        }
        
        out.title = out.title || paper.title || null;
        out.authors = out.authors.length ? out.authors : normalizeAuthorsS2(paper.authors);
        out.venue = out.venue || paper.venue || null;
        out.year = out.year || paper.year || null;
        out.doi = out.doi || paper.doi || null;
        out.source_trace.push({ name: "SemanticScholar", ok: true, fields: Object.keys(paper) });
      } else {
        out.source_trace.push({ name: "SemanticScholar", ok: false, fields: [] });
      }
    } else {
      out.source_trace.push({ name: "SemanticScholar", ok: false, fields: [] });
      console.log(`Semantic Scholar失败 - 状态: ${r.status}`);
    }
  } catch (error) {
    out.source_trace.push({ name: "SemanticScholar", ok: false, fields: [] });
    console.log(`Semantic Scholar异常:`, error);
  }

  // 3) OpenAlex (fill DOI/year/venue)
  try {
    const q = out.doi 
      ? `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(out.doi)}`
      : `https://api.openalex.org/works?search=${encodeURIComponent(title || out.title || "")}&per-page=1`;
    
    const r = await fetch(q, { headers: { "User-Agent": UA } });
    if (r.ok) {
      const j = await r.json() as any;
      const work = out.doi ? j : (j?.results?.[0] || null);
      if (work) {
        out.title = out.title || work.display_name || null;
        out.year = out.year || work.publication_year || null;
        out.doi = out.doi || (work.doi ? work.doi.replace(/^https?:\/\/doi\.org\//i, "") : null);
        out.authors = out.authors.length ? out.authors : normalizeAuthorsOpenAlex(work);
        if (!out.venue) {
          const loc = work?.primary_location;
          out.venue = loc?.source?.display_name || out.venue;
        }
        out.source_trace.push({ name: "OpenAlex", ok: true, fields: ["display_name", "publication_year", "doi", "authorships", "primary_location"] });
        console.log(`OpenAlex成功 - 标题: ${out.title}`);
      } else {
        out.source_trace.push({ name: "OpenAlex", ok: false, fields: [] });
      }
    } else {
      out.source_trace.push({ name: "OpenAlex", ok: false, fields: [] });
      console.log(`OpenAlex失败 - 状态: ${r.status}`);
    }
  } catch (error) {
    out.source_trace.push({ name: "OpenAlex", ok: false, fields: [] });
    console.log(`OpenAlex异常:`, error);
  }

  // 4) Unpaywall (by DOI)
  try {
    if (out.doi && !out.abstract) {
      const r = await fetch(`https://api.unpaywall.org/v2/${out.doi}?email=assignment-terminator@example.com`, { 
        headers: { "User-Agent": UA } 
      });
      if (r.ok) {
        const j = await r.json() as any;
        out.source_trace.push({ name: "Unpaywall", ok: true, fields: Object.keys(j) });
        console.log(`Unpaywall成功 - DOI: ${out.doi}`);
      } else {
        out.source_trace.push({ name: "Unpaywall", ok: false, fields: [] });
      }
    }
  } catch (error) {
    out.source_trace.push({ name: "Unpaywall", ok: false, fields: [] });
    console.log(`Unpaywall异常:`, error);
  }

  // 5) DOI Landing (parse HTML meta + JSON-LD)
  if (out.doi && !out.abstract) {
    const absRaw = await doiLandingAbstract(out.doi);
    
    if (absRaw) {
      // 验证英文和有效性
      if (langIsEnglish(absRaw) && validAbstract(absRaw)) {
        out.abstract = absRaw;
        out.abstract_source = "DOI_Landing";
        console.log(`DOI Landing成功获取有效英文摘要 - 长度: ${absRaw.length}`);
        out.source_trace.push({ 
          name: "DOI_Landing", 
          ok: true, 
          fields: ["citation_abstract", "og:description", "description", "json-ld"] 
        });
      } else {
        console.log(`DOI Landing摘要无效或非英文，已丢弃 - 长度: ${absRaw.length}`);
        out.source_trace.push({ name: "DOI_Landing", ok: false, fields: [] });
      }
    } else {
      out.source_trace.push({ name: "DOI_Landing", ok: false, fields: [] });
    }
  }

  // 最终模式确定
  out.summary_mode = out.abstract ? "AI_from_abstract" : "AI_from_metadata_only";
  
  console.log(`英文元数据抓取完成 - 模式: ${out.summary_mode}, 摘要来源: ${out.abstract_source}`);
  console.log(`最终结果:`, {
    title: out.title,
    abstract: out.abstract ? `${out.abstract.substring(0, 100)}...` : null,
    authors: out.authors,
    venue: out.venue,
    year: out.year,
    doi: out.doi
  });

  return out;
}

// 生成中文概述的LLM提示模板
export function generateChineseSummaryPrompt(metadata: EnglishMetaOut): string {
  if (metadata.summary_mode === "AI_from_abstract" && metadata.abstract) {
    // 严格基于真实摘要生成
    return `基于以下英文文献的真实摘要，请生成2-4句中文概述。请严格忠实于摘要内容，不要添加摘要中没有的信息。

title: ${metadata.title}
venue: ${metadata.venue}
year: ${metadata.year}
authors: ${metadata.authors.join(", ")}
abstract: ${metadata.abstract}

重要规则：
- 严格基于提供的摘要内容
- 不要推测或添加额外信息
- 保持学术性和准确性
- 2-4句中文概述

输出格式：
📖 中文概述（基於真實英文摘要）
(2-4句中文概述)`;
  } else {
    // 无摘要：只能基于标题和元数据，不得补全
    return `没有摘要可用。请基于论文标题、期刊、年份、作者信息生成中性2-3句中文概述。

开头必须使用：
（注意：此篇未提供摘要，以下為依據標題與可得資訊之概述，請核對原文。）

论文信息：
title: ${metadata.title}
venue: ${metadata.venue}
year: ${metadata.year}
authors: ${metadata.authors.join(", ")}

⚠️ 重要规则：
1. 必须专注于论文标题本身的研究主题，不要描述期刊、数据库或网站（如 JSTOR）
2. 只能基于标题推测研究主题和方法，严禁编造具体方法、数据或结果
3. 如果标题包含算法名称（如 "Algorithm AS XXX"），可以说明其研究领域和目的
4. 保持中性和学术性，避免过于具体的技术细节
5. 不要提及数据库名称、期刊平台或其他外部信息

输出格式：
📖 中文概述
(2-3句中文概述，必须以警告信息开头，专注于研究主题本身)`;
  }
}

// 使用示例
// const result = await fetchEnglishMetadata({ doi: "10.1109/ICMI65310.2025.11141112" });
// const prompt = generateEnglishSummaryPrompt(result);
// 然后调用LLM生成英文概述
