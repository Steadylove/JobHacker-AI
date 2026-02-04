import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { Job } from './types.js';
import { apiEndpoints } from './config.js';

interface RemoteOKJob {
  id: string;
  position: string;
  company: string;
  description: string;
  url: string;
  epoch: number;
}

interface WWRItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

interface Web3CareerJob {
  id: number;
  title: string;
  company: string;
  description?: string;
  location?: string;
  remote?: boolean;
  url?: string;
  slug?: string;
  created_at?: string;
  published_at?: string;
}

/**
 * 从RemoteOK API获取职位数据
 */
export async function fetchRemoteOKJobs(): Promise<Job[]> {
  try {
    const response = await axios.get<RemoteOKJob[]>(apiEndpoints.remoteok, {
      proxy: false, // 禁用代理，直接连接
    });
    const jobs: Job[] = [];

    for (const item of response.data) {
      if (!item || !item.id || !item.position) {
        continue;
      }

      try {
        const normalized = normalizeJob(item, 'remoteok');
        jobs.push(normalized);
      } catch (error) {
        console.warn(`跳过无效的RemoteOK职位: ${item.id}`, error);
      }
    }

    return jobs;
  } catch (error) {
    console.error('获取RemoteOK职位失败:', error);
    throw error;
  }
}

/**
 * 从WeWorkRemotely RSS获取职位数据
 */
export async function fetchWWRJobs(): Promise<Job[]> {
  try {
    const response = await axios.get<string>(apiEndpoints.weworkremotely, {
      proxy: false, // 禁用代理，直接连接
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobHacker-AI/1.0)',
      },
    });

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    const parsed = parser.parse(response.data);
    // 处理单个 item 或 item 数组的情况
    let items: WWRItem[] = [];
    const rawItems = parsed.rss?.channel?.item;
    if (rawItems) {
      items = Array.isArray(rawItems) ? rawItems : [rawItems];
    }

    const jobs: Job[] = [];

    for (const item of items) {
      if (!item || !item.title || !item.link) {
        continue;
      }

      try {
        const normalized = normalizeJob(item, 'weworkremotely');
        jobs.push(normalized);
      } catch (error) {
        console.warn(`跳过无效的WWR职位: ${item.title}`, error);
      }
    }

    return jobs;
  } catch (error) {
    console.error('获取WWR职位失败:', error);
    // 如果是解析错误，返回空数组而不是抛出错误
    if (error instanceof Error && error.message.includes('XML')) {
      return [];
    }
    throw error;
  }
}

/**
 * 从Web3.career获取职位数据
 * 尝试多个端点：RSS feed 或 JSON API
 */
