/**
 * AI Script Worker - AI 剧本生成 Worker（消费者模式）
 * 职责：
 * 1. 从 Redis 队列接收生成任务
 * 2. 调用 AIScriptService 生成内容
 * 3. 更新任务状态（pending → processing → completed/failed）
 * 4. 发送事件回调
 * 5. 错误处理和重试
 */

import { Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { AIScriptGenerationTask, AIScriptGenerationResult } from '../common/ai-script/ai-script-types';
import { AIScriptService } from './ai-script.service';
import { EventBus, Event, SystemEvent } from '../common/event-bus/index';

// ==========================================
// Worker 配置
// ==========================================

interface AIWorkerConfig {
    queueName: string;
    redis: {
        host: string;
        port: number;
        password?: string;
        db?: number;
    };
    llm: {
        apiKey: string;
        model: string;
        baseUrl?: string;
        timeout?: number;
    };
    concurrency: number;      // 并发任务数
    maxRetries: number;      // 最大重试次数
    timeout: number;         // 任务超时（毫秒）
}

// ==========================================
// AI Script Worker 实现
// ==========================================

export class AIScriptWorker {
    private worker: Worker | null = null;
    private queueEvents: QueueEvents | null = null;
    private aiService: AIScriptService;
    private eventBus: EventBus;
    private redis: Redis;
    private config: AIWorkerConfig;

    constructor(config: AIWorkerConfig, eventBus: EventBus) {
        this.config = config;
        this.eventBus = eventBus;

        // 初始化 Redis 连接
        this.redis = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db || 0,
        });

        // 初始化 AI Script Service
        this.aiService = new AIScriptService(
            config.llm,
            eventBus
        );

        console.log('\n========================================');
        console.log('🤖 AI Script Worker - 工作进程');
        console.log('========================================');
        console.log(`队列名称: ${config.queueName}`);
        console.log(`并发任务数: ${config.concurrency}`);
        console.log(`最大重试次数: ${config.maxRetries}`);
        console.log(`任务超时: ${config.timeout}ms`);
        console.log('');

        // 初始化 Worker
        this.initializeWorker();

        // 初始化队列事件监听
        this.initializeQueueEvents();
    }

    /**
     * 初始化 Worker
     */
    private initializeWorker(): void {
        this.worker = new Worker(
            this.config.queueName,
            async (job: Job<AIScriptGenerationTask>) => this.processJob(job),
            {
                connection: this.redis,
                concurrency: this.config.concurrency,
                limiter: {
                    max: 10,      // 最多 10 个任务
                    duration: 10000 // 每 10 秒
                },
                defaultJobOptions: {
                    attempts: this.config.maxRetries,
                    backoff: {
                        type: 'exponential',
                        delay: 5000, // 首次重试延迟 5 秒
                    },
                    removeOnComplete: 100, // 保留 100 个完成任务
                    removeOnFail: 50,      // 保留 50 个失败任务
                    timeout: this.config.timeout,
                },
            }
        );

        console.log('✅ Worker 初始化完成');
    }

    /**
     * 初始化队列事件监听
     */
    private initializeQueueEvents(): void {
        this.queueEvents = new QueueEvents(this.config.queueName, {
            connection: this.redis,
        });

        // 监听任务完成事件
        this.queueEvents.on('completed', async ({ jobId, returnvalue }) => {
            console.log(`\n✅ 任务完成: ${jobId}`);
            console.log(`   结果: ${JSON.stringify(returnvalue).substring(0, 100)}...`);

            // 发送事件通知
            await this.eventBus.publishGachaPullStart({
                timestamp: new Date(),
                userId: 'system',
                characterId: undefined,
                metadata: {
                    jobId,
                    event: 'script_generated',
                    result: returnvalue
                }
            });
        });

        // 监听任务失败事件
        this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
            console.error(`\n❌ 任务失败: ${jobId}`);
            console.error(`   原因: ${failedReason}`);

            // 发送事件通知
            await this.eventBus.publishGachaPullStart({
                timestamp: new Date(),
                userId: 'system',
                characterId: undefined,
                metadata: {
                    jobId,
                    event: 'script_failed',
                    error: failedReason
                }
            });
        });

        // 监听任务进度更新
        this.queueEvents.on('progress', ({ jobId, data }) => {
            console.log(`📊 任务进度: ${jobId} - ${JSON.stringify(data)}`);
        });

        console.log('✅ 队列事件监听器已启动');
    }

    /**
     * 处理任务（核心逻辑）
     */
    private async processJob(job: Job<AIScriptGenerationTask>): Promise<AIScriptGenerationResult> {
        const { data } = job;
        const taskId = data.taskId;

        console.log('\n----------------------------------------');
        console.log(`📋 任务接收: ${taskId}`);
        console.log(`   用户ID: ${data.userId}`);
        console.log(`   NPC ID: ${data.companionId}`);
        console.log(`   场景类型: ${data.scenarioType}`);
        console.log('----------------------------------------');

        try {
            // ===== 步骤 1: 更新任务状态为 processing =====

            await job.updateProgress({
                status: 'processing',
                message: '正在生成剧本...',
                timestamp: new Date().toISOString()
            });

            // ===== 步骤 2: 调用 AI Script Service =====

            console.log('🤖 开始 AI 剧本生成...');
            const result = await this.aiService.generateScript(data);

            // ===== 步骤 3: 更新任务进度 =====

            await job.updateProgress({
                status: 'completed',
                message: '剧本生成完成',
                timestamp: new Date().toISOString(),
                nodesCount: result.nodes.length
            });

            // ===== 步骤 4: 状态回调（通知后端）=====

            await this.onTaskComplete(job, result);

            console.log(`\n✅ 任务处理完成: ${taskId}`);

            return result;

        } catch (error: any) {
            console.error(`\n❌ 任务处理失败: ${taskId}`);
            console.error(`   错误: ${error.message}`);
            console.error(`   堆栈: ${error.stack}`);

            // ===== 步骤 5: 状态回调（通知失败）=====

            await this.onTaskFailed(job, error);

            throw error; // 重新抛出，让 BullMQ 处理重试
        }
    }

    /**
     * 任务完成回调
     */
    private async onTaskComplete(job: Job<AIScriptGenerationTask>, result: AIScriptGenerationResult): Promise<void> {
        const { data } = job;

        console.log('\n📝 发送完成回调...');

        // TODO: 将结果保存到数据库
        // await this.db.query(`
        //     INSERT INTO script_generation_results (task_id, user_id, companion_id, result, created_at)
        //     VALUES ($1, $2, $3, $4, NOW())
        // `, [result.taskId, result.userId, result.companionId, JSON.stringify(result)]);

        console.log(`✅ 结果已保存到数据库`);

        // 发送 WebSocket 通知（如果前端连接）
        // await this.webSocketService.send(data.userId, {
        //     type: 'script_generated',
        //     taskId: result.taskId,
        //     nodes: result.nodes
        // });

        // console.log(`✅ WebSocket 通知已发送`);
    }

    /**
     * 任务失败回调
     */
    private async onTaskFailed(job: Job<AIScriptGenerationTask>, error: Error): Promise<void> {
        const { data } = job;

        console.log('\n📝 发送失败回调...');

        // TODO: 将错误记录保存到数据库
        // await this.db.query(`
        //     INSERT INTO script_generation_errors (task_id, user_id, companion_id, error_code, error_message, created_at)
        //     VALUES ($1, $2, $3, $4, $5, NOW())
        // `, [data.taskId, data.userId, data.companionId, error.name, error.message]);

        console.log(`✅ 错误已记录到数据库`);

        // 发送 WebSocket 通知（如果前端连接）
        // await this.webSocketService.send(data.userId, {
        //     type: 'script_failed',
        //     taskId: data.taskId,
        //     error: error.message
        // });

        // console.log(`✅ WebSocket 通知已发送`);
    }

    /**
     * 获取 Worker 状态
     */
    async getStatus(): Promise<{
        isRunning: boolean;
        queueName: string;
        activeCount: number;
        waitingCount: number;
        completedCount: number;
        failedCount: number;
    }> {
        if (!this.worker) {
            return {
                isRunning: false,
                queueName: this.config.queueName,
                activeCount: 0,
                waitingCount: 0,
                completedCount: 0,
                failedCount: 0
            };
        }

        const queue = this.worker.queue;
        const activeCount = await queue.getActiveCount();
        const waitingCount = await queue.getWaitingCount();
        const completedCount = await queue.getCompletedCount();
        const failedCount = await queue.getFailedCount();

        return {
            isRunning: this.worker.isRunning(),
            queueName: this.config.queueName,
            activeCount,
            waitingCount,
            completedCount,
            failedCount
        };
    }

    /**
     * 启动 Worker
     */
    async start(): Promise<void> {
        if (this.worker && !this.worker.isRunning()) {
            await this.worker.run();
            console.log('✅ Worker 已启动');
        }
    }

    /**
     * 停止 Worker
     */
    async stop(): Promise<void> {
        if (this.worker && this.worker.isRunning()) {
            await this.worker.close();
            console.log('🔴 Worker 已停止');
        }
    }

    /**
     * 关闭连接
     */
    async close(): Promise<void> {
        await this.stop();

        if (this.queueEvents) {
            await this.queueEvents.close();
            console.log('🔴 队列事件监听器已关闭');
        }

        if (this.redis) {
            await this.redis.quit();
            console.log('🔴 Redis 连接已关闭');
        }
    }

    /**
     * 优雅退出
     */
    async gracefulShutdown(): Promise<void> {
        console.log('\n🛑 收到退出信号，正在优雅退出...');

        await this.close();

        console.log('✅ 优雅退出完成');
        process.exit(0);
    }
}

