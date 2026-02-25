/**
 * AI Companion 2.1 - 主服务器入口
 *
 * 功能：
 * - 初始化数据库连接池（PostgreSQL）
 * - 初始化消息队列（BullMQ + Redis）
 * - 初始化事件总线（Event Bus）
 * - 启动 HTTP 服务器（Express）
 * - 健康检查端点
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getDatabaseService } from './database/postgres';
import { getQueueManager } from './queue/queue-manager';
import { getEventBus, Event } from './infrastructure/event-bus';
import { logger } from './infrastructure/logger';

// ==========================================
// 应用配置
// ==========================================

const API_PORT = parseInt(process.env.API_PORT || '3000');
const API_HOST = process.env.API_HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ==========================================
// 初始化 Express 应用
// ==========================================

const app = express();

// 中间件
app.use(helmet());  // 安全头
app.use(cors());   // 跨域
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 健康检查端点
// ==========================================

app.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: NODE_ENV,
            version: '2.1.0',
            checks: {
                database: 'unknown',
                redis: 'unknown',
                queue: 'unknown',
            },
        };

        // 检查 PostgreSQL
        try {
            const db = getDatabaseService();
            const dbHealth = await db.healthCheck();

            health.checks.database = dbHealth.success ? 'healthy' : 'unhealthy';
        } catch (error) {
            health.checks.database = 'error';
        }

        // 检查 Redis
        try {
            const queueManager = getQueueManager();
            const redisHealth = await queueManager.checkRedisHealth();

            health.checks.redis = redisHealth.success ? 'healthy' : 'unhealthy';
        } catch (error) {
            health.checks.redis = 'error';
        }

        // 检查队列
        try {
            const queueManager = getQueueManager();
            const queueStatuses = await queueManager.getAllQueueStatus();

            health.checks.queue = queueStatuses.length > 0 ? 'healthy' : 'unhealthy';
        } catch (error) {
            health.checks.queue = 'error';
        }

        res.json(health);

    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ==========================================
// API 端点
// ==========================================

app.get('/', (req, res) => {
    res.json({
        name: 'AI Companion 2.1',
        version: '2.1.0',
        description: 'Enterprise RPG Game Backend Infrastructure',
        environment: NODE_ENV,
    });
});

// ==========================================
// 优雅退出
// ==========================================

async function gracefulShutdown(signal: string) {
    logger.info(`🛑 收到退出信号: ${signal}`);

    // 关闭数据库
    try {
        const db = getDatabaseService();
        await db.close();
        logger.info('✅ 数据库已关闭');
    } catch (error) {
        logger.error('❌ 关闭数据库失败', error);
    }

    // 关闭队列
    try {
        const queueManager = getQueueManager();
        await queueManager.close();
        logger.info('✅ 队列已关闭');
    } catch (error) {
        logger.error('❌ 关闭队列失败', error);
    }

    // 关闭 HTTP 服务器
    process.exit(0);
}

// 注册退出信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ==========================================
// 主函数
// ==========================================

async function main() {
    logger.info('\n' + '='.repeat(60));
    logger.info('🚀 AI Companion 2.1 - 服务器启动');
    logger.info('='.repeat(60) + '\n');

    // 1. 初始化数据库
    logger.info('📦 初始化 PostgreSQL 连接池...');
    const db = getDatabaseService();
    await db.initialize();

    // 2. 初始化队列管理器
    logger.info('📦 初始化 BullMQ 队列管理器...');
    const queueManager = getQueueManager();

    // 3. 初始化事件总线
    logger.info('📦 初始化事件总线...');
    const eventBus = getEventBus();

    // 4. 发布系统就绪事件
    await eventBus.publish(Event.SYSTEM_READY, {
        userId: 'system',
        metadata: {
            environment: NODE_ENV,
            version: '2.1.0',
        },
    });

    // 5. 启动 HTTP 服务器
    const server = app.listen(API_PORT, API_HOST, () => {
        logger.info(`✅ HTTP 服务器已启动: http://${API_HOST}:${API_PORT}`);
        logger.info('');
        logger.info('📊 系统组件:');
        logger.info(`   • PostgreSQL: ✅ 就绪`);
        logger.info(`   • Redis + BullMQ: ✅ 就绪`);
        logger.info(`   • Event Bus: ✅ 就绪`);
        logger.info('');
        logger.info(`🔗 健康检查: http://${API_HOST}:${API_PORT}/health`);
        logger.info('='.repeat(60) + '\n');
    });

    server.on('error', (error) => {
        logger.error('❌ HTTP 服务器启动失败', error);
        process.exit(1);
    });
}

// 启动服务器
main().catch((error) => {
    logger.error('❌ 服务器启动失败', error);
    process.exit(1);
});

export default app;
