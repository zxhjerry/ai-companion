/**
 * Gacha Service - 抽卡系统核心逻辑
 * 职责：
 * 1. 保底算法实现（70 抽递增）
 * 2. 服务器端随机数生成
 * 3. 权重池计算（保密）
 * 4. 结果 sanitization（不暴露前端）
 */

import { DatabaseService } from '../database/postgres';
import { EventBus, Event, GachaEvent } from '../event-bus/index';

// ==========================================
// 类型定义
// ==========================================

export interface GachaRequest {
    userId: string;
    poolId: string;
    pullCount: number; // 1 连抽次数（每次连抽 = 10 个物品）
    currency: 'gold' | 'gems';
}

export interface GachaResult {
    instanceId: string;
    templateId: string;
    name: string;
    rarity: string;
    tier: number;
    stats: Record<string, number>;
    isPityResult: boolean;
    isSoulbound: boolean; // ⭐ 必须返回（绑定标识）
    obtainedAt: string;
}

export interface AssetSnapshot {
    goldBalance: bigint;
    gemsBalance: bigint;
    inventoryCount: number;
}

export interface GachaResponse {
    success: boolean;
    poolId: string;
    pullCount: number;
    currency: string;
    cost: bigint;
    results: GachaResult[];
    pityTriggered: boolean;
    pityCounter: number;
    currentPityRate: number;
    assets: AssetSnapshot;
    timestamp: string;
}

interface ItemTemplate {
    id: string;
    name: string;
    description: string;
    type: string;
    rarity: string;
    tier: number;
    pull_weight: number;
    base_pull_rate: number;
    stats: Record<string, number>;
    growth_stats: Record<string, number>;
}

interface GachaPool {
    pool_id: string;
    pool_name: string;
    pool_type: string;
    pool_weights: Array<{ templateId: string; pullWeight: number }>;
    pulls_per_play: number;
    cost_per_pull: number;
    currency: string;
    pity_enabled: boolean;
    pity_counter: number;
    pity_increment: number;
    is_active: boolean;
}

interface PityStatus {
    user_id: string;
    pool_id: string;
    current_pulls: number;
    current_pity_rate: number;
    is_pity_triggered: boolean;
}

// ==========================================
// 保底算法（70 抽递增）
// ==========================================

/**
 * 计算当前保底概率
 * Algorithm: P_current = clamp(consecutive_misses × increment_rate, 0, max_rate)
 * 70 抽基础保底：每次未命中 + 5% 概率
 */
export function calculatePityRate(
    currentPulls: number,
    baseRate: number = 0,
    incrementRate: number = 5,
    maxRate: number = 100
): { pityRate: number; isPityTriggered: boolean } {
    // 70 抽基础保底：前 69 次不触发，第 70 次必定触发
    const isGuaranteed = currentPulls >= 70;

    if (isGuaranteed) {
        return {
            pityRate: 100, // 保底必中
            isPityTriggered: true
        };
    }

    // 递增概率（70 抽前线性增长）
    const pityRate = Math.min(
        maxRate,
        baseRate + (currentPulls * incrementRate)
    );

    return {
        pityRate: Math.round(pityRate),
        isPityTriggered: false
    };
}

// ==========================================
// 加权随机选择（权重池保密）
// ==========================================

/**
 * 服务器端加权随机选择
 * 不暴露权重池配置给前端
 */
function weightedRandomSelect(
    templates: Array<{ templateId: string; template: ItemTemplate; weight: number }>,
    totalWeight: number
): { templateId: string; template: ItemTemplate } {
    // 生成随机数 [0, totalWeight)
    const randomValue = Math.random() * totalWeight;

    // 线性选择（根据权重范围）
    let currentWeight = 0;
    for (const item of templates) {
        currentWeight += item.weight;
        if (randomValue < currentWeight) {
            return {
                templateId: item.templateId,
                template: item.template
            };
        }
    }

    // 兜底：返回最后一个
    const lastItem = templates[templates.length - 1];
    return {
        templateId: lastItem.templateId,
        template: lastItem.template
    };
}

// ==========================================
// Gacha Service 实现
// ==========================================

export class GachaService {
    private db: DatabaseService;
    private eventBus: EventBus;

    constructor(db: DatabaseService, eventBus: EventBus) {
        this.db = db;
        this.eventBus = eventBus;
    }

