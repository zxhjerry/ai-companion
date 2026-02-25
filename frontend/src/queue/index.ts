/**
 * Redis + BullMQ + BullMQ 配置
 * 异步消息队列 + Worker 基础架构
 */

import Queue, QueueEvents, Job, DoneCallback } from 'bullmq';
import BullBoard from 'bull-board';
import Redis from 'ioredis';

/**
 * Redis 配置
 */
interface RedisOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;          // Redis 数据库（默认 0）
}

interface BullMQOptions {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  defaultJobOptions?: {
    attempts: number;
    backoff: {
      type: 'exponential',
      delay: number;
    };
  };
}

/**
 * 创建消息队列管理器 - 支持多种任务类型
 *
 * 职责：
 * 创建不同类型的队列（Gacha、AI 脚本生成等）
 * 添加 Worker 处理程序
 * 提供任务优先级、重试策略

 */
export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private redisOptions: RedisOptions;
  private bullOptions: BullMQOptions;

  constructor(redisOptions: RedisOptions, bullOptions?: Partial<BullMQOptions>) {
    this.redisOptions = redisOptions;
    this.bullOptions = { ...bullOptions, redis: redisOptions };

    // 初始化 Redis 连接
    this.redis = new Redis({
      port: this.redisOptions.port,
      host: this.redisOptions.host,
      password: this.redisOptions.password,
      db: this.redisOptions.db || 0,
      // 连接超时（10 秒）
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 2) return new Error('Redis 连接失败');
        return new Error('Redis 正在连接中...');
        return undefined;
      },
    });

    console.log(`✅ Redis 客户端已连接: ${this.redisOptions.host}:${this.redisOptions.port}`);
  }

  /**
   * 创建消息队列
   */
  createQueue<T = any>(
    queueName: string,
    processor: (job: Job<T>) => Promise<void>
  ): Queue<T> {
    const queue = new Queue<T>(
      queueName,
      {
        redis: this.redis,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, 5
          },
        },
      },
      {
        redis: this.redis,
      }
    );

    this.queues.set(queueName, queue);

    console.log(`✅ 队列已创建: ${queueName}`);
    return queue;
  }

  /**
   * 添加 Job 到队列
   */
  async addJob<T = any>(
    queueName: string,
    jobData: T,
    options?: object
  ): Promise<Job<T>> {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`队列不存在: ${queueName}`);
    }

    return queue.add(jobData, options);
  }

  /**
   * 获取队列实例
   */
  getQueue<T = any>(queueName: string): Queue<T> | undefined {
    return this.queues.get(queueName) as Queue<T>;
  }

  /**
   * 获取所有队列
   */
  getQueues(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * 暂停队列
   */
  async pauseQueue(queueName?: string): Promise<void> {
    if (queueName) {
      const queue = this.getQueue(queueName);
      if (queue) {
        await queue.pause();
        console.log(`✅ 队列已暂停: ${queueName}`);
      }
    } else {
      await Promise.all(
        Array.from(this.queues.values()).map(queue => queue.pause())
      );
      console.log('✅ 所有队列已暂停');
    }
  }

  /**
   * 恢复队列
   */
  async resumeQueue(queueName?: string): Promise<void> {
    if (queueName) {
      const queue = this.getQueue(queueName);
      if (queue) {
        await queue.resume();
        console.log(`✅ 队列已恢复: ${queueName}`);
      }
    } else {
      await Promise.all(
        Array.from(this.queues.values()).map(queue => queue.resume())
      );
      console.log('✅ 所有队列已恢复');
    }
  }

  /**
   * 清理失败的 Job（所有队列）
   */
  async cleanFailedJobs(queueName?: string): Promise<number> {
    const queues = queueName
      ? [this.getQueue(queueName)!]
      : Array.from(this.queues.values());

    let totalCleaned = 0;

    for (const queue of queues) {
      const failed = await queue.getFailed(10);
      console.log(`${queue.name}: ${failed.length}  个失败任务`);

      for (const job of failed) {
        await job.remove();
      }

      totalCleaned += failed.length;
    }

    console.log(`✅ 清理完成：${totalCleaned} 个失败任务`);
    return totalCleaned;
  }

  /**
   * 清理指定 Job
   */
  async cleanJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      return false;
    }

    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`✅ 已清理任务: ${jobId}`);
      return true;
    }

    return false;
  }

  /**
   * 关闭所有队列
   */
  async closeAll(): Promise<void> {
    await this.redis.quit();
    console.log('🔴 Redis 连接已关闭');
  }

  // ===== 便捷方法 =====

  /**
   * Gacha 队列专用：添加抽卡任务
   */
  async addGachaJob(gachaRequest: any): Promise<any> {
    return this.addJob('gacha-pull', gachaRequest);
  }

  /**
   * AI Script 队列专用：添加 AI 生成任务
   */
  async addAIScriptJob(scriptRequest: any): Promise<any> {
    return this.addJob('ai-script-generate', scriptRequest);
  }

  /**
   * Inventory 队列专用：装备属性计算
   */
  async addInventoryUpdateJob(inventoryUpdateRequest: any): Promise<any> {
    return this.addJob('inventory-calculate', inventoryUpdateRequest);
  }
  
  /**
   * 测试连接状态
   */
  async getHealthStatus(): Promise<{ redis: boolean; queues: Record<string, boolean> }> {
    try {
      await this.redis.ping();
      const redisOk = true;

      const queues: Record<string, boolean> = {};
      for (const [name, queue] of this.queues.entries()) {
        queues[name] = await queue.isRunning();
      }

      return {
        redis: redisOk,
        queues
      };
    } catch (error) {
      console.error('❌ 集群检查失败:', error);
      return {
        redis: false,
        queues: {}
      };
    }
  }
}

// ===== 导出 =====

export {
  Queue,
  QueueManager
};