export async function fetchWeb3CareerJobs(): Promise<Job[]> {
  const endpoints = [
    'https://web3.career/api/v1/jobs?page=1&per_page=50',
    'https://web3.career/remote-jobs.rss',
    'https://web3.career/feed.rss',
  ];

  for (const endpoint of endpoints) {
    try {
      const isRss = endpoint.includes('.rss');
      const response = await axios.get<string>(endpoint, {
        proxy: false,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: isRss
            ? 'application/rss+xml, application/xml, text/xml'
            : 'application/json, text/html',
        },
        timeout: 15000,
        validateStatus: (status) => status < 500, // 只有5xx才算失败
      });

      if (response.status >= 400) {
        console.warn(`Web3.career 端点 ${endpoint} 返回 ${response.status}，尝试下一个`);
        continue;
      }

      const jobs: Job[] = [];

      if (isRss) {
        // 解析 RSS
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
        });

        const parsed = parser.parse(response.data);
        let items: Array<{
          title?: string;
          link?: string;
          description?: string;
          pubDate?: string;
        }> = [];
        const rawItems = parsed.rss?.channel?.item;
        if (rawItems) {
          items = Array.isArray(rawItems) ? rawItems : [rawItems];
        }

        for (const item of items) {
          if (!item || !item.title || !item.link) continue;

          try {
            const web3Job: Web3CareerJob = {
              id: Date.now() + Math.random(),
              title: item.title,
              company: extractCompanyFromWeb3Title(item.title) || 'Unknown',
              description: item.description || '',
              url: item.link,
              published_at: item.pubDate,
            };
            jobs.push(normalizeJob(web3Job, 'web3career'));
          } catch {
            // 跳过无效职位
          }
        }
      } else {
        // 尝试解析 JSON
        try {
          const data =
            typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          const jobList = data.jobs || data.data || data || [];

          if (Array.isArray(jobList)) {
            for (const job of jobList) {
              if (!job || !job.title) continue;

              const web3Job: Web3CareerJob = {
                id: job.id || Date.now() + Math.random(),
                title: job.title,
                company: job.company || job.company_name || 'Unknown',
                description: job.description || '',
                url: job.url || job.apply_url || `https://web3.career/job/${job.slug || job.id}`,
                published_at: job.published_at || job.created_at,
              };
              jobs.push(normalizeJob(web3Job, 'web3career'));
            }
          }
        } catch {
          // JSON 解析失败，尝试下一个端点
          continue;
        }
      }

      if (jobs.length > 0) {
        console.log(`Web3.career: 获取到 ${jobs.length} 个职位 (来源: ${endpoint})`);
        return jobs;
      }
    } catch (error) {
      console.warn(
        `Web3.career 端点 ${endpoint} 失败:`,
        error instanceof Error ? error.message : error
      );
      // 继续尝试下一个端点
    }
  }

  console.warn('Web3.career: 所有端点均失败，返回空数组');
  return [];
}

/**
 * 从Web3.career标题中提取公司名称
 * 格式通常是 "职位 at 公司" 或 "职位 - 公司"
 */
function extractCompanyFromWeb3Title(title: string): string | null {
  // 尝试匹配 "at Company" 格式
  const atMatch = title.match(/\bat\s+(.+?)(?:\s*[-–—]|$)/i);
  if (atMatch) return atMatch[1].trim();

  // 尝试匹配 "- Company" 格式
  const dashMatch = title.match(/[-–—]\s*(.+)$/);
  if (dashMatch) return dashMatch[1].trim();

  return null;
}

interface HNJob {
  id: number;
  title: string;
  text?: string;
  time: number;
  by?: string;
}

interface JobicyItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  'dc:creator'?: string;
}

/**
 * 从Hacker News "Who is Hiring" 获取职位数据
 * 使用 HN Algolia API 搜索最新的招聘帖子
 */
