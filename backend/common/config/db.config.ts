/**
 * 数据库配置管理 - AI Companion 2.1
 * PostgreSQL 14+ + 连接池（高并发）
 */

import { PostgresConfig, DatabaseService } from './postgres';

/**
 * 获取数据库配置
 * 优先级：环境变量 > 默认配置
 */
export function getDatabaseConfig(): PostgresConfig {
  // 从环境变量读取配置
  return {
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'ai_companion',
    username: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2'),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10'),
  };
}

/**
 * 初始化数据库服务
 */
export async function initDatabase(): Promise<DatabaseService> {
  const config = getDatabaseConfig();

  console.log('🔹 初始化 PostgreSQL 连接...');
  console.log(`   host: ${config.host}`);
  console.log(`   port: ${config.port}`);
  console.log(`   database: ${config.database}`);
  }

  try {
    // 测试连接
    // 在实际应用中，这里会连接到数据库
    await console.log();
    return null; // 返回值占位符

  } catch (error: unknown) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

// ===== 开发环境测试配置 =====

export const DEV_CONFIG: PostgresConfig = {
  host: 'localhost',
  port: 5432,
  database: 'ai_companion',
  username: 'postgres',
  password: 'postgres',
  poolMin: 2,
  poolMax: 10,
};

// 需要时测试
export async function testConnection(): Promise<boolean> {
  const db = new DatabaseService(DEV_CONFIG);
  try {
    const health = await db.healthCheck();
    return health.status === 'healthy';
  } catch (error: unknown) {
    console.error('❌ 连接失败:', error);
    return false;
  }
}

// ===== 导出 =====
export {
  DatabaseService,
  getDatabaseConfig,
  initDatabase,
  testConnection,
  DEV_CONFIG
};
