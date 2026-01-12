// types/references.ts

export interface ReferenceItem {
  id: string;
  sectionKey: string;
  title: string;
  url: string;
  doi?: string;
  source?: string;
  authors?: string;
  publishedAt?: Date;
  type: string;
  summary?: string;
  credibility?: number;
  explain?: string;
}

export type CitationFormat = 
  | "apa7" | "apa6" | "mla9" | "chicago" | "harvard" | "ieee" | "vancouver" | "cbe";

export function formatCitation(ref: ReferenceItem, format: CitationFormat = "apa7"): string {
  switch (format) {
    case "apa7":
      return formatCitationAPA7(ref);
    case "apa6":
      return formatCitationAPA6(ref);
    case "mla9":
      return formatCitationMLA9(ref);
    case "chicago":
      return formatCitationChicago(ref);
    case "harvard":
      return formatCitationHarvard(ref);
    case "ieee":
      return formatCitationIEEE(ref);
    case "vancouver":
      return formatCitationVancouver(ref);
    case "cbe":
      return formatCitationCBE(ref);
    default:
      return formatCitationAPA7(ref);
  }
}

export function formatCitationAPA7(ref: ReferenceItem): string {
  const parts: string[] = [];
  
  // 作者
  if (ref.authors) {
    parts.push(ref.authors);
  }
  
  // 出版年份
  if (ref.publishedAt) {
    parts.push(`(${ref.publishedAt.getFullYear()})`);
  }
  
  // 標題
  if (ref.title) {
    parts.push(ref.title);
  }
  
  // 來源
  if (ref.source) {
    parts.push(ref.source);
  }
  
  // DOI
  if (ref.doi) {
    parts.push(`https://doi.org/${ref.doi}`);
  }
  
  return parts.join('. ');
}

export function formatCitationAPA6(ref: ReferenceItem): string {
  const parts: string[] = [];
  
  // 作者
  if (ref.authors) {
    parts.push(ref.authors);
  }
  
  // 出版年份
  if (ref.publishedAt) {
    parts.push(`(${ref.publishedAt.getFullYear()})`);
  }
  
  // 標題
  if (ref.title) {
    parts.push(ref.title);
  }
  
  // 來源
  if (ref.source) {
    parts.push(ref.source);
  }
  
  return parts.join('. ');
}

export function formatCitationMLA9(ref: ReferenceItem): string {
  const parts: string[] = [];
  
  // 作者
  if (ref.authors) {
    parts.push(ref.authors);
  }
  
  // 標題
  if (ref.title) {
    parts.push(`"${ref.title}"`);
  }
  
  // 來源
  if (ref.source) {
    parts.push(ref.source);
  }
  
  // 出版年份
  if (ref.publishedAt) {
    parts.push(ref.publishedAt.getFullYear().toString());
  }
  
  return parts.join('. ');
}

export function formatCitationChicago(ref: ReferenceItem): string {
  const parts: string[] = [];
  
  // 作者
  if (ref.authors) {
    parts.push(ref.authors);
  }
  
  // 標題
  if (ref.title) {
    parts.push(`"${ref.title}"`);
  }
  
  // 來源
  if (ref.source) {
    parts.push(ref.source);
  }
  
  // 出版年份
  if (ref.publishedAt) {
    parts.push(`(${ref.publishedAt.getFullYear()})`);
  }
  
  return parts.join('. ');
}

export function formatCitationHarvard(ref: ReferenceItem): string {
  const parts: string[] = [];
  
  // 作者
  if (ref.authors) {
    parts.push(ref.authors);
  }
  
  // 出版年份
  if (ref.publishedAt) {
    parts.push(ref.publishedAt.getFullYear().toString());
  }
  
  // 標題
  if (ref.title) {
    parts.push(ref.title);
  }
  
  // 來源
  if (ref.source) {
    parts.push(ref.source);
  }
  
  return parts.join(', ');
}

export function formatCitationIEEE(ref: ReferenceItem): string {
  const parts: string[] = [];
  
  // 作者
  if (ref.authors) {
    const authors = ref.authors.split(';').map(a => a.trim());
    if (authors.length > 3) {
      parts.push(`${authors[0]} et al.`);
    } else {
      parts.push(authors.join(', '));
    }
  }
  
  // 標題
  if (ref.title) {
    parts.push(`"${ref.title}"`);
  }
  
  // 來源
  if (ref.source) {
    parts.push(ref.source);
  }
  
  // 出版年份
  if (ref.publishedAt) {
    parts.push(ref.publishedAt.getFullYear().toString());
  }
  
  return parts.join(', ');
}

export function formatCitationVancouver(ref: ReferenceItem): string {
  const parts: string[] = [];
  
  // 作者
  if (ref.authors) {
    const authors = ref.authors.split(';').map(a => a.trim());
    if (authors.length > 6) {
      parts.push(`${authors[0]} et al.`);
    } else {
      parts.push(authors.join(', '));
    }
  }
  
  // 標題
  if (ref.title) {
    parts.push(ref.title);
  }
  
  // 來源
  if (ref.source) {
    parts.push(ref.source);
  }
  
  // 出版年份
  if (ref.publishedAt) {
    parts.push(`${ref.publishedAt.getFullYear()}`);
  }
  
  return parts.join('. ');
}

export function formatCitationCBE(ref: ReferenceItem): string {
  const parts: string[] = [];
  
  // 作者
  if (ref.authors) {
    parts.push(ref.authors);
  }
  
  // 出版年份
  if (ref.publishedAt) {
    parts.push(ref.publishedAt.getFullYear().toString());
  }
  
  // 標題
  if (ref.title) {
    parts.push(ref.title);
  }
  
  // 來源
  if (ref.source) {
    parts.push(ref.source);
  }
  
  return parts.join('. ');
}
