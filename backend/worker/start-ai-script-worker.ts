#!/usr/bin/env node

/**
 * AI Script Worker - 启动入口
 * 运行方式：
 *   npm run worker:ai-script
 *   或
 *   ts-node backend/worker/ai-script-worker.ts
 */

import { AIScriptWorker } from './ai-script-worker';
import { EventBus } from '../common/event-bus/index';

import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// ==========================================
// Worker 配置
// ==========================================

const workerConfig = {
    queueName: 'ai-script-generate',
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
    },
    llm: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4',
        baseUrl: process.env.OPENAI_BASE_URL,
        timeout: parseInt(process.env.LLM_TIMEOUT || '60000'), // 60 秒
    },
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3'), // 3 个并发任务
    maxRetries: parseInt(process.env.WORKER_MAX_RETRIES || '3'),
    timeout: parseInt(process.env.WORKER_TIMEOUT || '120000'), // 2 分钟
};

// ==========================================
// 事件总线（简化版）
// ==========================================

const createEventBus = (): any => {
    // 简化实现，实际应使用完整的 EventBus
    return {
        publishGachaPullStart: async (data: any) => {
            console.log('📡 事件通知:', JSON.stringify(data.metadata, null, 2));
        },

        publishItemObtained: async (data: any) => {
            console.log('📡 物品获得事件:', JSON.stringify(data.metadata, null, 2));
        },

        publishLevelUp: async (data: any) => {
            console.log('📡 等级提升事件:', JSON.stringify(data.metadata, null, 2));
        }
    };
};

// ==========================================
// 启动 Worker
// ==========================================

async function startWorker() {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║          🤖 AI Script Worker - 剧本生成 Worker            ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');

    // 检查必需的环境变量
    if (!workerConfig.llm.apiKey) {
        console.error('❌ 缺少必需的环境变量: OPENAI_API_KEY');
        console.error('   请在 .env 文件中设置:\n   OPENAI_API_KEY=your_api_key\n');
        process.exit(1);
    }

    // 初始化 EventBus
    const eventBus = createEventBus();

    // 创建并启动 Worker
    const worker = new AIScriptWorker(workerConfig, eventBus);

    // 注册进程退出信号
    process.on('SIGINT', () => worker.gracefulShutdown());
    process.on('SIGTERM', () => worker.gracefulShutdown());

    // 注册未捕获异常处理
    process.on('uncaughtException', (error) => {
        console.error('\n❌ 未捕获的异常:', error);
        worker.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('\n❌ 未处理的 Promise 拒绝:', reason);
        worker.gracefulShutdown();
    });

    // 打印启动信息
    console.log('✅ Worker 启动信息:');
    console.log(`   队列名称: ${workerConfig.queueName}`);
    console.log(`   Redis: ${workerConfig.redis.host}:${workerConfig.redis.port}`);
    console.log(`   并发任务数: ${workerConfig.concurrency}`);
    console.log(`   最大重试次数: ${workerConfig.maxRetries}`);
    console.log(`   任务超时: ${workerConfig.timeout}ms`);
    console.log(`   LLM 模型: ${workerConfig.llm.model}`);
    console.log('\n');

    // 定期打印状态（每 30 秒）
    setInterval(async () => {
        try {
            const status = await worker.getStatus();

            console.log('\n📊 Worker 状态:');
            console.log(`   运行状态: ${status.isRunning ? '✅ 运行中' : '🔴 已停止'}`);
            console.log(`   处理中任务: ${status.activeCount}`);
            console.log(`   等待中任务: ${status.waitingCount}`);
            console.log(`   已完成任务: ${status.completedCount}`);
            console.log(`   失败任务: ${status.failedCount}`);
            console.log('');

        } catch (error) {
            console.error('❌ 获取 Worker 状态失败:', error);
        }
    }, 30000);

    // 注册启动完成事件
    console.log('✅ AI Script Worker 已启动并运行中...');
    console.log('   按 Ctrl+C 停止 Worker\n');
}

// ==========================================
// 执行启动
// ==========================================

startWorker().catch((error) => {
    console.error('\n❌ Worker 启动失败:', error);
    process.exit(1);
});
