import { UserBackground } from './types.js';

/**
 * 用户背景信息配置
 */
export const userBackground: UserBackground = {
  experience: '3年前端工程师经验',
  skills: [
    'React',
    'Next.js',
    'TypeScript',
    'Vue',
    'Nuxt',
    'Tailwind',
    'Bootstrap',
    'Material UI',
    'Ant Design',
    'Chakra UI',
    'Shadcn UI',
    'Tailwind CSS',
    'Bootstrap CSS',
    'Material UI CSS',
    'Ant Design CSS',
    'Chakra UI CSS',
    'Shadcn UI CSS',
    'Node.js',
  ],
  location: '中国',
  preferences: {
    remoteOnly: true,
    industries: ['AI', 'Web3'],
  },
};

/**
 * API 端点配置
 */
export const apiEndpoints = {
  remoteok: 'https://remoteok.com/api',
  weworkremotely: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  web3career: 'https://web3.career/api/v1',
  hnhiring: 'https://hacker-news.firebaseio.com/v0',
  jobicy: 'https://jobicy.com/feed/newjobs',
  cryptojobslist: 'https://cryptojobslist.com/api/jobs',
  workingnomads: 'https://www.workingnomads.com/api/exposed_jobs/',
  remotive: 'https://remotive.com/api/remote-jobs',
};

/**
 * 过滤配置
 */
export const filterConfig = {
  minScore: 8, // 最低评分
  hoursThreshold: 24, // 只保留24小时内发布的职位
};

/**
 * AI 服务提供商类型
 */
export type AIProvider = 'deepseek' | 'openai' | 'groq' | 'together' | 'claude' | 'custom';

/**
 * AI 服务配置
 */
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL?: string;
  model: string;
  temperature?: number;
}

/**
 * 预设的 AI 服务配置
 */
export const aiConfigs: Record<AIProvider, Partial<AIConfig>> = {
  deepseek: {
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    temperature: 0.7,
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini', // 或 'gpt-4', 'gpt-3.5-turbo'
    temperature: 0.7,
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-70b-versatile', // 或 'mixtral-8x7b-32768'
    temperature: 0.7,
  },
  together: {
    baseURL: 'https://api.together.xyz/v1',
    model: 'meta-llama/Llama-3-70b-chat-hf',
    temperature: 0.7,
  },
  claude: {
    baseURL: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514', // 或 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'
    temperature: 0.7,
  },
  custom: {
    // 自定义配置，需要提供完整的 baseURL 和 model
    temperature: 0.7,
  },
};

/**
 * 获取当前使用的 AI 配置
 */
export function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER || 'deepseek') as AIProvider;
  const apiKeyEnv =
    process.env.AI_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY;

  if (!apiKeyEnv) {
    throw new Error(
      'AI_API_KEY 或 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 或 ANTHROPIC_API_KEY 环境变量未设置'
    );
  }

  const preset = aiConfigs[provider] || aiConfigs.deepseek;

  return {
    provider,
    apiKey: apiKeyEnv,
    baseURL: process.env.AI_BASE_URL || preset.baseURL,
    model: process.env.AI_MODEL || preset.model || 'deepseek-chat',
    temperature: Number(process.env.AI_TEMPERATURE) || preset.temperature || 0.7,
  };
}
