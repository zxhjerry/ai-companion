/**
 * Logger - 企业级日志基础设施
 *
 * 特性：
 * - 结构化日志
 * - 多级别日志
 * - 彩色输出
 * - 文件日志（Winston）
 * - 日志轮转
 */

import winston from 'winston';

/**
 * 日志级别
 */
export enum LogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    DEBUG = 'debug',
    VERBOSE = 'verbose',
    SILLY = 'silly',
}

/**
 * 日志选项
 */
export interface LoggerOptions {
    level?: LogLevel;
    file?: string;
    console?: boolean;
    format?: string;
}

/**
 * Logger 类
 */
class Logger {
    private winston: winston.Logger;
    private level: LogLevel;

    constructor(options: LoggerOptions = {}) {
        this.level = options.level || LogLevel.INFO;

        const transports: winston.transport[] = [
            // 控制台输出（彩色）
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
                        let msg = `${timestamp} [${level}] ${message}`;

                        if (Object.keys(metadata).length > 0) {
                            msg += ` ${JSON.stringify(metadata)}`;
                        }

                        return msg;
                    })
                ),
                enabled: options.console !== false,
            }),
        ];

        // 文件输出（可选）
        if (options.file) {
            transports.push(
                new winston.transports.File({
                    filename: options.file,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    ),
                })
            );
        }

        this.winston = winston.createLogger({
            level: this.level,
            transports,
            exitOnError: false,  // 不在错误时退出进程
        });
    }

    /**
     * Error 级别
     */
    error(message: string, metadata?: any): void {
        this.winston.error(message, metadata);
    }

    /**
     * Warn 级别
     */
    warn(message: string, metadata?: any): void {
        this.winston.warn(message, metadata);
    }

    /**
     * Info 级别
     */
    info(message: string, metadata?: any): void {
        this.winston.info(message, metadata);
    }

    /**
     * Debug 级别
     */
    debug(message: string, metadata?: any): void {
        this.winston.debug(message, metadata);
    }

    /**
     * Verbose 级别
     */
    verbose(message: string, metadata?: any): void {
        this.winston.verbose(message, metadata);
    }

    /**
     * Silly 级别
     */
    silly(message: string, metadata?: any): void {
        this.winston.silly(message, metadata);
    }

    /**
     * 设置日志级别
     */
    setLevel(level: LogLevel): void {
        this.level = level;
        this.winston.level = level;
    }

    /**
     * 获取当前日志级别
     */
    getLevel(): LogLevel {
        return this.level;
    }

    /**
     * 创建子日志器（带有额外上下文）
     */
    child(metadata: Record<string, any>): Logger {
        const childLogger = Object.create(Logger.prototype);
        childLogger.winston = this.winston.child(metadata);

        return childLogger;
    }

    /**
     * 性能计时器
     */
    timer(label: string): () => void {
        const start = Date.now();

        this.debug(`⏱️  计时器开始: ${label}`);

        return () => {
            const duration = Date.now() - start;
            this.debug(`⏱️  计时器结束: ${label} (${duration}ms)`);
        };
    }

    /**
     * 记录查询性能
     */
    query(query: string, duration: number, rowCount?: number): void {
        this.debug(`📊 查询 (${duration}ms): ${query.substring(0, 100)}...`, {
            rowCount,
        });

        if (duration > 1000) {
            this.warn(`⚠️  慢查询 (>1000ms): ${duration}ms`, {
                query: query.substring(0, 200),
            });
        }
    }
}

// ==========================================
// 单例模式
// ==========================================

let logger: Logger | null = null;

/**
 * 获取 Logger 单例
 */
export function getLogger(options?: Partial<LoggerOptions>): Logger {
    if (!logger) {
        logger = new Logger({
            file: process.env.LOG_FILE,
            console: true,
            ...options,
        });
    }

    return logger;
}

// 默认导出
export default getLogger();
