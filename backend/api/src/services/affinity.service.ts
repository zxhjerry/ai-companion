/**
 * NPC Affinity System - NPC 好感度系统
 * 核心要求：
 * 1. NPC好感度枚举状态机（Stranger → Partner）
 * 2. 接收"赠送礼物"指令，核扣背包物品
 * 3. 更新好感度状态
 */

import { DatabaseService } from '../database/postgres';
import { EventBus, Event, CharacterEvent } from '../event-bus/index';

// ==========================================
// 类型定义
// ==========================================

/**
 * 好感度状态枚举
 */
export enum AffinityState {
    STRANGER = 'stranger',         // 陌生人（0-20）
    ACQUAINTANCE = 'acquaintance', // 熟人（21-40）
    FRIEND = 'friend',             // 朋友（41-60）
    CLOSE_FRIEND = 'close_friend', // 好友（61-80）
    PARTNER = 'partner'            // 伙伴（81-100）
}

/**
 * 好感度等级配置
 */
export const AFFINITY_CONFIG: Record<AffinityState, {
    minScore: number;
    maxScore: number;
    displayName: string;
    perks: string[];               // 特权
}> = {
    [AffinityState.STRANGER]: {
        minScore: 0,
        maxScore: 20,
        displayName: '陌生人',
        perks: ['无']
    },
    [AffinityState.ACQUAINTANCE]: {
        minScore: 21,
        maxScore: 40,
        displayName: '熟人',
        perks: ['基础奖励+10%', '解锁日常任务']
    },
    [AffinityState.FRIEND]: {
        minScore: 41,
        maxScore: 60,
        displayName: '朋友',
        perks: ['基础奖励+20%', '解锁特殊对话', '赠送礼物上限+1']
    },
    [AffinityState.CLOSE_FRIEND]: {
        minScore: 61,
        maxScore: 80,
        displayName: '好友',
        perks: ['基础奖励+30%', '解锁隐藏剧情', '赠送礼物上限+2', '每周免费礼物x1']
    },
    [AffinityState.PARTNER]: {
        minScore: 81,
        maxScore: 100,
        displayName: '伙伴',
        perks: ['基础奖励+50%', '解锁所有剧情', '送礼物不限量', '获取特殊立绘', '每月专属礼物']
    }
};

/**
 * 好感度记录
 */
export interface AffinityRecord {
    userId: string;
    companionId: string;
    score: number;              // 好感度分数（0-100）
    state: AffinityState;       // 当前状态
    lastGiftDate: Date | null;  // 上次赠送日期
    weeklyGiftCount: number;    // 本周已赠送次数
    dailyGiftCount: number;     // 今日已赠送次数
    unlockFlags: string[];      // 解锁标记（用于剧情解锁）
    createdAt: Date;
    updatedAt: Date;
}

/**
 * 赠送礼物请求
 */
export interface GiftRequest {
    userId: string;
    companionId: string;
    instanceId: string;         // 礼物实例ID
    message?: string;           // 附言（增加好感度加成）
}

/**
 * 赠送礼物响应
 */
export interface GiftResponse {
    success: boolean;
    companionId: string;
    itemName: string;
    itemRarity: string;
    affinityBefore: number;
    affinityAfter: number;
    affinityGained: number;
    stateBefore: AffinityState;
    stateAfter: AffinityState;
    stateChanged: boolean;
    perks: string[];
    message: string;
    timestamp: Date;
}

/**
 * 礼物类型（好感度加成）
 */
export const GIFT_TYPES: Record<string, {
    baseAffinity: number;       // 基础好感度加成
    multiplier: number;         // 稀有度加成倍率
}> = {
    'common': {
        baseAffinity: 1,
        multiplier: 1.0
    },
    'uncommon': {
        baseAffinity: 2,
        multiplier: 1.5
    },
    'rare': {
        baseAffinity: 5,
        multiplier: 2.0
    },
    'epic': {
        baseAffinity: 10,
        multiplier: 3.0
    },
    'legendary': {
        baseAffinity: 20,
        multiplier: 5.0
    }
};

/**
 * 礼物类物品模板ID（示例）
 */
export const GIFT_ITEM_TEMPLATES = [
    'gift_001', // 鲜花（普通）
    'gift_002', // 巧克力（不普通）
    'gift_003', // 珠宝（稀有）
    'gift_004', // 装饰品（史诗）
    'gift_005', // 传家宝（传说）
];

