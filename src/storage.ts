import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { ProcessedJobs } from './types.js';

const DEFAULT_STORAGE_PATH = join(process.cwd(), 'data', 'processed_jobs.json');

/**
 * 加载已处理的职位ID列表
 */
export function loadProcessedJobs(storagePath: string = DEFAULT_STORAGE_PATH): string[] {
  if (!existsSync(storagePath)) {
    return [];
  }

  try {
    const content = readFileSync(storagePath, 'utf-8');
    const data: ProcessedJobs = JSON.parse(content);
    return data.jobIds || [];
  } catch (error) {
    console.warn(`无法读取存储文件 ${storagePath}:`, error);
    return [];
  }
}

/**
 * 保存已处理的职位ID
 */
export function saveProcessedJob(jobId: string, storagePath: string = DEFAULT_STORAGE_PATH): void {
  // 确保目录存在
  const dir = dirname(storagePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const existingIds = loadProcessedJobs(storagePath);

  // 避免重复
  if (existingIds.includes(jobId)) {
    return;
  }

  const data: ProcessedJobs = {
    jobIds: [...existingIds, jobId],
    lastUpdated: new Date().toISOString(),
  };

  try {
    writeFileSync(storagePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`无法写入存储文件 ${storagePath}:`, error);
    throw error;
  }
}

/**
 * 检查职位是否已处理
 */
export function isJobProcessed(jobId: string, storagePath: string = DEFAULT_STORAGE_PATH): boolean {
  const processedIds = loadProcessedJobs(storagePath);
  return processedIds.includes(jobId);
}

/**
 * 清空已处理的职位列表（用于测试或重置）
 */
export function clearProcessedJobs(storagePath: string = DEFAULT_STORAGE_PATH): void {
  const data: ProcessedJobs = {
    jobIds: [],
    lastUpdated: new Date().toISOString(),
  };

  const dir = dirname(storagePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  try {
    writeFileSync(storagePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`无法清空存储文件 ${storagePath}:`, error);
    throw error;
  }
}
