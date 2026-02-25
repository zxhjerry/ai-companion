/**
 * Event Bus - 企业级事件总线基础设施
 *
 * 特性：
 * - 解耦核心业务逻辑
 * - 支持类型安全
 * - 支持异步处理
 * - 支持事件拦截
 * - 支持事件重放
 * - 与 BullMQ 集成（用于异步处理）
 */

import { EventEmitter2 } from 'eventemitter2';
import { getQueueManager } from '../queue/queue-manager';
import { logger } from '../infrastructure/logger';

/**
 * 事件类型定义
 */
export enum Event {
    // ===== 用户事件 =====
    USER_CREATED = 'user.created',
    USER_UPDATED = 'user.updated',
    USER_DELETED = 'user.deleted',

    // ===== 装备事件 =====
    ITEM_OBTAINED = 'item.obtained',
    ITEM_UPDATED = 'item.updated',
    ITEM_UPGRADED = 'item.upgraded',
    ITEM_DELETE = 'item.deleted',
    ITEM_EQUIPPED = 'item.equipped',
    ITEM_UNEQUIPPED = 'item.unequipped',

    // ===== 抽卡事件 =====
    GACHA_PULL_START = 'gacha.pull.start',
    GACHA_PULL_COMPLETED = 'gacha.pull.completed',
    GACHA_PITY_TRIGGERED = 'gacha.pity.triggered',
    GACHA_RARITY_BONUS = 'gacha.rarity.bonus',

    // ===== 战斗事件 =====
    BATTLE_START = 'battle.start',
    BATTLE_COMPLETED = 'battle.completed',
    BATTLE_DEFEAT = 'battle.defeat',
    BATTLE_WIN = 'battle.win',

    // ===== 好感度事件 =====
    AFFINITY_UPDATED = 'affinity.updated',
    AFFINITY_GIFT_SENT = 'affinity.gift.sent',
    AFFINITY_STATE_CHANGED = 'affinity.state.changed',

    // ===== AI 剧本事件 =====
    SCRIPT_GENERATION_REQUESTED = 'script.generation.requested',
    SCRIPT_GENERATION_COMPLETED = 'script.generation.completed',
    SCRIPT_GENERATION_FAILED = 'script.generation.failed',

    // ===== 系统事件 =====
    SYSTEM_READY = 'system.ready',
    DATABASE_READY = 'database.ready',
    QUEUE_READY = 'queue.ready',
    WORKER_READY = 'worker.ready',
}

/**
 * 事件数据接口
 */
export interface EventData {
    eventType: Event;
    timestamp: Date;
    userId: string;
    characterId?: string;
    metadata?: Record<string, any>;
}

/**
 * Item Obtained 事件数据
 */
export interface ItemObtainedData extends EventData {
    instanceId: string;
    templateId: string;
    item: Record<string, any>;
}

/**
 * Gacha Pull 事件数据
 */
export interface GachaPullData extends EventData {
    poolId: string;
    pullCount: number;
    cost: number;
    results: Record<string, any>[];
}

/**
 * Battle Result 事件数据
 */
export interface BattleResultData extends EventData {
    battleId: string;
    winner: 'attacker' | 'defender';
    rewards: Record<string, any>;
}

/**
 * Affinity Updated 事件数据
 */
export interface AffinityUpdatedData extends EventData {
    companionId: string;
    score: number;
    state: string;
}

/**
 * Script Generated 事件数据
 */
export interface ScriptGeneratedData extends EventData {
    companionId: string;
    nodes: Record<string, any>[];
}

/**
 * 事件处理器类型
 */
export type EventHandler<T extends EventData = EventData> = (data: T) => void | Promise<void>;

/**
 * Event Bus 配置
 */
export interface EventBusConfig {
    // 是否启用异步处理（使用 BullMQ）
    asyncEnabled?: boolean;

    // 事件队列名称（异步处理时使用）
    asyncQueueName?: string;

    // 是否启用事件记录
    recordEnabled?: boolean;

    // 是否启用事件重放
    replayEnabled?: boolean;

    // 最大监听器数量
    maxListeners?: number;
}

/**
 * Event Bus 类
 */
export class EventBus extends EventEmitter2 {
    private config: EventBusConfig;
    private eventHistory: Map<string, EventData[]> = new Map();
    private eventInterceptors: Map<Event, EventHandler[]> = new Map();

    constructor(config: EventBusConfig = {}) {
        super({
            wildcard: true,  // 支持通配符事件监听
            delimiter: '.',    // 事件名称分隔符
            maxListeners: config.maxListeners || 100,
        });

        this.config = {
            asyncEnabled: true,
            asyncQueueName: 'event-bus',
            recordEnabled: false,
            replayEnabled: false,
            maxListeners: 100,
            ...config,
        };

        logger.info('✅ Event Bus 已初始化');
    }

    /**
     * 发布事件
     */
    public async publish<T extends EventData = EventData>(
        eventType: Event,
        data: Omit<T, 'eventType' | 'timestamp'>
    ): Promise<void> {
        const eventData: EventData = {
            eventType,
            timestamp: new Date(),
            ...data as any,
        };

        logger.debug(`📡 发布事件: ${eventType}`, eventData);

        // 记录事件历史
        if (this.config.recordEnabled) {
            this.recordEvent(eventType, eventData as EventData);
        }

        // 同步处理
        this.emit(eventType, eventData);
        this.emit('*', eventData);

        // 异步处理（可选）
        if (this.config.asyncEnabled) {
            await this.processAsync(eventData as EventData);
        }
    }