// ==========================================
// Affinity Service 实现
// ==========================================

export class AffinityService {
    private db: DatabaseService;
    private eventBus: EventBus;

    constructor(db: DatabaseService, eventBus: EventBus) {
        this.db = db;
        this.eventBus = eventBus;
    }

    /**
     * 获取好感度记录
     */
    async getAffinity(userId: string, companionId: string): Promise<AffinityRecord | null> {
        const record = await this.db.query<AffinityRecord>(
            'SELECT * FROM affinity_records WHERE user_id = $1 AND companion_id = $2',
            [userId, companionId]
        );

        if (!record) {
            // 初始化好感度记录
            await this.initializeAffinity(userId, companionId);
            return this.getAffinity(userId, companionId);
        }

        return record;
    }

    /**
     * 初始化好感度记录
     */
    private async initializeAffinity(userId: string, companionId: string): Promise<void> {
        await this.db.query(
            `INSERT INTO affinity_records
                (user_id, companion_id, score, state, last_gift_date,
                 weekly_gift_count, daily_gift_count, unlock_flags, created_at, updated_at)
             VALUES ($1, $2, 0, $3, NULL, 0, 0, ARRAY[]::TEXT[], NOW(), NOW())`,
            [userId, companionId, AffinityState.STRANGER]
        );

        console.log(`✅ 初始化好感度记录: ${companionId} (陌生人)`);
    }

    /**
     * 计算好感度状态
     */
    calculateState(score: number): AffinityState {
        if (score <= 20) return AffinityState.STRANGER;
        if (score <= 40) return AffinityState.ACQUAINTANCE;
        if (score <= 60) return AffinityState.FRIEND;
        if (score <= 80) return AffinityState.CLOSE_FRIEND;
        return AffinityState.PARTNER;
    }

