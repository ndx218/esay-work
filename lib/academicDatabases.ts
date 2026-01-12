// 学术数据库分类系统
// 基于用户建议的完整数据源分类

export interface AcademicDatabase {
  id: string;
  name: string;
  icon: string;
  description: string;
  url: string;
  category: 'free_oa' | 'free_login' | 'api_only';
  fullTextAvailable: boolean;
  apiAvailable: boolean;
  loginRequired: boolean;
  specialties: string[];
  legalStatus: 'fully_legal' | 'partial_legal' | 'api_only';
}

// 无需登录的免费OA源（完全合法）
export const FREE_OA_DATABASES: AcademicDatabase[] = [
  { 
    id: 'googlescholar', 
    name: 'Google Scholar', 
    icon: '🔍', 
    description: '最主流的学术搜索引擎，支持引用格式、引用追踪、h-index、引用提醒等功能', 
    url: 'https://scholar.google.com/', 
    category: 'free_oa', 
    fullTextAvailable: true, 
    apiAvailable: false, 
    loginRequired: false, 
    specialties: ['全学科', '引用追踪', 'h-index'],
    legalStatus: 'fully_legal'
  },
  { 
    id: 'semanticscholar', 
    name: 'Semantic Scholar', 
    icon: '🤖', 
    description: 'Allen AI研究院开发，提供AI自动摘要、相关研究推荐，非常适合机器学习与计算机科学', 
    url: 'https://www.semanticscholar.org/', 
    category: 'free_oa', 
    fullTextAvailable: true, 
    apiAvailable: true, 
    loginRequired: false, 
    specialties: ['AI/ML', '计算机科学', '自动摘要'],
    legalStatus: 'fully_legal'
  },
  { 
    id: 'openalex', 
    name: 'OpenAlex (原Microsoft Academic)', 
    icon: '🌐', 
    description: '开放的学术知识图谱，数据完全开放，可用来开发AI学术应用', 
    url: 'https://openalex.org/', 
    category: 'free_oa', 
    fullTextAvailable: true, 
    apiAvailable: true, 
    loginRequired: false, 
    specialties: ['知识图谱', '开放数据', 'AI应用'],
    legalStatus: 'fully_legal'
  },
  { 
    id: 'lens', 
    name: 'Lens.org', 
    icon: '🔬', 
    description: '支持专利+学术文献双检索，可导出多种格式引用', 
    url: 'https://www.lens.org/', 
    category: 'free_oa', 
    fullTextAvailable: true, 
    apiAvailable: false, 
    loginRequired: false, 
    specialties: ['专利', '学术文献', '引用格式'],
    legalStatus: 'fully_legal'
  },
  { 
    id: 'doaj', 
    name: 'DOAJ', 
    icon: '📖', 
    description: '各学科开放获取期刊数据库', 
    url: 'https://doaj.org/', 
    category: 'free_oa', 
    fullTextAvailable: true, 
    apiAvailable: true, 
    loginRequired: false, 
    specialties: ['全学科', '开放获取', '期刊'],
    legalStatus: 'fully_legal'
  },
  { 
    id: 'arxiv', 
    name: 'arXiv', 
    icon: '📚', 
    description: '物理、数学、计算机科学论文预印本', 
    url: 'https://arxiv.org/', 
    category: 'free_oa', 
    fullTextAvailable: true, 
    apiAvailable: true, 
    loginRequired: false, 
    specialties: ['物理', '数学', '计算机科学', '预印本'],
    legalStatus: 'fully_legal'
  },
  { 
    id: 'core', 
    name: 'CORE', 
    icon: '🗄️', 
    description: '聚合来自世界各地大学OA仓储的论文', 
    url: 'https://core.ac.uk/', 
    category: 'free_oa', 
    fullTextAvailable: true, 
    apiAvailable: true, 
    loginRequired: false, 
    specialties: ['大学仓储', 'OA聚合', '全文下载'],
    legalStatus: 'fully_legal'
  },
  { 
    id: 'pubmed_central', 
    name: 'PubMed Central', 
    icon: '🏥', 
    description: '医学与生命科学类OA期刊', 
    url: 'https://www.ncbi.nlm.nih.gov/pmc/', 
    category: 'free_oa', 
    fullTextAvailable: true, 
    apiAvailable: true, 
    loginRequired: false, 
    specialties: ['医学', '生命科学', 'OA期刊'],
    legalStatus: 'fully_legal'
  },
  { 
    id: 'openaire', 
    name: 'OpenAIRE', 
    icon: '🇪🇺', 
    description: '欧盟资助项目的开放论文', 
    url: 'https://www.openaire.eu/', 
    category: 'free_oa', 
    fullTextAvailable: true, 
    apiAvailable: true, 
    loginRequired: false, 
    specialties: ['欧盟项目', '开放论文', '多学科'],
    legalStatus: 'fully_legal'
  }
];