export async function fetchHNHiringJobs(): Promise<Job[]> {
  try {
    // 搜索最近的 "Who is hiring" 帖子中的评论
    const searchUrl =
      'https://hn.algolia.com/api/v1/search_by_date?query=remote&tags=comment,ask_hn&hitsPerPage=100';

    const response = await axios.get(searchUrl, {
      proxy: false,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobHacker-AI/1.0)',
      },
    });

    const jobs: Job[] = [];
    const hits = response.data.hits || [];

    for (const hit of hits) {
      // 过滤出看起来像招聘的评论
      const text = hit.comment_text || '';
      if (!text || text.length < 100) continue;

      // 检查是否包含招聘关键词
      const lowerText = text.toLowerCase();
      const isHiring =
        lowerText.includes('hiring') ||
        lowerText.includes('remote') ||
        lowerText.includes('frontend') ||
        lowerText.includes('engineer') ||
        lowerText.includes('developer');

      if (!isHiring) continue;

      // 尝试提取公司名称（通常在开头）
      const firstLine = text.split('\n')[0] || '';
      const companyMatch = firstLine.match(/^([^|]+)/);
      const company = companyMatch ? companyMatch[1].trim().substring(0, 50) : 'HN Posting';

      // 提取标题（取前100个字符）
      const title = firstLine.substring(0, 100) || 'Hacker News Job';

      jobs.push({
        id: `hnhiring-${hit.objectID}`,
        title: title.replace(/<[^>]*>/g, ''), // 移除HTML标签
        company: company.replace(/<[^>]*>/g, ''),
        description: text.replace(/<[^>]*>/g, '').substring(0, 500),
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        postedAt: new Date(hit.created_at_i * 1000),
        source: 'hnhiring',
      });
    }

    console.log(`Hacker News: 获取到 ${jobs.length} 个职位`);
    return jobs;
  } catch (error) {
    console.error('获取HN Hiring职位失败:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * 从Jobicy RSS获取职位数据
 */
export async function fetchJobicyJobs(): Promise<Job[]> {
  try {
    const response = await axios.get<string>(apiEndpoints.jobicy, {
      proxy: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobHacker-AI/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
      timeout: 10000,
    });

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    const parsed = parser.parse(response.data);
    let items: JobicyItem[] = [];
    const rawItems = parsed.rss?.channel?.item;
    if (rawItems) {
      items = Array.isArray(rawItems) ? rawItems : [rawItems];
    }

    const jobs: Job[] = [];

    for (const item of items) {
      if (!item || !item.title || !item.link) continue;

      // 提取公司名称（通常在标题中用 "at" 或 "-" 分隔）
      const company = extractCompanyFromJobicyTitle(item.title) || item['dc:creator'] || 'Unknown';

      jobs.push({
        id: `jobicy-${hashString(item.link)}`,
        title: item.title,
        company: company,
        description: (item.description || '').replace(/<[^>]*>/g, '').substring(0, 500),
        url: item.link,
        postedAt: parseDate(item.pubDate),
        source: 'jobicy',
      });
    }

    console.log(`Jobicy: 获取到 ${jobs.length} 个职位`);
    return jobs;
  } catch (error) {
    console.error('获取Jobicy职位失败:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * 从Jobicy标题中提取公司名称
 */
function extractCompanyFromJobicyTitle(title: string): string | null {
  // 尝试匹配 "at Company" 格式
  const atMatch = title.match(/\bat\s+(.+?)(?:\s*[-–—]|$)/i);
  if (atMatch) return atMatch[1].trim();

  // 尝试匹配 "- Company" 或 "| Company" 格式
  const sepMatch = title.match(/[-–—|]\s*(.+)$/);
  if (sepMatch) return sepMatch[1].trim();

  return null;
}

/**
 * 从CryptoJobsList获取职位数据
 */
export async function fetchCryptoJobsListJobs(): Promise<Job[]> {
  try {
    const response = await axios.get(apiEndpoints.cryptojobslist, {
      proxy: false,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    const jobs: Job[] = [];
    const jobList = response.data?.jobs || response.data || [];

    if (Array.isArray(jobList)) {
      for (const job of jobList) {
        if (!job || !job.title) continue;

        jobs.push({
          id: `cryptojobslist-${job.id || hashString(job.title + job.company)}`,
          title: job.title,
          company: job.company || job.companyName || 'Unknown',
          description: (job.description || '').substring(0, 500),
          url: job.url || job.applyUrl || `https://cryptojobslist.com/jobs/${job.slug || job.id}`,
          postedAt: parseDate(job.publishedAt || job.createdAt || new Date().toISOString()),
          source: 'cryptojobslist',
        });
      }
    }

    console.log(`CryptoJobsList: 获取到 ${jobs.length} 个职位`);
    return jobs;
  } catch (error) {
    console.error('获取CryptoJobsList职位失败:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * 从Working Nomads获取职位数据
 */
export async function fetchWorkingNomadsJobs(): Promise<Job[]> {
  try {
    const response = await axios.get(apiEndpoints.workingnomads, {
      proxy: false,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    const jobs: Job[] = [];
    const jobList = Array.isArray(response.data) ? response.data : [];

    for (const job of jobList) {
      if (!job || !job.title) continue;

      jobs.push({
        id: `workingnomads-${job.id || hashString(job.url || job.title)}`,
        title: job.title,
        company: job.company_name || job.company || 'Unknown',
        description: (job.description || '').replace(/<[^>]*>/g, '').substring(0, 500),
        url: job.url || 'https://www.workingnomads.com/jobs',
        postedAt: parseDate(job.pub_date || job.published_at || new Date().toISOString()),
        source: 'workingnomads',
      });
    }

    console.log(`Working Nomads: 获取到 ${jobs.length} 个职位`);
    return jobs;
  } catch (error) {
    console.error('获取Working Nomads职位失败:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * 从Remotive获取职位数据
 */
export async function fetchRemotiveJobs(): Promise<Job[]> {
  try {
    // Remotive有官方API
    const response = await axios.get(apiEndpoints.remotive, {
      proxy: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobHacker-AI/1.0)',
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    const jobs: Job[] = [];
    const jobList = response.data?.jobs || [];

    for (const job of jobList) {
      if (!job || !job.title) continue;

      // 过滤开发相关职位
      const category = (job.category || '').toLowerCase();
      const isDev =
        category.includes('software') ||
        category.includes('engineer') ||
        category.includes('developer') ||
        category.includes('frontend') ||
        category.includes('backend') ||
        category.includes('devops');

      if (!isDev && jobList.length > 50) continue; // 如果职位很多，只保留开发相关

      jobs.push({
        id: `remotive-${job.id}`,
        title: job.title,
        company: job.company_name || 'Unknown',
        description: (job.description || '').replace(/<[^>]*>/g, '').substring(0, 500),
        url: job.url || `https://remotive.com/remote-jobs/${job.id}`,
        postedAt: parseDate(job.publication_date || new Date().toISOString()),
        source: 'remotive',
      });
    }

    console.log(`Remotive: 获取到 ${jobs.length} 个职位`);
    return jobs;
  } catch (error) {
    console.error('获取Remotive职位失败:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * 简单的字符串哈希函数
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * 标准化职位数据格式
 */
export function normalizeJob(
  rawJob: RemoteOKJob | WWRItem | Web3CareerJob,
  source: 'remoteok' | 'weworkremotely' | 'web3career'
): Job {
  if (source === 'remoteok') {
    const job = rawJob as RemoteOKJob;
    return {
      id: `remoteok-${job.id}`,
      title: job.position || 'Untitled',
      company: job.company || 'Unknown',
      description: job.description || '',
      url: job.url || `https://remoteok.com/remote-jobs/${job.id}`,
      postedAt: new Date(job.epoch * 1000),
      source: 'remoteok',
    };
  } else if (source === 'weworkremotely') {
    const job = rawJob as WWRItem;
    // 从URL或标题生成唯一ID
    const urlMatch = job.link.match(/\/(\d+)/);
    const id = urlMatch ? `weworkremotely-${urlMatch[1]}` : `weworkremotely-${Date.now()}`;

    return {
      id,
      title: job.title || 'Untitled',
      company: extractCompanyFromTitle(job.title) || 'Unknown',
      description: job.description || '',
      url: job.link,
      postedAt: parseDate(job.pubDate),
      source: 'weworkremotely',
    };
  } else {
    // web3career
    const job = rawJob as Web3CareerJob;
    return {
      id: `web3career-${job.id}`,
      title: job.title || 'Untitled',
      company: job.company || 'Unknown',
      description: job.description || '',
      url: job.url || job.slug ? `https://web3.career/${job.slug}` : 'https://web3.career',
      postedAt: parseDate(job.published_at || job.created_at || new Date().toISOString()),
      source: 'web3career',
    };
  }
}

/**
 * 从标题中提取公司名称（WWR格式通常是 "职位 @ 公司"）
 */
function extractCompanyFromTitle(title: string): string | null {
  const match = title.match(/@\s*(.+)$/);
  return match ? match[1].trim() : null;
}

/**
 * 解析日期字符串
 */
function parseDate(dateString: string): Date {
  try {
    return new Date(dateString);
  } catch {
    return new Date();
  }
}

/**
 * 过滤24小时内发布的职位
 */
export function filterByTime(jobs: Job[], hoursThreshold: number = 24): Job[] {
  const now = new Date();
  const threshold = hoursThreshold * 60 * 60 * 1000; // 转换为毫秒

  return jobs.filter((job) => {
    const timeDiff = now.getTime() - job.postedAt.getTime();
    return timeDiff >= 0 && timeDiff <= threshold;
  });
}
