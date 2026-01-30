import { AnalyzedJob } from './types.js';

/**
 * 发送通知（预留函数，用于未来集成Feishu/Telegram等）
 * @param job 已分析的职位
 */
export async function sendNotification(job: AnalyzedJob): Promise<void> {
  // TODO: 实现通知逻辑
  // 可以集成：
  // - Feishu Webhook
  // - Telegram Bot API
  // - Email
  // - 其他通知渠道

  console.log(`[通知] 发现高匹配职位: ${job.title} @ ${job.company} (评分: ${job.score}/10)`);
}

/**
 * 批量发送通知
 * @param jobs 已分析的职位列表
 */
export async function sendNotifications(jobs: AnalyzedJob[]): Promise<void> {
  for (const job of jobs) {
    await sendNotification(job);
  }
}