    /**
     * 执行抽卡（核心逻辑）
     */
    async pull(request: GachaRequest): Promise<GachaResponse> {
        const { userId, poolId, pullCount, currency } = request;

        console.log('\n========================================');
        console.log('🎯 Gacha Service - 抽卡系统');
        console.log('========================================');
        console.log(`用户: ${userId}`);
        console.log(`抽卡池: ${poolId}`);
        console.log(`抽取次数: ${pullCount} (每次 10 个物品)`);
        console.log(`货币: ${currency}`);
        console.log('');

        // ===== 步骤 1: 获取抽卡池配置 =====
        const pool = await this.getPool(poolId);
        if (!pool) {
            throw new Error(`抽卡池不存在或已关闭: ${poolId}`);
        }

        // ===== 步骤 2: 获取用户资产 =====
        const assets = await this.getUserAssets(userId);
        const costPerPull = BigInt(Math.floor(pool.cost_per_pull * pullCount)); // 每次 10 个物品
        const totalCost = costPerPull * BigInt(pullCount);

        // 检查余额
        if (currency === 'gold' && assets.goldBalance < totalCost) {
            throw new Error(`金币余额不足：需要 ${totalCost}，当前 ${assets.goldBalance}`);
        }
        if (currency === 'gems' && assets.gemsBalance < totalCost) {
            throw new Error(`宝石余额不足：需要 ${totalCost}，当前 ${assets.gemsBalance}`);
        }

        console.log(`💰 扣除资产: ${totalCost} ${currency}`);
        console.log(`   原余额: ${currency === 'gold' ? assets.goldBalance : assets.gemsBalance}`);

        // ===== 步骤 3: 获取当前保底状态 =====
        const pityStatus = await this.getPityStatus(userId, poolId);

        console.log(`📊 保底状态:`);
        console.log(`   当前抽卡数: ${pityStatus.current_pulls}/70`);
        console.log(`   当前保底率: ${pityStatus.current_pity_rate}%`);

        // ===== 步骤 4: 计算单次抽卡（多次循环） =====
        const results: GachaResult[] = [];
        const totalItems = pullCount * pool.pulls_per_play; // 每次 10 个物品

        console.log(`\n🎲 开始抽卡... (共 ${totalItems} 个物品)`);

        for (let i = 0; i < totalItems; i++) {
            // 计算当前保底状态
            const { pityRate, isPityTriggered } = calculatePityRate(
                pityStatus.current_pulls,
                0, // base_rate
                pool.pity_increment, // increment_rate (5%)
                100 // max_rate
            );

            // 执行单次抽卡
            const result = await this.singlePull(
                userId,
                pool,
                pityStatus.current_pulls,
                pityRate,
                isPityTriggered
            );

            results.push(result);

            // 更新保底状态
            if (result.isPityResult) {
                pityStatus.current_pulls = 0; // 保底命中，重置计数
                pityStatus.current_pity_rate = 0;
                console.log(`✅ 保底命中！（第 ${i + 1} 个物品）`);

                // 发布保底触发事件
                await this.eventBus.publishGachaPullStart({
                    timestamp: new Date(),
                    userId,
                    characterId: undefined,
                    metadata: {
                        poolId,
                        pullNumber: i + 1,
                        pityRate: 100
                    }
                });
            } else {
                pityStatus.current_pulls++; // 未命中，递增计数
                pityStatus.current_pity_rate = pityRate;
            }

            if ((i + 1) % 10 === 0) {
                console.log(`   进度: ${i + 1}/${totalItems} (第 ${Math.floor((i + 1) / 10)} 连抽)`);
            }
        }

        // ===== 步骤 5: 更新数据库 =====

        // 扣除资产
        await this.deductAssets(userId, currency, totalCost);

        // 更新保底状态
        await this.updatePityStatus(userId, poolId, pityStatus);

        // 保存抽卡记录
        await this.saveGachaRecords(userId, poolId, results);

        // ===== 步骤 6: 获取最新资产快照 =====
        const newAssets = await this.getUserAssets(userId);
        const inventoryCount = await this.getInventoryCount(userId);

        console.log(`\n✅ 抽卡完成！`);
        console.log(`   消耗: ${totalCost} ${currency}`);
        console.log(`   新余额: ${currency === 'gold' ? newAssets.goldBalance : newAssets.gemsBalance}`);
        console.log(`   物品数: ${results.length}`);
        console.log(`   背包总数: ${inventoryCount}`);
        console.log(`   当前保底: ${pityStatus.current_pulls}/70`);
        console.log('');

        // 统计稀有度
        const rarityStats = {
            common: results.filter(r => r.rarity === 'common').length,
            uncommon: results.filter(r => r.rarity === 'uncommon').length,
            rare: results.filter(r => r.rarity === 'rare').length,
            epic: results.filter(r => r.rarity === 'epic').length,
            legendary: results.filter(r => r.rarity === 'legendary').length,
        };

        console.log(`📊 稀有度分布:`);
        console.log(`   普通: ${rarityStats.common}`);
        console.log(`   不普通: ${rarityStats.uncommon}`);
        console.log(`   稀有: ${rarityStats.rare}`);
        console.log(`   史诗: ${rarityStats.epic}`);
        console.log(`   传说: ${rarityStats.legendary}`);

        // ===== 步骤 7: 发送事件通知 =====
        for (const result of results) {
            await this.eventBus.publishItemObtained({
                timestamp: new Date(),
                userId,
                instanceId: result.instanceId,
                templateId: result.templateId,
                instance: {
                    name: result.name,
                    rarity: result.rarity,
                    tier: result.tier
                }
            });
        }

        // ===== 步骤 8: 构建 Sanitized 响应（不暴露权重池） =====

        return {
            success: true,
            poolId,
            pullCount,
            currency,
            cost: totalCost,
            results: results, // ✅ 包含 isSoulbound 字段
            pityTriggered: pityStatus.current_pulls === 0,
            pityCounter: pityStatus.current_pulls,
            currentPityRate: pityStatus.current_pity_rate,
            assets: {
                goldBalance: newAssets.goldBalance,
                gemsBalance: newAssets.gemsBalance,
                inventoryCount
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 单次抽卡逻辑（服务器端随机数生成）
     */
    private async singlePull(
        userId: string,
        pool: GachaPool,
        currentPulls: number,
        pityRate: number,
        isPityTriggered: boolean
    ): Promise<GachaResult> {
        // ===== 步骤 1: 获取权重池（仅服务器端可见）=====
        const weightedTemplates = await this.getWeightedPool(pool.pool_weights);
        const totalWeight = weightedTemplates.reduce((sum, t) => sum + t.weight, 0);

        // ===== 步骤 2: 服务器端随机数生成（0-100）=====
        const rollValue = Math.floor(Math.random() * 101); // [0, 100] 整数

        // ===== 步骤 3: 判断是否通过保底 =====
        const isPityResult = isPityTriggered || (rollValue <= pityRate);

        // ===== 步骤 4: 选择模板（加权随机或保底）=====
        let selectedTemplate: { templateId: string; template: ItemTemplate };

        if (isPityResult) {
            // 保底逻辑：选择稀有度 >= Rare 的物品
            const eligibleTemplates = weightedTemplates.filter(
                t => ['rare', 'epic', 'legendary'].includes(t.template.rarity)
            );

            if (eligibleTemplates.length === 0) {
                // 兜底：选择最高稀有度
                const sortedByRarity = [...weightedTemplates].sort((a, b) => {
                    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
                    return rarityOrder.indexOf(b.template.rarity) - rarityOrder.indexOf(a.template.rarity);
                });
                selectedTemplate = sortedByRarity[0];
            } else {
                selectedTemplate = weightedRandomSelect(eligibleTemplates, eligibleTemplates.reduce((sum, t) => sum + t.weight, 0));
            }
        } else {
            // 普通加权随机
            selectedTemplate = weightedRandomSelect(weightedTemplates, totalWeight);
        }

        // ===== 步骤 5: 创建装备实例 =====
        const instanceId = `instance_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        const isSoulbound = selectedTemplate.template.rarity in ['epic', 'legendary']; // ⭐ 史诗和传说物品自动绑定

        const result: GachaResult = {
            instanceId,
            templateId: selectedTemplate.templateId,
            name: selectedTemplate.template.name,
            rarity: selectedTemplate.template.rarity,
            tier: selectedTemplate.template.tier,
            stats: selectedTemplate.template.stats,
            isPityResult,
            isSoulbound, // ⭐ 绑定字段
            obtainedAt: new Date().toISOString()
        };

        await this.createItemInstance(userId, instanceId, selectedTemplate.templateId, result);

        return result;
    }

    /**
     * 获取抽卡池配置
     */
    private async getPool(poolId: string): Promise<GachaPool | null> {
        const pool = await this.db.query<GachaPool>(
            'SELECT * FROM gacha_pools WHERE pool_id = $1 AND is_active = TRUE',
            [poolId]
        );
        return pool || null;
    }

    /**
     * 获取权重池（仅服务器端可见）
     */
    private async getWeightedPool(poolWeights: Array<{ templateId: string; pullWeight: number }>): Promise<Array<{ templateId: string; template: ItemTemplate; weight: number }>> {
        const weightedTemplates = [];

        for (const weightEntry of poolWeights) {
            const template = await this.db.query<ItemTemplate>(
                'SELECT * FROM item_templates WHERE id = $1',
                [weightEntry.templateId]
            );

            if (template) {
                weightedTemplates.push({
                    templateId: weightEntry.templateId,
                    template,
                    weight: weightEntry.pullWeight
                });
            }
        }

        return weightedTemplates;
    }

    /**
     * 获取用户资产
     */
    private async getUserAssets(userId: string): Promise<{ goldBalance: bigint; gemsBalance: bigint }> {
        const user = await this.db.query<{ gold_balance: bigint; gems_balance: bigint }>(
            'SELECT gold_balance, gems_balance FROM users WHERE id = $1',
            [userId]
        );

        if (!user) {
            throw new Error(`用户不存在: ${userId}`);
        }

        return {
            goldBalance: user.gold_balance,
            gemsBalance: user.gems_balance
        };
    }

    /**
     * 获取背包数量
     */
    private async getInventoryCount(userId: string): Promise<number> {
        const result = await this.db.query<{ count: bigint }>(
            'SELECT COUNT(*) as count FROM item_instances WHERE user_id = $1',
            [userId]
        );
        return Number(result?.count || 0);
    }

    /**
     * 扣除资产
     */
    private async deductAssets(userId: string, currency: 'gold' | 'gems', amount: bigint): Promise<void> {
        const column = currency === 'gold' ? 'gold_balance' : 'gems_balance';
        await this.db.query(
            `UPDATE users SET ${column} = ${column} - $1, updated_at = NOW() WHERE id = $2`,
            [amount, userId]
        );
    }

    /**
     * 获取保底状态
     */
    private async getPityStatus(userId: string, poolId: string): Promise<PityStatus> {
        let pityStatus = await this.db.query<PityStatus>(
            'SELECT * FROM gacha_pity_status WHERE user_id = $1 AND pool_id = $2',
            [userId, poolId]
        );

        if (!pityStatus) {
            // 初始化保底状态
            await this.db.query(
                'INSERT INTO gacha_pity_status (user_id, pool_id, current_pulls, current_pity_rate, is_pity_triggered) VALUES ($1, $2, 0, 0, FALSE)',
                [userId, poolId]
            );

            pityStatus = {
                user_id: userId,
                pool_id: poolId,
                current_pulls: 0,
                current_pity_rate: 0,
                is_pity_triggered: false
            };
        }

        return pityStatus;
    }

    /**
     * 更新保底状态
     */
    private async updatePityStatus(userId: string, poolId: string, pityStatus: Partial<PityStatus>): Promise<void> {
        await this.db.query(
            `UPDATE gacha_pity_status
             SET current_pulls = $1,
                 current_pity_rate = $2,
                 is_pity_triggered = $3,
                 updated_at = NOW()
             WHERE user_id = $4 AND pool_id = $5`,
            [pityStatus.current_pulls, pityStatus.current_pity_rate, pityStatus.is_pity_triggered, userId, poolId]
        );
    }

    /**
     * 创建装备实例（包含 is_soulbound 字段）
     */
    private async createItemInstance(
        userId: string,
        instanceId: string,
        templateId: string,
        result: GachaResult
    ): Promise<void> {
        await this.db.query(
            `INSERT INTO item_instances
                (instance_id, template_id, user_id, instance_name, rarity, tier, stats,
                 is_soulbound, is_permanent, is_equipped, obtained_from, obtained_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())`,
            [
                instanceId,
                templateId,
                userId,
                result.name,
                result.rarity,
                result.tier,
                JSON.stringify(result.stats),
                result.isSoulbound,// ⭐ 绑定字段
                false,
                false,
                'gacha',
                new Date()
            ]
        );
    }

    /**
     * 保存抽卡记录
     */
    private async saveGachaRecords(userId: string, poolId: string, results: GachaResult[]): Promise<void> {
        for (const result of results) {
            await this.db.query(
                `INSERT INTO gacha_records
                    (user_id, pool_id, instance_id, template_id, rarity, tier,
                     is_pity_result, pity_count_at_pull, roll_value, adjusted_chance, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
                [
                    userId,
                    poolId,
                    result.instanceId,
                    result.templateId,
                    result.rarity,
                    result.tier,
                    result.isPityResult,
                    0, // TODO: 获取当前的 pity_counter
                    Math.floor(Math.random() * 101), // 服务器端随机值
                    result.isPityResult ? 100 : 0
                ]
            );
        }
    }
}

export { GachaService };
