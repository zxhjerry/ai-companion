/**
 * BullMQ Queue Manager - 企业级消息队列基础设施
 *
 * 特性：
 * - Redis 驱动
 * - 多队列支持
 * - Worker 管理
 * - 重试机制
 * - 速率限制
 */

import { Queue, Worker, QueueEvents, Job, Redis } from 'bullmq';
import { logger } from '../infrastructure/logger';

/**
 * Redis 配置
 */
export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number;
    maxReconnectionAttempts?: number;
}

/**
 * 队列配置
 */
export interface QueueConfig {
    queueName: string;

    // Worker 配置
    concurrency?: number;
    limiter?: {
        max: number;
        duration: number;
    };

    // 重试配置
    attempts?: number;
    backoff?: {
        type: 'exponential' | 'fixed';
        delay: number;
    };

    // 清理配置
    removeOnComplete?: number;
    removeOnFail?: number;
}

/**
 * 队列状态
 */
export interface QueueStatus {
    queueName: string;
    total: number;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
}

/**
 * 队列管理器
 */
export class QueueManager {
    private queues: Map<string, Queue> = new Map();
    private workers: Map<string, Worker> = new Map();
    private queueEvents: Map<string, QueueEvents> = new Map();
    private redis: Redis;

    constructor(redisConfig: RedisConfig) {
        // 创建 Redis 连接
        this.redis = new Redis({
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            db: redisConfig.db || 0,
            maxRetriesPerRequest: redisConfig.maxRetriesPerRequest || null,
            maxReconnectionAttempts: redisConfig.maxReconnectionAttempts || 3,

            // 连接优化
            enableOfflineQueue: false,
            enableReadyCheck: true,
            retryStrategy: (times: number) => {
                if (times > 2) {
                    throw new Error('Redis 连接失败');
                }
                return times * 1000;
            },
        });

        // 监听 Redis 连接事件
        this.redis.on('connect', () => {
            logger.info('✅ Redis 连接成功');
        });

        this.redis.on('error', (error: Error) => {
            logger.error('❌ Redis 连接错误:', error);
        });
    }

    /**
     * 创建队列
     */
    createQueue<T = any>(
        config: QueueConfig
    ): Queue<T> {
        const { queueName, removeOnComplete = 100, removeOnFail = 50 } = config;

        if (this.queues.has(queueName)) {
            return this.queues.get(queueName)!;
        }

        const queue = new Queue<T>(queueName, {
            connection: this.redis,
            defaultJobOptions: {
                removeOnComplete,
                removeOnFail,
                attempts: config.attempts || 3,
                backoff: config.backoff || {
                    type: 'exponential',
                    delay: 5000,
                },
            },
        });

        this.queues.set(queueName, queue);

        logger.info(`✅ 队列已创建: ${queueName}`);

        return queue;
    }

    /**
     * 创建 Worker
     */
    createWorker<T = any>(
        queueName: string,
        processor: (job: Job<T>) => Promise<void>,
        config: Omit<QueueConfig, 'queueName'> = {}
    ): Worker<T> {
        // 确保队列存在
        this.createQueue({ queueName, ...config });

        const { concurrency = 3, limiter } = config;

        const worker = new Worker<T>(
            queueName,
            processor,
            {
                connection: this.redis,
                concurrency,

                // 限制配置
                limiter: limiter
                    ? limiter
                    : {
                          max: 10,
                          duration: 10000,
                      },

                // 环境变量
                env: process.env as any,

                removeOnComplete: config.removeOnComplete || 1000,
                removeOnFail: config.removeOnFail || 500,
                timeout: 60000, // 1 分钟
            }
        );

        this.workers.set(queueName, worker);

        // 监听 Worker 事件
        worker.on('completed', (job: Job<T>) => {
            logger.info(`✅ Queue Worker 完成: ${queueName} - Job: ${job.id}`);
        });

        worker.on('failed', (job: Job<T> | undefined, error: Error) => {
            logger.error(`❌ Queue Worker 失败: ${queueName}`, {
                jobId: job?.id,
                error: error.message,
            });
        });

        worker.on('error', (error: Error) => {
            logger.error(`❌ Queue Worker 错误: ${queueName}`, error);
        });

        logger.info(`✅ Worker 已创建: ${queueName}`);

        return worker;
    }

    /**
     * 添加 Job 到队列
     */
    async addJob<T = any>(
        queueName: string,
        jobData: T,
        options?: object
    ): Promise<Job<T>> {
        const queue = this.getQueue<T>(queueName);

        if (!queue) {
            throw new Error(`队列不存在: ${queueName}`);
        }

        const job = await queue.add(jobData, options);

        logger.info(`📤 Job 已添加: ${queueName} - Job: ${job.id}`);

        return job;
    }

