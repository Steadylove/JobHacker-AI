import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OpenAI from 'openai';
import { analyzeJob, buildPrompt, parseAIResponse } from '../src/agent.js';
import { Job } from '../src/types.js';
import { userBackground } from '../src/config.js';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn(),
  };
});

describe('Agent Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildPrompt', () => {
    it('应该构建包含职位信息和评分标准的提示词', () => {
      const job: Job = {
        id: '1',
        title: 'Frontend Engineer',
        company: 'Tech Corp',
        description: 'Looking for React/TypeScript developer',
        url: 'https://example.com',
        postedAt: new Date(),
        source: 'remoteok',
      };

      const prompt = buildPrompt(job, userBackground);
      // 检查新的 prompt 格式
      expect(prompt).toContain('前端开发相关职位');
      expect(prompt).toContain('支持远程工作');
      expect(prompt).toContain('Frontend Engineer');
      expect(prompt).toContain('Tech Corp');
      expect(prompt).toContain('Looking for React/TypeScript developer');
      expect(prompt).toContain('JSON格式');
      expect(prompt).toContain('8-10');
    });
  });

  describe('parseAIResponse', () => {
    it('应该正确解析有效的AI响应', () => {
      const validResponse = '{"score": 8, "reason": "完美匹配React技能"}';
      const result = parseAIResponse(validResponse);
      expect(result.score).toBe(8);
      expect(result.reason).toBe('完美匹配React技能');
    });

    it('应该处理包含代码块的JSON响应', () => {
      const responseWithCode = '```json\n{"score": 9, "reason": "Great match"}\n```';
      const result = parseAIResponse(responseWithCode);
      expect(result.score).toBe(9);
      expect(result.reason).toBe('Great match');
    });

    it('应该处理无效的JSON响应', () => {
      const invalidResponse = '这不是有效的JSON';
      expect(() => parseAIResponse(invalidResponse)).toThrow();
    });

    it('应该验证评分范围', () => {
      const invalidScore = '{"score": 15, "reason": "test"}';
      expect(() => parseAIResponse(invalidScore)).toThrow();
    });
  });

  describe('analyzeJob', () => {
    beforeEach(() => {
      // 设置环境变量，避免 getAIConfig() 报错
      process.env.AI_API_KEY = 'test-key';
      process.env.AI_PROVIDER = 'deepseek';
    });

    afterEach(() => {
      delete process.env.AI_API_KEY;
      delete process.env.AI_PROVIDER;
    });

    it('应该成功分析职位并返回评分和理由', async () => {
      const job: Job = {
        id: '1',
        title: 'Frontend Engineer',
        company: 'Tech Corp',
        description: 'React/TypeScript developer needed',
        url: 'https://example.com',
        postedAt: new Date(),
        source: 'remoteok',
      };

      const mockResponse = {
        choices: [
          {
            message: {
              content: '{"score": 8, "reason": "完美匹配React和TypeScript技能要求"}',
            },
          },
        ],
      };

      const mockChat = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockResponse),
          },
        },
      };

      (OpenAI as any).mockImplementation(() => mockChat);

      const result = await analyzeJob(job, userBackground);
      expect(result.score).toBe(8);
      expect(result.reason).toContain('React');
      expect(mockChat.chat.completions.create).toHaveBeenCalled();
    });

    it('应该处理API错误', async () => {
      const job: Job = {
        id: '1',
        title: 'Test Job',
        company: 'Test',
        description: 'Test',
        url: 'https://example.com',
        postedAt: new Date(),
        source: 'remoteok',
      };

      const mockChat = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('API Error')),
          },
        },
      };

      (OpenAI as any).mockImplementation(() => mockChat);

      await expect(analyzeJob(job, userBackground)).rejects.toThrow();
    });
  });
});