// 需登录的免费OA源（部分合法，需要账号）
export const FREE_LOGIN_DATABASES: AcademicDatabase[] = [
  { 
    id: 'ssrn', 
    name: 'SSRN', 
    icon: '📊', 
    description: '经济、社会科学类预印本', 
    url: 'https://www.ssrn.com/', 
    category: 'free_login', 
    fullTextAvailable: true, 
    apiAvailable: false, 
    loginRequired: true, 
    specialties: ['经济学', '社会科学', '预印本'],
    legalStatus: 'partial_legal'
  },
  { 
    id: 'researchgate', 
    name: 'ResearchGate', 
    icon: '👥', 
    description: '学者社交平台，可直接向作者请求全文', 
    url: 'https://www.researchgate.net/', 
    category: 'free_login', 
    fullTextAvailable: true, 
    apiAvailable: false, 
    loginRequired: true, 
    specialties: ['学者社交', '作者请求', '多学科'],
    legalStatus: 'partial_legal'
  },
  { 
    id: 'academia', 
    name: 'Academia.edu', 
    icon: '🎓', 
    description: '学者分享平台，可下载部分免费论文', 
    url: 'https://www.academia.edu/', 
    category: 'free_login', 
    fullTextAvailable: true, 
    apiAvailable: false, 
    loginRequired: true, 
    specialties: ['学者分享', '免费论文', '多学科'],
    legalStatus: 'partial_legal'
  }
];

// API专用源（完全合法，仅API访问）
export const API_ONLY_DATABASES: AcademicDatabase[] = [
  { 
    id: 'crossref', 
    name: 'CrossRef', 
    icon: '🔗', 
    description: 'DOI注册机构，提供最全的元数据', 
    url: 'https://www.crossref.org/', 
    category: 'api_only', 
    fullTextAvailable: false, 
    apiAvailable: true, 
    loginRequired: false, 
    specialties: ['DOI', '元数据', '引用'],
    legalStatus: 'api_only'
  },
  { 
    id: 'unpaywall', 
    name: 'Unpaywall', 
    icon: '🔓', 
    description: '开放获取检测工具', 
    url: 'https://unpaywall.org/', 
    category: 'api_only', 
    fullTextAvailable: false, 
    apiAvailable: true, 
    loginRequired: false, 
    specialties: ['OA检测', 'DOI查询', '免费链接'],
    legalStatus: 'api_only'
  },
  { 
    id: 'europe_pmc', 
    name: 'Europe PMC', 
    icon: '🧬', 
    description: '欧洲医学与生命科学文献数据库', 
    url: 'https://europepmc.org/', 
    category: 'api_only', 
    fullTextAvailable: true, 
    apiAvailable: true, 
    loginRequired: false, 
    specialties: ['医学', '生命科学', '欧洲'],
    legalStatus: 'api_only'
  }
];

