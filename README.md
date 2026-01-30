# AI-Powered Job Hunting Agent

一个基于 Node.js + TypeScript 的 AI 求职代理，自动从多个职位网站抓取职位数据，使用 AI 进行匹配度分析，并输出高匹配度的职位列表。支持多种 AI 服务提供商（DeepSeek、OpenAI、Groq、Together AI 等）。

## 功能特性

- 🔍 **多数据源抓取**: 从 RemoteOK 和 WeWorkRemotely 自动抓取职位
- 🤖 **AI智能分析**: 使用 AI API 分析职位与个人背景的匹配度（1-10分），支持多种 AI 服务提供商
- ⏰ **时间过滤**: 只处理24小时内发布的新职位
- 🚫 **去重机制**: 自动记录已处理职位，避免重复分析
- 📊 **评分筛选**: 只输出评分≥8的高匹配职位
- 🎨 **美观输出**: 使用 Chalk 美化控制台输出
- ⏱️ **定时任务**: 支持 Cron 定时自动运行（默认每6小时）

## 技术栈

- **Backend**: Node.js + TypeScript
- **HTTP客户端**: Axios
- **RSS解析**: fast-xml-parser
- **AI服务**: 支持多种 AI 服务提供商（DeepSeek、OpenAI、Groq、Together AI 等，使用 OpenAI 兼容 SDK）
- **定时任务**: node-cron
- **测试框架**: Vitest
- **Git Hooks**: Husky + lint-staged
- **代码格式化**: Prettier
- **存储**: JSON文件（本地）

## 项目结构

```
JobHacker-AI/
├── src/
│   ├── types.ts           # 类型定义
│   ├── config.ts          # 配置（背景信息、API端点）
│   ├── scraper.ts         # 数据抓取模块
│   ├── agent.ts           # AI分析模块（DeepSeek）
│   ├── storage.ts         # 已处理职位存储
│   ├── notification.ts    # 通知模块（预留）
│   └── index.ts           # 主入口/调度器
├── tests/
│   ├── scraper.test.ts
│   ├── agent.test.ts
│   └── storage.test.ts
├── data/
│   └── processed_jobs.json  # 已处理职位ID存储
├── .env                    # 环境变量（不提交）
├── .env.example           # 环境变量模板
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入你的 AI API Key:

```bash
cp .env.example .env
```

编辑 `.env` 文件，选择你使用的 AI 服务提供商：

#### 使用 DeepSeek（默认）

```env
AI_PROVIDER=deepseek
AI_API_KEY=your_deepseek_api_key_here
# 或使用旧配置（兼容）
# DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

#### 使用 OpenAI

```env
AI_PROVIDER=openai
AI_API_KEY=your_openai_api_key_here
# 或使用旧配置（兼容）
# OPENAI_API_KEY=your_openai_api_key_here
# AI_MODEL=gpt-4o-mini  # 可选，默认使用 gpt-4o-mini
```

#### 使用 Groq（快速且免费额度）

```env
AI_PROVIDER=groq
AI_API_KEY=your_groq_api_key_here
# AI_MODEL=llama-3.1-70b-versatile  # 可选
```

#### 使用 Together AI

```env
AI_PROVIDER=together
AI_API_KEY=your_together_api_key_here
# AI_MODEL=meta-llama/Llama-3-70b-chat-hf  # 可选
```

#### 使用自定义 OpenAI 兼容服务

```env
AI_PROVIDER=custom
AI_API_KEY=your_api_key_here
AI_BASE_URL=https://api.your-service.com/v1
AI_MODEL=your-model-name
```

### 3. 运行

```bash
# 开发模式（直接运行）
pnpm dev

# 或构建后运行
pnpm build
node dist/index.js
```

