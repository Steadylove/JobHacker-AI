import { config } from 'dotenv';
import chalk from 'chalk';
import { schedule } from 'node-cron';
import {
  fetchRemoteOKJobs,
  fetchWWRJobs,
  fetchWeb3CareerJobs,
  fetchHNHiringJobs,
  fetchJobicyJobs,
  fetchCryptoJobsListJobs,
  fetchWorkingNomadsJobs,
  fetchRemotiveJobs,
  filterByTime,
} from './scraper.js';
import { analyzeJob } from './agent.js';
import { loadProcessedJobs, saveProcessedJob, isJobProcessed } from './storage.js';
import { sendNotification } from './notification.js';
import { filterConfig, getAIConfig } from './config.js';
import { AnalyzedJob, Job } from './types.js';

config();

/**
 * 格式化时间差为可读字符串
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours > 0) {
    return `${diffHours} 小时前`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} 分钟前`;
  } else {
    return '刚刚';
  }
}

/**
 * 打印职位信息到控制台
 */
function printJob(job: AnalyzedJob): void {
  const scoreColor = job.score >= 9 ? chalk.green : job.score >= 8 ? chalk.yellow : chalk.gray;

  console.log(chalk.cyan('========================================'));
  console.log(
    scoreColor(`[${job.score}/10]`),
    chalk.bold(`${job.title}`),
    chalk.dim(`@ ${job.company}`)
  );
  console.log(chalk.gray(`Posted: ${formatTimeAgo(job.postedAt)}`));
  console.log(chalk.white(`Why: ${job.reason}`));
  console.log(chalk.blue(`Link: ${job.url}`));
  console.log(chalk.cyan('========================================\n'));
}

/**
 * 主处理流程
 */
async function processJobs(): Promise<void> {
  console.log(chalk.bold.blue('\n🚀 开始抓取职位数据...\n'));

  try {
    // 1. 并行抓取所有数据源
    console.log(chalk.yellow('📡 并行获取所有数据源...'));

    const sources = [
      { name: 'RemoteOK', fetch: fetchRemoteOKJobs },
      { name: 'WeWorkRemotely', fetch: fetchWWRJobs },
      { name: 'Web3.career', fetch: fetchWeb3CareerJobs },
      { name: 'Hacker News', fetch: fetchHNHiringJobs },
      { name: 'Jobicy', fetch: fetchJobicyJobs },
      { name: 'CryptoJobsList', fetch: fetchCryptoJobsListJobs },
      { name: 'Working Nomads', fetch: fetchWorkingNomadsJobs },
      { name: 'Remotive', fetch: fetchRemotiveJobs },
    ];

    const results = await Promise.allSettled(sources.map((s) => s.fetch()));

    const allJobs: Job[] = [];
    results.forEach((result, index) => {
      const sourceName = sources[index].name;
      if (result.status === 'fulfilled') {
        console.log(chalk.green(`✓ ${sourceName}: ${result.value.length} 个职位`));
        allJobs.push(...result.value);
      } else {
        console.log(chalk.red(`✗ ${sourceName}: 获取失败`));
      }
    });

    console.log(chalk.bold.cyan(`\n📊 共获取到 ${allJobs.length} 个职位\n`));
    console.log(chalk.yellow(`\n⏰ 过滤24小时内的职位...`));
    const recentJobs = filterByTime(allJobs, filterConfig.hoursThreshold);
    console.log(chalk.green(`✓ 剩余 ${recentJobs.length} 个职位`));

    // 3. 去重
    console.log(chalk.yellow('🔍 检查已处理的职位...'));
    const processedIds = loadProcessedJobs();
    const newJobs = recentJobs.filter((job) => !isJobProcessed(job.id));
    console.log(chalk.green(`✓ 发现 ${newJobs.length} 个新职位`));

    if (newJobs.length === 0) {
      console.log(chalk.dim('\n✨ 没有新职位，下次再试！\n'));
      return;
    }

    // 4. AI分析
    console.log(chalk.yellow(`\n🤖 使用AI分析 ${newJobs.length} 个职位...\n`));
    const analyzedJobs: AnalyzedJob[] = [];

    for (let i = 0; i < newJobs.length; i++) {
      const job = newJobs[i];
      try {
        console.log(chalk.dim(`[${i + 1}/${newJobs.length}] 分析: ${job.title}...`));
        const analyzed = await analyzeJob(job);
        analyzedJobs.push(analyzed);

        // 保存已处理的ID
        saveProcessedJob(job.id);
      } catch (error) {
        console.error(chalk.red(`✗ 分析失败: ${job.title}`), error);
        // 即使分析失败，也标记为已处理，避免重复尝试
        saveProcessedJob(job.id);
      }
    }

    // 5. 过滤高分职位
    const highScoreJobs = analyzedJobs.filter((job) => job.score >= filterConfig.minScore);

    if (highScoreJobs.length === 0) {
      console.log(chalk.dim('\n✨ 没有评分≥8的职位\n'));
      return;
    }

    // 6. 输出结果
    console.log(chalk.bold.green(`\n🎉 发现 ${highScoreJobs.length} 个高匹配职位！\n`));

    // 按评分排序
    highScoreJobs.sort((a, b) => b.score - a.score);

    for (const job of highScoreJobs) {
      printJob(job);
      await sendNotification(job);
    }

    console.log(chalk.bold.blue('✅ 处理完成！\n'));
  } catch (error) {
    console.error(chalk.red('❌ 处理失败:'), error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  // 检查是否为单次运行模式（用于 CI/CD 环境）
  const isOnceMode = process.argv.includes('--once') || process.env.RUN_ONCE === 'true';

  console.log(chalk.bold.cyan('╔════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║   AI-Powered Job Hunting Agent    ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════╝\n'));

  // 检查环境变量
  try {
    const aiConfig = getAIConfig(); // 验证配置
    console.log(chalk.dim(`🤖 使用 AI 提供商: ${aiConfig.provider} (模型: ${aiConfig.model})\n`));
  } catch (error) {
    console.error(chalk.red('❌ 错误: AI API 配置无效'));
    console.log(
      chalk.yellow(
        '请创建 .env 文件并设置 AI_API_KEY 或 DEEPSEEK_API_KEY/OPENAI_API_KEY/ANTHROPIC_API_KEY'
      )
    );
    console.log(chalk.yellow('支持的提供商: deepseek, openai, claude, groq, together, custom'));
    if (error instanceof Error) {
      console.error(chalk.red(`错误详情: ${error.message}`));
    }
    process.exit(1);
  }

  // 执行一次
  await processJobs();

  // 单次运行模式：执行完毕后退出
  if (isOnceMode) {
    console.log(chalk.dim('\n🏁 单次运行模式，任务完成，退出程序。'));
    process.exit(0);
  }

  // 守护模式：设置定时任务
  const cronSchedule = process.env.CRON_SCHEDULE || '0 */6 * * *';
  console.log(chalk.dim(`\n⏰ 定时任务已设置: ${cronSchedule}`));
  console.log(chalk.dim('按 Ctrl+C 退出\n'));

  schedule(cronSchedule, async () => {
    await processJobs();
  });
}

// 处理未捕获的错误
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('未处理的错误:'), error);
  process.exit(1);
});

// 启动应用
main().catch((error) => {
  console.error(chalk.red('启动失败:'), error);
  process.exit(1);
});