// ==========================================
// 主入口（直接运行 Worker）
// ==========================================

if (require.main === module) {
    const config: AIWorkerConfig = {
        queueName: 'ai-script-generate',
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
        },
        llm: {
            apiKey: process.env.OPENAI_API_KEY || 'test-key',
            model: process.env.OPENAI_MODEL || 'gpt-4',
            baseUrl: process.env.OPENAI_BASE_URL,
            timeout: parseInt(process.env.LLM_TIMEOUT || '60000'), // 60 秒
        },
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3'), // 3 个并发任务
        maxRetries: parseInt(process.env.WORKER_MAX_RETRIES || '3'),
        timeout: parseInt(process.env.WORKER_TIMEOUT || '120000'), // 2 分钟
    };

    // 初始化 EventBus（简化版）
    const eventBus: any = {
        publishGachaPullStart: async (data: any) => {
            console.log('📡 事件通知:', data.metadata?.event);
        }
    };

    // 启动 Worker
    const worker = new AIScriptWorker(config, eventBus as any);

    // 注册进程退出信号
    process.on('SIGINT', () => worker.gracefulShutdown());
    process.on('SIGTERM', () => worker.gracefulShutdown());

    // 打印状态
    setInterval(async () => {
        const status = await worker.getStatus();
        console.log('\n📊 Worker 状态:', {
            isRunning: status.isRunning,
            active: status.activeCount,
            waiting: status.waitingCount,
            completed: status.completedCount,
            failed: status.failedCount
        });
    }, 30000); // 每 30 秒打印一次
}

export { AIScriptWorker };