### 4. 运行测试

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage
```

## AI 服务提供商说明

项目支持多种 AI 服务提供商，所有提供商都使用 OpenAI 兼容的 API 格式，可以无缝切换。

### 支持的提供商

| 提供商          | 特点                 | 推荐场景             | 模型示例                                        |
| --------------- | -------------------- | -------------------- | ----------------------------------------------- |
| **DeepSeek**    | 性价比高，中文支持好 | 日常使用，中文分析   | `deepseek-chat`                                 |
| **OpenAI**      | 质量高，稳定可靠     | 生产环境，高质量分析 | `gpt-4o-mini`, `gpt-4`, `gpt-3.5-turbo`         |
| **Groq**        | 速度快，有免费额度   | 快速测试，开发调试   | `llama-3.1-70b-versatile`, `mixtral-8x7b-32768` |
| **Together AI** | 开源模型，价格低     | 成本敏感场景         | `meta-llama/Llama-3-70b-chat-hf`                |
| **Custom**      | 自定义服务           | 私有部署，企业内网   | 任意 OpenAI 兼容服务                            |

### 如何选择

- **追求性价比**: 推荐 DeepSeek
- **追求质量**: 推荐 OpenAI GPT-4o-mini 或 GPT-4
- **追求速度**: 推荐 Groq
- **追求成本**: 推荐 Together AI
- **企业内网**: 使用 Custom 配置私有服务

### 切换提供商

只需修改 `.env` 文件中的 `AI_PROVIDER` 和对应的 API Key，无需修改代码。

## 配置说明

### 用户背景信息

在 `src/config.ts` 中修改你的背景信息：

```typescript
export const userBackground: UserBackground = {
  experience: '3年前端工程师经验',
  skills: ['React', 'Next.js', 'TypeScript'],
  location: '中国',
  preferences: {
    remoteOnly: true,
    industries: ['AI', 'Web3'],
  },
};
```

### 过滤配置

在 `src/config.ts` 中调整过滤条件：

```typescript
export const filterConfig = {
  minScore: 8, // 最低评分（1-10）
  hoursThreshold: 24, // 只保留N小时内发布的职位
};
```

### 定时任务

默认每6小时运行一次，可通过环境变量 `CRON_SCHEDULE` 自定义：

```env
CRON_SCHEDULE=0 */6 * * *  # 每6小时
CRON_SCHEDULE=0 9 * * *    # 每天上午9点
CRON_SCHEDULE=*/30 * * * * # 每30分钟
```

Cron 表达式格式: `分钟 小时 日 月 星期`

## 输出示例

```
╔════════════════════════════════════╗
║   AI-Powered Job Hunting Agent    ║
╚════════════════════════════════════╝

🚀 开始抓取职位数据...

📡 从 RemoteOK 获取职位...
✓ 获取到 50 个职位
📡 从 WeWorkRemotely 获取职位...
✓ 获取到 30 个职位

⏰ 过滤24小时内的职位...
✓ 剩余 15 个职位
🔍 检查已处理的职位...
✓ 发现 8 个新职位

🤖 使用AI分析 8 个职位...

🎉 发现 3 个高匹配职位！

========================================
[9/10] Senior Frontend Engineer @ Web3 Startup
Posted: 2 小时前
Why: 完美匹配 - React/TypeScript技能要求，Web3领域，支持远程
Link: https://...
========================================
```

## 开发说明

### TDD 开发方法

本项目采用测试驱动开发（TDD）方法：

1. 先编写测试用例（`tests/*.test.ts`）
2. 实现功能代码（`src/*.ts`）
3. 运行测试确保通过

### 添加新的数据源

1. 在 `src/scraper.ts` 中添加新的抓取函数
2. 在 `src/index.ts` 中调用新函数
3. 确保返回的数据符合 `Job` 接口

### 集成通知功能

在 `src/notification.ts` 中实现 `sendNotification()` 函数，可以集成：

- Feishu Webhook
- Telegram Bot API
- Email (nodemailer)
- 其他通知渠道

## Git Hooks (Husky)

项目配置了 Husky Git Hooks，确保代码质量：

### Pre-commit Hook

在提交代码前自动运行：

- ✅ **lint-staged**: 只检查暂存的文件
  - TypeScript 类型检查
  - Prettier 格式化 JSON/Markdown 文件

### Pre-push Hook

在推送代码前自动运行：

- ✅ **完整测试套件**: 运行所有测试
- ✅ **构建检查**: 确保代码可以成功构建

### 手动运行

```bash
# 格式化代码
pnpm format

# 检查格式
pnpm format:check

# 类型检查
pnpm type-check
```

### 跳过 Hooks（不推荐）

如果确实需要跳过 hooks（例如紧急修复）：

```bash
# 跳过 pre-commit
git commit --no-verify

# 跳过 pre-push
git push --no-verify
```

## 注意事项

1. **API限制**: DeepSeek API 可能有调用频率限制，请合理设置定时任务间隔
2. **数据存储**: `processed_jobs.json` 会持续增长，建议定期清理或实现数据归档
3. **网络错误**: 抓取失败时会抛出错误，建议在生产环境添加重试机制
4. **环境变量**: 确保 `.env` 文件不被提交到版本控制（已在 `.gitignore` 中）
5. **Git Hooks**: `.husky` 目录需要提交到 Git，这样团队成员才能使用相同的 hooks

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
