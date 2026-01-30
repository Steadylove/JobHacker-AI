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

/**
 * 从RemoteOK API获取职位数据
 */
export async function fetchRemoteOKJobs(): Promise<Job[]> {
  try {
    const response = await axios.get<RemoteOKJob[]>(apiEndpoints.remoteok);
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
 * 标准化职位数据格式
 */
export function normalizeJob(
  rawJob: RemoteOKJob | WWRItem,
  source: 'remoteok' | 'weworkremotely'
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
  } else {
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
