import OpenAI from 'openai';
import axios from 'axios';
import { Job, AnalyzedJob, UserBackground } from './types.js';
import { getAIConfig, userBackground as defaultBackground, AIConfig } from './config.js';
import { config } from 'dotenv';

config();

/**
 * 创建 OpenAI 客户端（兼容所有 OpenAI API 格式的服务）
 */
function createOpenAIClient(aiConfig: AIConfig) {
  const clientConfig: {
    apiKey: string;
    baseURL?: string;
  } = {
    apiKey: aiConfig.apiKey,
  };

  if (aiConfig.baseURL) {
    clientConfig.baseURL = aiConfig.baseURL;
  }

  return new OpenAI(clientConfig);
}

/**
 * 调用 Claude (Anthropic) API
 */
async function callClaudeAPI(
  aiConfig: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: aiConfig.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
      temperature: aiConfig.temperature,
    },
    {
      proxy: false,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': aiConfig.apiKey,
        'anthropic-version': '2023-06-01',
      },
      timeout: 30000,
    }
  );

  const content = response.data?.content?.[0]?.text;
  if (!content) {
    throw new Error('Claude API 返回空响应');
  }

  return content;
}

/**
 * 构建AI分析提示词
 */
export function buildPrompt(job: Job, background: UserBackground = defaultBackground): string {
  return `你是一个招聘匹配专家。请分析以下职位描述与候选人背景的匹配度。

候选人背景：
- ${background.experience}
- 擅长 ${background.skills.join('、')}
- 坐标${background.location}，${background.preferences.remoteOnly ? '寻找远程工作' : '可接受远程或本地工作'}
- 对 ${background.preferences.industries.join(' 或 ')} 初创公司感兴趣

职位信息：
- 标题：${job.title}
- 公司：${job.company}
- 描述：${job.description.substring(0, 2000)}${job.description.length > 2000 ? '...' : ''}

请返回JSON格式（不要包含任何其他文字或代码块标记）：
{"score": 1-10, "reason": "一句话说明匹配原因"}

评分标准：
- 1-3: 完全不匹配
- 4-5: 部分匹配但差距较大
- 6-7: 基本匹配，有一些优势
- 8-9: 高度匹配，非常适合
- 10: 完美匹配`;
}

/**
 * 解析AI响应
 */
export function parseAIResponse(response: string): { score: number; reason: string } {
  // 移除可能的代码块标记
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```\n?/g, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    const score = Number(parsed.score);
    const reason = String(parsed.reason || '');

    if (isNaN(score) || score < 1 || score > 10) {
      throw new Error(`无效的评分: ${score}，必须在1-10之间`);
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('缺少匹配理由');
    }

    return { score, reason: reason.trim() };
  } catch (error) {
    console.error('解析AI响应失败:', error);
    console.error('原始响应:', response);
    throw new Error(`无法解析AI响应: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 使用AI分析职位匹配度
 */
export async function analyzeJob(
  job: Job,
  background: UserBackground = defaultBackground
): Promise<AnalyzedJob> {
  const aiConfig = getAIConfig();
  const prompt = buildPrompt(job, background);
  const systemPrompt = '你是一个专业的招聘匹配分析专家，擅长评估职位与候选人的匹配度。';

  try {
    let content: string;

    if (aiConfig.provider === 'claude') {
      // 使用 Claude API
      content = await callClaudeAPI(aiConfig, systemPrompt, prompt);
    } else {
      // 使用 OpenAI 兼容 API
      const openai = createOpenAIClient(aiConfig);
      const completion = await openai.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: aiConfig.temperature,
        response_format: { type: 'json_object' },
      });

      content = completion.choices[0]?.message?.content || '';
      if (!content) {
        throw new Error('AI返回空响应');
      }
    }

    const { score, reason } = parseAIResponse(content);

    return {
      ...job,
      score,
      reason,
    };
  } catch (error) {
    console.error(`分析职位失败 [${job.id}]:`, error);
    throw error;
  }
}
