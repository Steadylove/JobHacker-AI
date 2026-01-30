import { describe, it, expect, vi, beforeEach } from 'vitest';
import OpenAI from 'openai';
import { analyzeJob, buildPrompt, parseAIResponse } from '../src/agent.js';
import { userBackground } from '../src/config.js';
// Mock OpenAI
vi.mock('openai');
describe('Agent Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('buildPrompt', () => {
        it('应该构建包含用户背景和职位描述的提示词', () => {
            const job = {
                id: '1',
                title: 'Frontend Engineer',
                company: 'Tech Corp',
                description: 'Looking for React/TypeScript developer',
                url: 'https://example.com',
                postedAt: new Date(),
                source: 'remoteok',
            };
            const prompt = buildPrompt(job, userBackground);
            expect(prompt).toContain('3年前端工程师经验');
            expect(prompt).toContain('React/Next.js');
            expect(prompt).toContain('Looking for React/TypeScript developer');
            expect(prompt).toContain('JSON格式');
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
        it('应该成功分析职位并返回评分和理由', async () => {
            const job = {
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
                completions: {
                    create: vi.fn().mockResolvedValue(mockResponse),
                },
            };
            OpenAI.mockImplementation(() => mockChat);
            const result = await analyzeJob(job, userBackground);
            expect(result.score).toBe(8);
            expect(result.reason).toContain('React');
            expect(mockChat.completions.create).toHaveBeenCalled();
        });
        it('应该处理API错误', async () => {
            const job = {
                id: '1',
                title: 'Test Job',
                company: 'Test',
                description: 'Test',
                url: 'https://example.com',
                postedAt: new Date(),
                source: 'remoteok',
            };
            const mockChat = {
                completions: {
                    create: vi.fn().mockRejectedValue(new Error('API Error')),
                },
            };
            OpenAI.mockImplementation(() => mockChat);
            await expect(analyzeJob(job, userBackground)).rejects.toThrow();
        });
    });
});
//# sourceMappingURL=agent.test.js.map