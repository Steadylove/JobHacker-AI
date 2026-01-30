import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchRemoteOKJobs, fetchWWRJobs, normalizeJob, filterByTime, } from '../src/scraper.js';
// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);
describe('Scraper Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('fetchRemoteOKJobs', () => {
        it('应该成功获取RemoteOK职位数据', async () => {
            const mockData = [
                {
                    id: '123',
                    position: 'Frontend Engineer',
                    company: 'Tech Corp',
                    description: 'React/TypeScript developer needed',
                    url: 'https://remoteok.com/remote-jobs/123',
                    epoch: Math.floor(Date.now() / 1000) - 3600, // 1小时前
                },
            ];
            mockedAxios.get.mockResolvedValueOnce({ data: mockData });
            const jobs = await fetchRemoteOKJobs();
            expect(jobs).toHaveLength(1);
            expect(jobs[0].title).toBe('Frontend Engineer');
            expect(jobs[0].source).toBe('remoteok');
        });
        it('应该处理API错误', async () => {
            mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
            await expect(fetchRemoteOKJobs()).rejects.toThrow();
        });
        it('应该过滤掉无效数据', async () => {
            const mockData = [
                { id: '123', position: 'Valid Job' },
                null,
                { id: '456' }, // 缺少必需字段
            ];
            mockedAxios.get.mockResolvedValueOnce({ data: mockData });
            const jobs = await fetchRemoteOKJobs();
            expect(jobs.length).toBeLessThanOrEqual(mockData.length);
        });
    });
    describe('fetchWWRJobs', () => {
        it('应该成功解析WWR RSS数据', async () => {
            const mockRSS = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Senior Frontend Developer</title>
              <link>https://weworkremotely.com/jobs/123</link>
              <description>Looking for React/Next.js expert</description>
              <pubDate>${new Date().toUTCString()}</pubDate>
            </item>
          </channel>
        </rss>`;
            mockedAxios.get.mockResolvedValueOnce({ data: mockRSS });
            const jobs = await fetchWWRJobs();
            expect(jobs.length).toBeGreaterThan(0);
            expect(jobs[0].source).toBe('weworkremotely');
        });
        it('应该处理RSS解析错误', async () => {
            mockedAxios.get.mockResolvedValueOnce({ data: 'invalid xml' });
            await expect(fetchWWRJobs()).rejects.toThrow();
        });
    });
    describe('normalizeJob', () => {
        it('应该正确标准化RemoteOK职位数据', () => {
            const rawJob = {
                id: '123',
                position: 'Frontend Engineer',
                company: 'Tech Corp',
                description: 'React developer',
                url: 'https://remoteok.com/jobs/123',
                epoch: Math.floor(Date.now() / 1000),
            };
            const normalized = normalizeJob(rawJob, 'remoteok');
            expect(normalized.id).toBe('remoteok-123');
            expect(normalized.title).toBe('Frontend Engineer');
            expect(normalized.source).toBe('remoteok');
            expect(normalized.postedAt).toBeInstanceOf(Date);
        });
        it('应该正确标准化WWR职位数据', () => {
            const rawJob = {
                title: 'Senior Developer',
                link: 'https://weworkremotely.com/jobs/456',
                description: 'TypeScript expert needed',
                pubDate: new Date().toUTCString(),
            };
            const normalized = normalizeJob(rawJob, 'weworkremotely');
            expect(normalized.id).toContain('weworkremotely');
            expect(normalized.title).toBe('Senior Developer');
            expect(normalized.source).toBe('weworkremotely');
        });
    });
    describe('filterByTime', () => {
        it('应该只保留24小时内的职位', () => {
            const now = new Date();
            const jobs = [
                {
                    id: '1',
                    title: 'Recent Job',
                    company: 'Company A',
                    description: 'Desc',
                    url: 'https://example.com/1',
                    postedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12小时前
                    source: 'remoteok',
                },
                {
                    id: '2',
                    title: 'Old Job',
                    company: 'Company B',
                    description: 'Desc',
                    url: 'https://example.com/2',
                    postedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000), // 48小时前
                    source: 'remoteok',
                },
            ];
            const filtered = filterByTime(jobs);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].id).toBe('1');
        });
        it('应该返回空数组当所有职位都超过24小时', () => {
            const now = new Date();
            const jobs = [
                {
                    id: '1',
                    title: 'Old Job',
                    company: 'Company A',
                    description: 'Desc',
                    url: 'https://example.com/1',
                    postedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
                    source: 'remoteok',
                },
            ];
            const filtered = filterByTime(jobs);
            expect(filtered).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=scraper.test.js.map