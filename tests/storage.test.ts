import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import {
  loadProcessedJobs,
  saveProcessedJob,
  isJobProcessed,
  clearProcessedJobs,
} from '../src/storage.js';

const TEST_STORAGE_PATH = join(process.cwd(), 'data', 'test_processed_jobs.json');

describe('Storage Module', () => {
  beforeEach(() => {
    // 清理测试文件
    if (existsSync(TEST_STORAGE_PATH)) {
      unlinkSync(TEST_STORAGE_PATH);
    }
  });

  afterEach(() => {
    // 清理测试文件
    if (existsSync(TEST_STORAGE_PATH)) {
      unlinkSync(TEST_STORAGE_PATH);
    }
  });

  describe('loadProcessedJobs', () => {
    it('应该返回空数组当文件不存在时', () => {
      const jobs = loadProcessedJobs(TEST_STORAGE_PATH);
      expect(jobs).toEqual([]);
    });

    it('应该从文件加载已处理的职位ID', () => {
      const testData = {
        jobIds: ['job1', 'job2', 'job3'],
        lastUpdated: new Date().toISOString(),
      };
      writeFileSync(TEST_STORAGE_PATH, JSON.stringify(testData, null, 2), 'utf-8');

      const jobs = loadProcessedJobs(TEST_STORAGE_PATH);
      expect(jobs).toEqual(['job1', 'job2', 'job3']);
    });
  });

  describe('saveProcessedJob', () => {
    it('应该保存新的职位ID到文件', () => {
      saveProcessedJob('job1', TEST_STORAGE_PATH);
      const jobs = loadProcessedJobs(TEST_STORAGE_PATH);
      expect(jobs).toContain('job1');
    });

    it('应该追加职位ID而不覆盖现有数据', () => {
      saveProcessedJob('job1', TEST_STORAGE_PATH);
      saveProcessedJob('job2', TEST_STORAGE_PATH);
      const jobs = loadProcessedJobs(TEST_STORAGE_PATH);
      expect(jobs).toHaveLength(2);
      expect(jobs).toContain('job1');
      expect(jobs).toContain('job2');
    });

    it('不应该保存重复的职位ID', () => {
      saveProcessedJob('job1', TEST_STORAGE_PATH);
      saveProcessedJob('job1', TEST_STORAGE_PATH);
      const jobs = loadProcessedJobs(TEST_STORAGE_PATH);
      expect(jobs).toHaveLength(1);
      expect(jobs).toEqual(['job1']);
    });
  });

  describe('isJobProcessed', () => {
    it('应该返回false当职位未处理时', () => {
      expect(isJobProcessed('job1', TEST_STORAGE_PATH)).toBe(false);
    });

    it('应该返回true当职位已处理时', () => {
      saveProcessedJob('job1', TEST_STORAGE_PATH);
      expect(isJobProcessed('job1', TEST_STORAGE_PATH)).toBe(true);
    });
  });

  describe('clearProcessedJobs', () => {
    it('应该清空所有已处理的职位', () => {
      saveProcessedJob('job1', TEST_STORAGE_PATH);
      saveProcessedJob('job2', TEST_STORAGE_PATH);
      clearProcessedJobs(TEST_STORAGE_PATH);
      const jobs = loadProcessedJobs(TEST_STORAGE_PATH);
      expect(jobs).toEqual([]);
    });
  });
});
