/**
 * 职位数据接口
 */
export interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  postedAt: Date;
  source:
    | 'remoteok'
    | 'weworkremotely'
    | 'web3career'
    | 'hnhiring'
    | 'jobicy'
    | 'cryptojobslist'
    | 'workingnomads'
    | 'remotive';
}

/**
 * AI分析后的职位接口
 */
export interface AnalyzedJob extends Job {
  score: number; // 1-10 评分
  reason: string; // 匹配理由
}

/**
 * 用户背景信息接口
 */
export interface UserBackground {
  experience: string;
  skills: string[];
  location: string;
  preferences: {
    remoteOnly: boolean;
    industries: string[];
  };
}

/**
 * 已处理职位存储格式
 */
export interface ProcessedJobs {
  jobIds: string[];
  lastUpdated: string;
}