// 合并所有数据库（只保留3个主要数据库）
export const ALL_ACADEMIC_DATABASES = [
  // 只保留 Google Scholar, Semantic Scholar, OpenAlex
  FREE_OA_DATABASES.find(db => db.id === 'googlescholar'),
  FREE_OA_DATABASES.find(db => db.id === 'semanticscholar'),
  FREE_OA_DATABASES.find(db => db.id === 'openalex'),
].filter(Boolean) as AcademicDatabase[];

// 推荐组合
export interface RecommendedCombination {
  key: string;
  title: string;
  description: string;
  databases: string[];
  color: string;
  useCase: string;
}

export const RECOMMENDED_COMBINATIONS: RecommendedCombination[] = [
  {
    key: 'search_papers',
    title: '🔍 搜論文',
    description: '最全面的论文搜索组合',
    databases: ['googlescholar', 'semanticscholar', 'crossref'],
    color: 'blue',
    useCase: '快速找到相关论文'
  },
  {
    key: 'find_oa_fulltext',
    title: '📚 找开放获取全文',
    description: '专门寻找可免费下载的全文',
    databases: ['core', 'doaj', 'arxiv'],
    color: 'green',
    useCase: '获取免费全文PDF'
  },
  {
    key: 'ai_understanding',
    title: '🧠 AI理解论文',
    description: 'AI增强的论文分析和理解',
    databases: ['semanticscholar', 'openalex'],
    color: 'purple',
    useCase: 'AI摘要和推荐'
  },
  {
    key: 'medical_research',
    title: '🏥 医学研究',
    description: '医学和生命科学专业搜索',
    databases: ['pubmed_central', 'europe_pmc', 'core'],
    color: 'red',
    useCase: '医学文献搜索'
  },
  {
    key: 'tech_cs',
    title: '💻 计算机科学',
    description: '计算机科学和技术类论文',
    databases: ['arxiv', 'semanticscholar', 'openalex'],
    color: 'indigo',
    useCase: '技术论文搜索'
  },
  {
    key: 'comprehensive',
    title: '🌟 综合搜索',
    description: '最全面的多源搜索',
    databases: ['googlescholar', 'semanticscholar', 'core', 'openalex', 'crossref'],
    color: 'gold',
    useCase: '全面文献调研'
  }
];

// 工具函数
export function getDatabasesByCategory(category: 'free_oa' | 'free_login' | 'api_only'): AcademicDatabase[] {
  return ALL_ACADEMIC_DATABASES.filter(db => db.category === category);
}

export function getDatabaseById(id: string): AcademicDatabase | undefined {
  return ALL_ACADEMIC_DATABASES.find(db => db.id === id);
}

export function getDatabasesWithFullText(): AcademicDatabase[] {
  return ALL_ACADEMIC_DATABASES.filter(db => db.fullTextAvailable);
}

export function getDatabasesWithAPI(): AcademicDatabase[] {
  return ALL_ACADEMIC_DATABASES.filter(db => db.apiAvailable);
}

export function getLegalDatabases(): AcademicDatabase[] {
  return ALL_ACADEMIC_DATABASES.filter(db => db.legalStatus === 'fully_legal');
}

// 获取推荐组合的数据库信息
export function getCombinationDatabases(combinationKey: string): AcademicDatabase[] {
  const combination = RECOMMENDED_COMBINATIONS.find(c => c.key === combinationKey);
  if (!combination) return [];
  
  return combination.databases
    .map(id => getDatabaseById(id))
    .filter(Boolean) as AcademicDatabase[];
}

// 数据库统计信息
export function getDatabaseStats() {
  return {
    total: ALL_ACADEMIC_DATABASES.length,
    freeOa: FREE_OA_DATABASES.length,
    freeLogin: FREE_LOGIN_DATABASES.length,
    apiOnly: API_ONLY_DATABASES.length,
    withFullText: getDatabasesWithFullText().length,
    withAPI: getDatabasesWithAPI().length,
    fullyLegal: getLegalDatabases().length
  };
}
