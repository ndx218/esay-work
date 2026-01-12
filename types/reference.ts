// 增强的文献验证类型定义

export type VerificationStatus = "verified" | "metadata_only" | "pending_verification";

export interface SourceTrace {
  url: string;
  fields: string[];
  extracted_at: string;
  method: "PAGE_EXTRACT" | "SemanticScholar" | "DOI_Landing" | "OpenAlex" | "CrossRef" | "Unpaywall";
}

export interface VerifiedReference {
  id: string;
  title: string;
  authors: string | string[];
  year: number;
  venue: string | null;
  doi: string | null;
  url: string;
  
  // 验证信息
  status: VerificationStatus;
  abstract: string | null;
  body_excerpt: string | null;  // 新增：正文摘录
  abstract_length: number;
  body_length: number;
  
  // 来源追溯
  source_trace: SourceTrace[];
  
  // 验证规则
  has_abstract: boolean;  // abstract >= 100
  has_body: boolean;      // body_excerpt >= 100
  verified: boolean;      // has_abstract || has_body
  
  // 其他信息
  summary?: string;
  citation?: string;
  database?: string;
  keySentences?: Array<{english: string, chinese: string}>;
  deepAnalysis?: {
    chineseExplanation: string;
    englishSentences: Array<{english: string, chinese: string}>;
    source: string;
    analyzedAt: string;
    metadata?: any;
  };
}

// 验证阈值常量
export const VERIFICATION_THRESHOLDS = {
  MIN_ABSTRACT_LENGTH: 100,  // 最小摘要长度
  MIN_BODY_LENGTH: 100,      // 最小正文长度
  MIN_TOTAL_LENGTH: 150      // 最小总长度
};

// 可信域白名单
export const TRUSTED_DOMAINS = [
  'ieeexplore.ieee.org',
  'link.springer.com',
  'www.tandfonline.com',
  'onlinelibrary.wiley.com',
  'www.mdpi.com',
  'www.hindawi.com',
  'www.scirp.org',
  'academic.oup.com',
  'www.nature.com',
  'www.sciencedirect.com',
  'dl.acm.org',
  'arxiv.org',
  'journals.plos.org',
  'www.frontiersin.org'
];

// 错误信息
export const ERROR_MESSAGES = {
  zh: "来源未验证：目前无法提供初稿。请确保至少有一篇文献包含完整摘要或正文。",
  en: "Source not verified: Draft generation is blocked. Please ensure at least one reference contains a full abstract or body text."
};

// 验证文献函数
export function verifyReference(ref: Partial<VerifiedReference>): VerifiedReference {
  const abstractLength = (ref.abstract || '').trim().length;
  const bodyLength = (ref.body_excerpt || '').trim().length;
  
  const has_abstract = abstractLength >= VERIFICATION_THRESHOLDS.MIN_ABSTRACT_LENGTH;
  const has_body = bodyLength >= VERIFICATION_THRESHOLDS.MIN_BODY_LENGTH;
  const verified = has_abstract || has_body;
  
  const status: VerificationStatus = verified ? "verified" : "metadata_only";
  
  return {
    ...ref,
    abstract_length: abstractLength,
    body_length: bodyLength,
    has_abstract,
    has_body,
    verified,
    status,
    source_trace: ref.source_trace || []
  } as VerifiedReference;
}

// 检查域名是否可信
export function isTrustedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return TRUSTED_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}
