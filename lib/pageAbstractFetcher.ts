// 从页面URL直接抓取摘要
// 简单三步：输入URL → 抓摘要 → 转中文
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (SimpleAbstractFetcher; +assignment-terminator)";

function clean(s?: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function firstNonEmpty(arr: (string | undefined)[]): string | null {
  // 40字符作为最低门槛
  return arr.find((x) => x && x.trim().length > 40) || null;
}

export async function fetchAbstractFromPage(url: string) {
  try {
    console.log(`开始从页面抓取摘要和正文: ${url}`);
    
    // 1) 抓取HTML
    const res = await fetch(url, { 
      headers: { "User-Agent": UA },
      redirect: "follow" as any,
      timeout: 15000
    });
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log(`成功获取页面HTML，长度: ${html.length}`);
    
    // 2) 常见meta标签（从易到难）
    const meta = firstNonEmpty([
      $('meta[name="citation_abstract"]').attr("content"),
      $('meta[name="dc.Description"]').attr("content"),
      $('meta[name="DC.Description"]').attr("content"),
      $('meta[property="og:description"]').attr("content"),
      $('meta[name="description"]').attr("content"),
    ]);
    
    if (meta) {
      console.log(`从meta标签找到摘要，长度: ${meta.length}`);
    }
    
    // 3) 正文区块（常见：SCIRP/Open Journal/Advances/IEEE/Springer...）
    const blocks = [
      $("#Abs").text(),               // SCIRP/OJ/Advances
      $("#Abstract").text(),
      $("section.abstract").text(),
      $("div.abstract").text(),
      $("div.abstractSection").text(),
      $('[itemprop="description"]').text(),
      $("div.abstract-content").text(),
      $("section[class*='abstract']").text(),
      $("div[class*='abstract']").text(),
    ].map(clean);
    
    const blockAbstract = firstNonEmpty(blocks);
    if (blockAbstract) {
      console.log(`从正文区块找到摘要，长度: ${blockAbstract.length}`);
    }
    
    // 4) H2「Abstract」相邻段落
    let h2Next = "";
    $("h2, h3").each((_, el) => {
      const t = clean($(el).text());
      if (/^abstract$/i.test(t) || /^摘\s*要$/.test(t)) {
        const next = $(el).next();
        h2Next = clean(next.text());
        return false;
      }
    });
    
    if (h2Next) {
      console.log(`从H2相邻段落找到摘要，长度: ${h2Next.length}`);
    }
    
    // 5) 提取正文摘录（body_excerpt）
    const bodyBlocks = [
      $("section.body").text(),
      $("div.body").text(),
      $("article").text(),
      $("div.article-body").text(),
      $("div.content-body").text(),
      $("main").text(),
      $("div[class*='content']").text(),
    ].map(clean);
    
    const body_excerpt = firstNonEmpty(bodyBlocks) || null;
    if (body_excerpt) {
      console.log(`✅ 成功抓取正文摘录，长度: ${body_excerpt.length}`);
      console.log(`正文预览: ${body_excerpt.substring(0, 100)}...`);
    }
    
    // 6) 决定摘要（优先级：meta > blocks > h2Next）
    const abstract = firstNonEmpty([meta, blockAbstract, h2Next]) || null;
    
    if (abstract) {
      console.log(`✅ 成功抓取摘要，长度: ${abstract.length}`);
      console.log(`摘要预览: ${abstract.substring(0, 100)}...`);
    } else {
      console.log(`❌ 未找到有效摘要`);
    }
    
    // 7) 验证状态
    const abstractLength = (abstract || '').length;
    const bodyLength = (body_excerpt || '').length;
    const has_abstract = abstractLength >= 100;
    const has_body = bodyLength >= 100;
    const verified = has_abstract || has_body;
    
    console.log(`验证结果: abstract=${abstractLength}字符, body=${bodyLength}字符, verified=${verified}`);
    
    return {
      abstract,           // 可能为null
      body_excerpt,       // 可能为null
      source: abstract ? "PAGE_EXTRACT" : null,
      final_url: url,     // 实际URL（debug用）
      summary_mode: abstract ? "AI_from_abstract" : "AI_from_metadata_only",
      abstract_length: abstractLength,
      body_length: bodyLength,
      has_abstract,
      has_body,
      verified
    };
    
  } catch (error) {
    console.error(`页面抓取失败: ${url}`, error);
    return {
      abstract: null,
      body_excerpt: null,
      source: null,
      final_url: url,
      summary_mode: "AI_from_metadata_only" as const,
      abstract_length: 0,
      body_length: 0,
      has_abstract: false,
      has_body: false,
      verified: false,
      error: String(error)
    };
  }
}

// 生成中文概述的提示模板
export function generateChineseSummaryFromAbstract(abstract: string): string {
  return `请根据下列英文摘要撰写2-3句中文概述。

重要规则：
- 必须使用中文输出
- 语气正式、学术
- 只能忠实浓缩摘要内容
- 不新增未出现的资讯
- 不要包含标题或格式标记
- 直接输出中文概述内容

英文摘要：
${abstract}

请直接输出2-3句中文概述（不要包含"中文概述："等前缀）：`;
}

export function generateChineseSummaryFromTitle(title: string): string {
  return `请基于以下学术论文标题，生成2-3句中文概述。

⚠️ 重要规则：
1. 必须专注于论文标题本身的研究主题，不要描述期刊、数据库或网站
2. 第一句必须以"（注意：此篇未提供摘要，以下为依据标题与可得资讯之概述，请核对原文。）"开头
3. 只能基于标题内容推测研究主题和方法，不得编造具体数据、结果或结论
4. 如果标题包含算法名称、方法或概念，可以简要说明其研究领域
5. 保持中性和学术性，避免过于具体的技术细节
6. 不要提及 JSTOR、期刊名称或其他数据库信息

论文标题：${title}

请直接输出2-3句中文概述（必须以警告信息开头，专注于研究主题本身）：`;
}

// 使用示例
// const { abstract, source, summary_mode } = await fetchAbstractFromPage(inputUrl);
// if (!abstract) {
//   // 显示固定提示
// } else {
//   // 生成中文概述
// }