    /**
     * 批量添加 Job
     */
    async addBatchJobs<T = any>(
        queueName: string,
        jobs: Array<{ data: T; options?: object }>
    ): Promise<Job<T>[]> {
        const queue = this.getQueue<T>(queueName);

        if (!queue) {
            throw new Error(`队列不存在: ${queueName}`);
        }

        const jobObjects = jobs.map(job => ({
            name: 'job',
            data: job.data,
            opts: job.options,
        }));

        const addedJobs = await queue.addBulk(jobObjects);

        logger.info(`📤 已添加 ${jobs.length} 个 Job 到: ${queueName}`);

        return addedJobs;
    }

    /**
     * 获取队列
     */
    getQueue<T = any>(queueName: string): Queue<T> | undefined {
        return this.queues.get(queueName) as Queue<T>;
    }

    /**
     * 获取所有队列名称
     */
    getQueueNames(): string[] {
        return Array.from(this.queues.keys());
    }

    /**
     * 获取队列状态
     */
    async getQueueStatus(queueName: string): Promise<QueueStatus> {
        const queue = this.getQueue(queueName);

        if (!queue) {
            throw new Error(`队列不存在: ${queueName}`);
        }

        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
        ]);

        return {
            queueName,
            total: waiting + active + completed + failed + delayed,
            waiting,
            active,
            completed,
            failed,
            delayed,
            paused: await queue.isPaused(),
        };
    }

    /**
     * 获取所有队列状态
     */
    async getAllQueueStatus(): Promise<QueueStatus[]> {
        const statusPromises = this.queues.keys().map(
            async (queueName) => this.getQueueStatus(queueName)
        );

        return Promise.all(statusPromises);
    }

    /**
     * 暂停队列
     */
    async pauseQueue(queueName: string): Promise<void> {
        const queue = this.getQueue(queueName);

        if (!queue) {
            throw new Error(`队列不存在: ${queueName}`);
        }

        await queue.pause();
        logger.info(`⏸️ 队列已暂停: ${queueName}`);
    }

    /**
     * 恢复队列
     */
    async resumeQueue(queueName: string): Promise<void> {
        const queue = this.getQueue(queueName);

        if (!queue) {
            throw new Error(`队列不存在: ${queueName}`);
        }

        await queue.resume();
        logger.info(`▶️ 队列已恢复: ${queueName}`);
    }

    /**
     * 清理队列
     */
    async cleanQueue(
        queueName: string,
        grace: number = 1000,
        limit: number = 1000
    ): Promise<{ jobs: string[]; count: number }> {
        const queue = this.getQueue(queueName);

        if (!queue) {
            throw new Error(`队列不存在: ${queueName}`);
        }

        const jobs = await queue.clean(grace, limit);

        logger.info(`🧹 队列已清理: ${queueName} - ${jobs.length} 个 Job`);

        return {
            jobs: jobs.map((job: Job) => job.id as string),
            count: jobs.length,
        };
    }

    /**
     * 关闭所有队列和 Worker
     */
    async close(): Promise<void> {
        // 关闭所有 Worker
        for (const [queueName, worker] of this.workers.entries()) {
            await worker.close();
            logger.info(`🔴 Worker 已关闭: ${queueName}`);
        }

        this.workers.clear();

        // 关闭所有队列
        for (const [queueName, queue] of this.queues.entries()) {
            await queue.close();
            logger.info(`🔴 队列已关闭: ${queueName}`);
        }

        this.queues.clear();

        // 关闭 Redis 连接
        await this.redis.quit();
        logger.info('🔴 Redis 连接已关闭');
    }

    /**
     * Redis 心跳检查
     */
    async checkRedisHealth(): Promise<{ success: boolean; error?: string }> {
        try {
            await this.redis.ping();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}

// ==========================================
// 单例模式
// ==========================================

let queueManager: QueueManager | null = null;

/**
 * 获取队列管理器单例
 */
export function getQueueManager(config?: Partial<RedisConfig>): QueueManager {
    if (!queueManager) {
        const envConfig: RedisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
            maxRetriesPerRequest: 3,
            maxReconnectionAttempts: 3,
        };

        const finalConfig = { ...envConfig, ...config };

        queueManager = new QueueManager(finalConfig);
    }

    return queueManager;
}

export default getQueueManager;
