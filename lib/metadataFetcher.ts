// 专业文献元数据抓取系统
// 按照Cursor指令实现：CrossRef → Semantic Scholar → OpenAlex → DOI Landing
import fetch from "node-fetch";
import * as cheerio from "cheerio";

export type MetaOut = {
  title: string | null;
  abstract: string | null;
  authors: string[];
  venue: string | null;
  year: number | null;
  doi: string | null;
  source_trace: Array<{name: string; ok: boolean; fields: string[]}>;
  abstract_source: "CrossRef" | "SemanticScholar" | "OpenAlex" | "DOI_Landing" | null;
  summary_mode: "AI_from_abstract" | "AI_from_metadata_only";
};

const UA = "Mozilla/5.0 (MetadataFetcher; +assignment-terminator)";
const S2_FIELDS = "title,abstract,authors,year,venue,doi,url";
const OPENALEX_FIELDS = "display_name,publication_year,doi,authorships,primary_location";

// 作者信息标准化函数
function normalizeAuthorsCrossRef(item: any): string[] {
  const a = item?.author || [];
  return a.map((x: any) => [x.given, x.family].filter(Boolean).join(" ")).filter(Boolean);
}

function normalizeAuthorsS2(a: any[]): string[] {
  return (a || []).map(x => x?.name).filter(Boolean);
}

function normalizeAuthorsOpenAlex(work: any): string[] {
  const a = work?.authorships || [];
  return a.map((x: any) => x?.author?.display_name).filter(Boolean);
}

// 主要元数据抓取函数
export async function fetchMetadata({ title, doi }: { title?: string; doi?: string; }): Promise<MetaOut> {
  const out: MetaOut = {
    title: null, 
    abstract: null, 
    authors: [], 
    venue: null, 
    year: null, 
    doi: doi || null,
    source_trace: [], 
    abstract_source: null, 
    summary_mode: "AI_from_metadata_only"
  };

  console.log(`开始抓取元数据 - DOI: ${doi}, Title: ${title}`);

  // 1) CrossRef API
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
        // CrossRef rarely includes abstracts; leave null if not present
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

  // 2) Semantic Scholar（补充摘要）
  try {
    const q = out.doi 
      ? `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(out.doi)}?fields=${S2_FIELDS}`
      : `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(title || out.title || "")}&fields=${S2_FIELDS}&limit=1`;
    
    const r = await fetch(q, { headers: { "User-Agent": UA } });
    if (r.ok) {
      const j = await r.json() as any;
      const paper = out.doi ? j : (j?.data?.[0] || null);
      if (paper) {
        out.title = out.title || paper.title || null;
        out.abstract = out.abstract || paper.abstract || null;
        out.authors = out.authors.length ? out.authors : normalizeAuthorsS2(paper.authors);
        out.venue = out.venue || paper.venue || null;
        out.year = out.year || paper.year || null;
        out.doi = out.doi || paper.doi || null;
        if (paper.abstract) {
          out.abstract_source = "SemanticScholar";
          console.log(`Semantic Scholar成功获取摘要 - 长度: ${paper.abstract.length}`);
        }
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

  // 3) OpenAlex（补充信息）
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

  // 4) DOI Landing页面（抓取meta摘要）
  if (!out.abstract && out.doi) {
    try {
      const resp = await fetch(`https://doi.org/${encodeURIComponent(out.doi)}`, { 
        headers: { "User-Agent": UA }, 
        redirect: "follow" as any 
      });
      const html = await resp.text();
      const $ = cheerio.load(html);
      
      const pick = (sel: string, attr: 'content' | 'value' = 'content') => {
        const el = $(sel).first();
        return el.attr(attr) || null;
      };
      
      const metaCandidates = [
        'meta[name="citation_abstract"]',
        'meta[name="dc.Description"]',
        'meta[name="DC.Description"]',
        'meta[property="og:description"]',
        'meta[name="description"]'
      ];
      
      for (const s of metaCandidates) {
        const v = pick(s);
        if (v) { 
          out.abstract = v; 
          out.abstract_source = "DOI_Landing"; 
          console.log(`DOI Landing成功获取摘要 - 长度: ${v.length}`);
          break; 
        }
      }
      
      // 顺便补充标题
      if (!out.title) {
        out.title = pick('meta[name="citation_title"]') || pick('meta[property="og:title"]') || $('title').text() || null;
      }
      
      out.source_trace.push({ 
        name: "DOI_Landing", 
        ok: !!out.abstract || !!out.title, 
        fields: ["citation_abstract", "citation_title", "og:*", "description"] 
      });
    } catch (error) {
      out.source_trace.push({ name: "DOI_Landing", ok: false, fields: [] });
      console.log(`DOI Landing异常:`, error);
    }
  }

  // 最终模式确定
  out.summary_mode = out.abstract ? "AI_from_abstract" : "AI_from_metadata_only";
  
  console.log(`元数据抓取完成 - 模式: ${out.summary_mode}, 摘要来源: ${out.abstract_source}`);
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

// 生成中文说明的LLM提示模板
export function generateChineseSummaryPrompt(metadata: MetaOut): string {
  if (metadata.summary_mode === "AI_from_abstract") {
    return `You are writing a 2–4 sentence Chinese summary for a scholarly article based on the REAL abstract.
Strict rules:
- Only use the provided metadata and abstract. Do not invent details.
- Tone: formal, natural, academic.
- Focus: research topic, methods, results, or contributions from the abstract.
- Do not fabricate or add content not in the abstract.
- If abstract is long, intelligently extract key points rather than full translation.
- Start with: "📖 中文概述（基於真實摘要生成）"

INPUT:
title: ${metadata.title}
venue: ${metadata.venue}
year: ${metadata.year}
authors: ${metadata.authors.join(", ")}
abstract: ${metadata.abstract}

OUTPUT (Chinese, 2–4 sentences, starting with the specified header):`;
  } else {
    return `You are writing a cautious 2–3 sentence Chinese overview for a scholarly article WITHOUT an available abstract.
Strict rules:
- Start with: "（注意：此篇未提供摘要，以下為依據標題與可得資訊之概述，請核對原文。）"
- Only use title/venue/year/authors; avoid specific methods/findings.
- Tone: concise, formal, neutral.

INPUT:
title: ${metadata.title}
venue: ${metadata.venue}
year: ${metadata.year}
authors: ${metadata.authors.join(", ")}

OUTPUT (Chinese, 2–3 sentences):`;
  }
}

// 使用示例
// const result = await fetchMetadata({ doi: "10.1109/ICMI65310.2025.11141112" });
// const prompt = generateChineseSummaryPrompt(result);
// 然后调用LLM生成中文说明