    /**
     * 订阅事件
     */
    public on<T extends EventData = EventData>(
        eventType: Event,
        handler: EventHandler<T>
    ): this {
        super.on(eventType, (data: any) => {
            try {
                handler(data);
            } catch (error) {
                logger.error(`❌ 事件处理器执行失败: ${eventType}`, error);
            }
        });

        return this;
    }

    /**
     * 订阅事件（仅监听一次）
     */
    public once<T extends EventData = EventData>(
        eventType: Event,
        handler: EventHandler<T>
    ): this {
        super.once(eventType, (data: any) => {
            try {
                handler(data);
            } catch (error) {
                logger.error(`❌ 事件处理器执行失败: ${eventType}`, error);
            }
        });

        return this;
    }

    /**
     * 取消订阅
     */
    public off(eventType: Event, handler: EventHandler): this {
        super.off(eventType, handler);
        return this;
    }

    /**
     * 移除所有监听器
     */
    public removeAllListeners(eventType?: Event): this {
        super.removeAllListeners(eventType);
        return this;
    }

    /**
     * 添加事件拦截器
     */
    public addInterceptor(eventType: Event, interceptor: EventHandler): this {
        if (!this.eventInterceptors.has(eventType)) {
            this.eventInterceptors.set(eventType, []);
        }

        this.eventInterceptors.get(eventType)!.push(interceptor);

        return this;
    }

    /**
     * 移除事件拦截器
     */
    public removeInterceptor(eventType: Event, interceptor: EventHandler): this {
        const interceptors = this.eventInterceptors.get(eventType);

        if (!interceptors) {
            return this;
        }

        const index = interceptors.indexOf(interceptor);

        if (index >= 0) {
            interceptors.splice(index, 1);
        }

        return this;
    }

    /**
     * 异步处理事件（使用 BullMQ）
     */
    private async processAsync(eventData: EventData): Promise<void> {
        try {
            const queueManager = getQueueManager();
            const asyncQueue = queueManager.getQueue<EventData>(this.config.asyncQueueName!);

            if (asyncQueue) {
                await queueManager.addJob(this.config.asyncQueueName!, eventData);
                logger.debug(`✅ 事件已添加到异步队列: ${eventData.eventType}`);
            }
        } catch (error) {
            logger.warn('⚠️  事件无法异步处理（队列可能未初始化）:', error);
        }
    }

    /**
     * 记录事件历史
     */
    private recordEvent(eventType: Event, eventData: EventData): void {
        if (!this.eventHistory.has(eventType)) {
            this.eventHistory.set(eventType, []);
        }

        const history = this.eventHistory.get(eventType)!;
        history.push(eventData);

        // 保留最近 100 条记录
        if (history.length > 100) {
            history.shift();
        }
    }

    /**
     * 获取事件历史
     */
    public getEventHistory(eventType?: Event): EventData[] {
        if (eventType) {
            return this.eventHistory.get(eventType) || [];
        }

        const allHistory: EventData[] = [];

        this.eventHistory.forEach((history) => {
            allHistory.push(...history);
        });

        return allHistory;
    }

    /**
     * 重放事件
     */
    public async replayEvent(
        eventType: Event,
        data: EventData
    ): Promise<void> {
        logger.info(`🔄 重放事件: ${eventType}`);

        await this.publish(eventType, data);
    }

    /**
     * 批量重放事件
     */
    public async replayBatchEvents(eventType: Event, limit: number = 10): Promise<void> {
        const history = this.getEventHistory(eventType);
        const toReplay = history.slice(0, limit);

        logger.info(`🔄 批量重放事件: ${eventType} (${toReplay.length} 个)`);

        for (const eventData of toReplay) {
            await this.replayEvent(eventType, eventData);
        }
    }

    /**
     * 清空事件历史
     */
    public clearEventHistory(eventType?: Event): void {
        if (eventType) {
            this.eventHistory.delete(eventType);
            logger.info(`🗑️  已清空事件历史: ${eventType}`);
        } else {
            this.eventHistory.clear();
            logger.info('🗑️  已清空所有事件历史');
        }
    }

    /**
     * 获取事件统计
     */
    public getEventStats(): {
        totalListeners: number;
        eventTypes: string[];
        historyCounts: Record<string, number>;
        interceptorCounts: Record<string, number>;
    } {
        const eventTypes = Object.values(Event);
        const historyCounts: Record<string, number> = {};
        const interceptorCounts: Record<string, number> = {};

        eventTypes.forEach((eventType) => {
            historyCounts[eventType] = this.getEventHistory(eventType).length;
            interceptorCounts[eventType] = this.eventInterceptors.get(eventType)?.length || 0;
        });

        return {
            totalListeners: this.eventNames().length,
            eventTypes,
            historyCounts,
            interceptorCounts,
        };
    }
}

// ==========================================
// 单例模式
// ==========================================

let eventBus: EventBus | null = null;

/**
 * 获取 Event Bus 单例
 */
export function getEventBus(config?: Partial<EventBusConfig>): EventBus {
    if (!eventBus) {
        eventBus = new EventBus(config);
    }

    return eventBus;
}

export default getEventBus;