    /**
     * 赠送礼物（前端调用）
     * 1. 核扣背包物品
     * 2. 更新好感度
     * 3. 检查状态变化
     */
    async sendGift(request: GiftRequest): Promise<GiftResponse> {
        const { userId, companionId, instanceId, message } = request;

        console.log('\n========================================');
        console.log('🎁 NPC Affinity System - 赠送礼物');
        console.log('========================================');
        console.log(`用户: ${userId}`);
        console.log(`NPC: ${companionId}`);
        console.log(`物品实例: ${instanceId}`);
        console.log(`附言: ${message || '无'}`);
        console.log('');

        // ===== 步骤 1: 验证是否为礼物类物品 =====

        const itemInstance = await this.getItemInstance(userId, instanceId);
        if (!itemInstance) {
            throw new Error(`物品不存在: ${instanceId}`);
        }

        const itemTemplate = await this.getItemTemplate(itemInstance.template_id);
        if (!itemTemplate) {
            throw new Error(`物品模板不存在: ${itemInstance.template_id}`);
        }

        // 检查是否为礼物类物品
        if (!GIFT_ITEM_TEMPLATES.includes(itemTemplate.id)) {
            throw new Error(`该物品不是礼物: ${itemTemplate.name}`);
        }

        // ⭐ 绑定检查：如果是绑定物品，不能赠送
        if (itemInstance.is_soulbound) {
            throw new Error(`该物品已绑定，不能赠送: ${itemTemplate.name}`);
        }

        console.log(`✅ 礼物验证通过: ${itemTemplate.name} (${itemTemplate.rarity})`);

        // ===== 步骤 2: 获取当前好感度 =====

        const affinityRecord = await this.getAffinity(userId, companionId);
        if (!affinityRecord) {
            throw new Error(`好感度记录不存在: ${companionId}`);
        }

        console.log(`📊 当前好感度:`);
        console.log(`   分数: ${affinityRecord.score}/100`);
        console.log(`   状态: ${AFFINITY_CONFIG[affinityRecord.state].displayName}`);

        // ===== 步骤 3: 检查赠送限制 =====

        await this.checkGiftLimits(userId, companionId, affinityRecord);

        // ===== 步骤 4: 计算好感度加成 =====

        const affinityGain = this.calculateAffinityGain(
            itemTemplate.rarity,
            affinityRecord.state,
            message
        );

        console.log(`💖 好感度加成: +${affinityGain.toFixed(1)}`);

        // ===== 步骤 5: 更新好感度分数 =====

        const newScore = Math.min(100, affinityRecord.score + affinityGain);
        const newState = this.calculateState(newScore);
        const stateChanged = newState !== affinityRecord.state;

        console.log(`📈 更新后好感度:`);
        console.log(`   分数: ${newScore.toFixed(1)}/100`);
        console.log(`   状态: ${AFFINITY_CONFIG[newState].displayName}`);

        if (stateChanged) {
            console.log(`   ✨ 关系升级: ${AFFINITY_CONFIG[affinityRecord.state].displayName} → ${AFFINITY_CONFIG[newState].displayName}`);
        }

        // ===== 步骤 6: 核扣背包物品 =====

        await this.deductItem(userId, instanceId);

        console.log(`🗑️  物品已核扣: ${itemTemplate.name}`);

        // ===== 步骤 7: 更新数据库 =====

        await this.updateAffinityRecord(userId, companionId, {
            score: newScore,
            state: newState,
            last_gift_date: new Date(),
            weekly_gift_count: affinityRecord.weeklyGiftCount + 1,
            daily_gift_count: affinityRecord.dailyGiftCount + 1
        });

        // ===== 步骤 8: 如果关系升级，解锁标记 =====

        if (stateChanged) {
            await this.onStateChange(userId, companionId, newState);
        }

        // ===== 步骤 9: 发送事件通知 =====

        await this.eventBus.publishLevelUp({
            timestamp: new Date(),
            userId,
            characterId: companionId,
            metadata: {
                affinityGain,
                stateBefore: affinityRecord.state,
                stateAfter: newState,
                itemName: itemTemplate.name,
                itemRarity: itemTemplate.rarity
            }
        });

        // ===== 步骤 10: 返回响应 =====

        const config = AFFINITY_CONFIG[newState];

        console.log(`\n✅ 赠送完成！`);

        return {
            success: true,
            companionId,
            itemName: itemTemplate.name,
            itemRarity: itemTemplate.rarity,
            affinityBefore: affinityRecord.score,
            affinityAfter: newScore,
            affinityGained: affinityGain,
            stateBefore: affinityRecord.state,
            stateAfter: newState,
            stateChanged,
            perks: config.perks,
            message: stateChanged
                ? `🎉 恭喜！${AFFINITY_CONFIG[affinityRecord.state].displayName} → ${config.displayName}！`
                : `${config.displayName}好感度+${affinityGain.toFixed(1)}`,
            timestamp: new Date()
        };
    }

    /**
     * 计算好感度加成
     */
    private calculateAffinityGain(
        rarity: string,
        currentState: AffinityState,
        message?: string
    ): number {
        // 基础好感度（根据稀有度）
        const giftType = GIFT_TYPES[rarity] || GIFT_TYPES['common'];
        let affinityGain = giftType.baseAffinity;

        // 稀有度加成
        affinityGain *= giftType.multiplier;

        // 关系加成（关系越好，好感度提升越难）
        const stateMultiplier = this.getStateMultiplier(currentState);
        affinityGain *= stateMultiplier;

        // 附言加成（+20%）
        if (message && message.trim().length > 0) {
            affinityGain *= 1.2;
        }

        return affinityGain;
    }

    /**
     * 获取关系加成倍率
     * 关系越好，好感度提升越难（防止刷分）
     */
    private getStateMultiplier(state: AffinityState): number {
        switch (state) {
            case AffinityState.STRANGER:
                return 1.0;    // 陌生人：100%
            case AffinityState.ACQUAINTANCE:
                return 0.8;    // 熟人：80%
            case AffinityState.FRIEND:
                return 0.6;    // 朋友：60%
            case AffinityState.CLOSE_FRIEND:
                return 0.4;    // 好友：40%
            case AffinityState.PARTNER:
                return 0.2;    // 伙伴：20%
            default:
                return 1.0;
        }
    }

