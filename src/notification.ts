import axios from 'axios';
import { AnalyzedJob } from './types.js';

/**
 * Telegram 配置
 */
interface TelegramConfig {
  botToken: string;
  chatId: string;
}

/**
 * 获取 Telegram 配置
 */
function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return null;
  }

  return { botToken, chatId };
}

/**
 * 格式化职位信息为 Telegram 消息
 */
function formatJobMessage(job: AnalyzedJob): string {
  const scoreEmoji = job.score >= 9 ? '🔥' : job.score >= 8 ? '⭐' : '✨';

  return `
${scoreEmoji} *${job.score}/10* | ${escapeMarkdown(job.title)}

🏢 *公司*: ${escapeMarkdown(job.company)}
📝 *理由*: ${escapeMarkdown(job.reason)}
🔗 [查看职位](${job.url})
📍 来源: ${job.source}
`.trim();
}

/**
 * 转义 Markdown 特殊字符
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

/**
 * 发送 Telegram 消息
 */
async function sendTelegramMessage(config: TelegramConfig, message: string): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;

    await axios.post(
      url,
      {
        chat_id: config.chatId,
        text: message,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false,
      },
      {
        proxy: false,
        timeout: 10000,
      }
    );

    return true;
  } catch (error) {
    console.error('Telegram 发送失败:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * 发送通知
 * @param job 已分析的职位
 */
export async function sendNotification(job: AnalyzedJob): Promise<void> {
  // 控制台输出
  console.log(`[通知] 发现高匹配职位: ${job.title} @ ${job.company} (评分: ${job.score}/10)`);

  // Telegram 通知
  const telegramConfig = getTelegramConfig();
  if (telegramConfig) {
    const message = formatJobMessage(job);
    const success = await sendTelegramMessage(telegramConfig, message);
    if (success) {
      console.log(`[Telegram] ✓ 已发送: ${job.title}`);
    }
  }
}

/**
 * 批量发送通知
 * @param jobs 已分析的职位列表
 */
export async function sendNotifications(jobs: AnalyzedJob[]): Promise<void> {
  const telegramConfig = getTelegramConfig();

  if (telegramConfig && jobs.length > 0) {
    // 发送汇总消息
    const summaryMessage = `
🎯 *Job Hunter 发现 ${jobs.length} 个高匹配职位\\!*

${jobs.map((j, i) => `${i + 1}\\. ${escapeMarkdown(j.title)} \\(${j.score}/10\\)`).join('\n')}
`.trim();

    await sendTelegramMessage(telegramConfig, summaryMessage);
  }

  // 逐个发送详情
  for (const job of jobs) {
    await sendNotification(job);
    // 避免触发 Telegram 频率限制
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * 发送测试消息
 */
export async function sendTestNotification(): Promise<boolean> {
  const telegramConfig = getTelegramConfig();

  if (!telegramConfig) {
    console.log('Telegram 未配置，跳过测试');
    return false;
  }

  const testMessage = `
🤖 *Job Hunter 测试消息*

✅ Telegram 通知已成功配置\\!
⏰ 时间: ${escapeMarkdown(new Date().toISOString())}
`.trim();

  return await sendTelegramMessage(telegramConfig, testMessage);
}