    /**
     * 检查赠送限制
     */
    private async checkGiftLimits(
        userId: string,
        companionId: string,
        affinityRecord: AffinityRecord
    ): Promise<void> {
        const state = affinityRecord.state;
        const config = AFFINITY_CONFIG[state];

        // 每日赠送限制（根据关系解锁）
        let dailyLimit = 3; // 默认每天3次

        // 根据关系升级赠送上限
        if (state === AffinityState.FRIEND) {
            dailyLimit = 4; // 朋友: +1
        } else if (state === AffinityState.CLOSE_FRIEND) {
            dailyLimit = 5; // 好友: +2
        } else if (state === AffinityState.PARTNER) {
            dailyLimit = 999; // 伙伴: 不限量（简化）
        }

        // 检查当日赠送次数
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayGifts = await this.db.query<{ count: bigint }>(
            `SELECT COUNT(*) as count
             FROM gift_history
             WHERE user_id = $1
               AND companion_id = $2
               AND created_at >= $3`,
            [userId, companionId, todayStart]
        );

        const giftCount = Number(todayGifts?.count || 0);

        if (giftCount >= dailyLimit) {
            throw new Error(`今日赠送次数已用完（${giftCount}/${dailyLimit}），请明天再试`);
        }

        console.log(`✅ 赠送限制检查通过：今日已赠送 ${giftCount}/${dailyLimit} 次`);
    }

    /**
     * 关系升级处理
     */
    private async onStateChange(
        userId: string,
        companionId: string,
        newState: AffinityState
    ): Promise<void> {
        const config = AFFINITY_CONFIG[newState];

        // 解锁隐藏剧情（根据关系）
        const unlockFlags = [];
        unlockFlags.push(`story_${newState}_unlock`);

        // 伙伴解锁所有剧情
        if (newState === AffinityState.PARTNER) {
            unlockFlags.push('story_all_unlock');
            unlockFlags.push('special_illustration_unlock');
        }

        // 更新解锁标记
        await this.db.query(
            `UPDATE affinity_records
             SET unlock_flags = array_cat(unlock_flags, $1)
             WHERE user_id = $2 AND companion_id = $3`,
            [unlockFlags, userId, companionId]
        );

        console.log(`🔓 解锁标记: ${unlockFlags.join(', ')}`);
    }

    /**
     * 获取物品实例
     */
    private async getItemInstance(
        userId: string,
        instanceId: string
    ): Promise<any | null> {
        const instance = await this.db.query(
            'SELECT * FROM item_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, userId]
        );
        return instance || null;
    }

    /**
     * 获取物品模板
     */
    private async getItemTemplate(
        templateId: string
    ): Promise<any | null> {
        const template = await this.db.query(
            'SELECT * FROM item_templates WHERE id = $1',
            [templateId]
        );
        return template || null;
    }

    /**
     * 核扣物品（删除实例）
     */
    private async deductItem(userId: string, instanceId: string): Promise<void> {
        // 检查物品是否存在
        const instance = await this.getItemInstance(userId, instanceId);
        if (!instance) {
            throw new Error(`物品不存在: ${instanceId}`);
        }

        // 删除物品实例
        await this.db.query(
            'DELETE FROM item_instances WHERE instance_id = $1 AND user_id = $2',
            [instanceId, userId]
        );

        // 记录礼物赠送历史
        await this.db.query(
            `INSERT INTO gift_history
                (user_id, companion_id, instance_id, template_id, rarity, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [
                userId,
                instance.companion_id, // 获取NPC ID
                instanceId,
                instance.template_id,
                instance.rarity
            ]
        );
    }

    /**
     * 更新好感度记录
     */
    private async updateAffinityRecord(
        userId: string,
        companionId: string,
        update: Partial<AffinityRecord>
    ): Promise<void> {
        await this.db.query(
            `UPDATE affinity_records
             SET score = $1,
                 state = $2,
                 last_gift_date = $3,
                 weekly_gift_count = $4,
                 daily_gift_count = $5,
                 updated_at = NOW()
             WHERE user_id = $6 AND companion_id = $7`,
            [
                update.score,
                update.state,
                update.last_gift_date,
                update.weekly_gift_count,
                update.daily_gift_count,
                userId,
                companionId
            ]
        );
    }

    /**
     * 获取所有NPC的好感度（列表页面）
     */
    async getAllAffinities(userId: string): Promise<AffinityRecord[]> {
        const records = await this.db.queryMany<AffinityRecord>(
            'SELECT * FROM affinity_records WHERE user_id = $1 ORDER BY score DESC',
            [userId]
        );
        return records;
    }
}

export { AffinityService };
