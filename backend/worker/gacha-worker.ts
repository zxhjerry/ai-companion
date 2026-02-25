/**
 * Gacha Worker (抽卡 Worker)
 * 逻辑：随机算法、保底机制、隐藏事件触发、稀有度计算
 * 配置：在后台启动 Gacha Worker 时调用
 */

import { Queue, Worker, Job } from 'bullmq';

// ===== 类型定义 =====

interface GachaPullRequest {
  userId: string;
  poolId: string;
  pullCount: number; // 抽取次数
  currency: 'gold' | 'gems';
  usePity?: boolean;
}

interface GachaWorkerConfig {
  poolName: string;
  weightConfig: {
    [templateId: string]: number;
    eventId: string;
    eventName: string;
    resultRarity: number;
    pullRate: number;
    effect?: string;
  }[];
  pityConfig: {
    enabled: boolean;
    baseRate: number;
    incrementRate: number;
    maxRate: number;
    guaranteeTier: string;
    guaranteeCount: number;
  };
  database: DatabaseService;
}

interface WeightItemTemplate {
  templateId: string;
  eventId: string;
  eventName: string;
  resultRarity: number;
  pullRate: number;
  effect: string;
  pullWeight: number;
}

interface WeightedPool {
  poolName: string;
  items: WeightItemTemplate[];
  totalWeight: number;
}

// ===== 抽卡辅助函数 =====

/**
 * 计算保底概率（根据连续未命中次数）
 * Algorithm: P_current = min(P_base + consecutiveMisses × P_increment, P_max)
 */
function calculatePityRate(
  baseRate: number,
  incrementRate: number,
  maxRate: number,
  consecutiveMisses: number
): number {
  const adjustedRate = Math.min(
    maxRate,
    baseRate + (consecutiveMisses * incrementRate)
  );
  return Math.round(adjustedRate);
}

/**
 * 判断是否触发保底
 */
function isPityTriggered(
  consecutiveMisses: number,
  guaranteeTier: string,
  guaranteeCount: number
): boolean {
  return consecutiveMisses >= guaranteeCount;
}

/**
 * 获取随机生成值（0-100）
 */
function getRandomValue(): number {
  return Math.floor(Math.random() * 101);
}

/**
 * 映射稀有度等级
 */
function getRarityFromRate(rate: number): string {
  if (rate >= 96) return 'legendary';
  if (rate >= 80) return 'epic';
  if (rate >= 60) return 'rare';
  if (rate >= 50) return 'uncommon';
  return 'common';
}

export default class GachaWorker {
  gachaWorker: Worker;

  constructor(queueName: string, config: GachaWorkerConfig) {
    try {
      super(queueName, {
        redis: {
          ...config.database.redis,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      },
        {
          limiter: {
            concurrency: 1,
          maxReconnectTime: 60000, / * 1 分钟
            maxReconnectAttempts: 3
          }
        }
      })
    } catch (error) {
      console.error('❌ Gacha Worker 创建失败:', error);
      throw error;
    }

    // Worker 节点：抽卡逻辑
    this.gachaWorker.process(async (job: Job) => {
      const { data } = job;
      const {
        poolId,
        userId,
        pullCount,
        currency,
        usePity
      } = data;

      console.log(`\n\n==================================`);
      console.log(`🎯 Gacha Worker - 抽卡系统`);
      console.log(`=================================`);
      console.log(`\n数据输入:`);
      console.log(JSON.stringify(data, null, 2));

      try {
        // ===== 步骤 1：获取用户保底状态 =====
        // TODO: 实际从数据库读取
        const pityStatus = {
          userId: userId,
          currentPityRate: 50,
          consecutiveMisses: 0,
          guaranteeTier: 'uncommon',
          guaranteeCount: 0,
          lastTriggerTimestamp: ''
        };

        console.log('\n🎲 当前保底状态:');
        console.log(`   保底概率: ${pityStatus.currentPityRate}%`);
        console.log(`   连续未命中: ${pityStatus.consecutiveMisses} 次`);

        // ===== 步骤 2: 计算实际抽取次数（10 条 × 消耗次数）===================================
        const totalPulls = pullCount * 10;

        console.log(`\n🎬️  总抽取次数: ${totalPulls}`);
        console.log(`   消耗: ${totalPulls * 100} ${currency}`);

        // ===== 步骤 3: 结果预计算 =====

        // 抽卡配置（实际应用中应从数据库获取）
        const pullConfig = {
          poolName: poolId,
          weightedPool: [
            { id: 'weapon_001', pullWeight: 100, eventId: 'evt_001', eventName: '基础掉落：武器', resultRarity: 1, pullRate: 60, effect: '无' },
            { id: 'armor_002', pullWeight: 50, eventId: 'evt_002', eventName: '稀有掉落：防御', resultRarity = 3), pullRate: 80, effect: '防御+5' },
            { id: 'evt_003', pullWeight: 30, eventName: '隐藏事件触发', resultRarity: 4), pullRate: 95, effect: '触发隐藏事件' },
            { id: 'item_004', pullWeight: 10, eventName: '稀有道具掉落', resultRarity: 3), pullRate: 85, effect: '获得稀有道具' }
          ],
          totalWeight: 0
        };

        // 初始化权重
        pullConfig.weightedPool.forEach(item => {
          pullConfig.totalWeight += item.pullWeight;
        });

        console.log('📊 抽卡池权重配置:');
        pullConfig.weightedPool.forEach(item => {
          console.log(`   ${item.itemName}: 权重 ${item.pullWeight} / ${pullConfig.totalWeight}%`, ` 事件: ${item.eventName}`);
          console.log(`   预期结果：${item.resultRarity} 稀有度`);
        });

        // ===== 步骤 4: 为每次抽卡循环生成结果 =====

        const pullResults = [];

        for (let i = 0; i < pullCount; i++) {
          const result = await this.singlePull(
            pullConfig,
            userId,
            pityStatus,
            usePity,
            i
          );
          
          pullResults.push(result);
          
          if (result.isPityResult) {
            // 保底：重置连续未命中次数
            console.log('\n🎯 保底触发！');
            pityStatus.consecutiveMisses = 0;  // 重置为 0
            pityStatus.currentPityRate = 50;   // 重置为 50
            
            note = `🎁 保底命中: ${result.rarity}`;
            console.log(note);
            
            pullResults.push({ isNote: note, eventInfo: result.eventInfo });
          }
        }

        // ===== 步骤 5: 统计 =====

        const stats = {
          totalPulls: pullCount,
          pityTriggered: pullResults.filter(r => r.isPityResult).length,
          rareCount: pullResults.filter(r => r.rarity === 'rare').length,
          epicCount: pullResults.filter(r => r.rarity === 'epic').length,
          legendaryCount: pullResults.filter(r => r.rarity === 'legendary').length,
        };

        console.log('\n📊 抽卡统计:');
        console.log(`   总抽取次数: ${stats.totalPulls}`);
        console.log(`   保底触发次数: ${stats.pityTriggered}`);
        console.log('   各等级计数:');
        console.log(`     稀有 (RARE): ${stats.rareCount}`);
        console.log(`     史诗 (EPIC): ${stats.epicCount}`);
        console.log('     传説(LEGENDARY): ${stats.legendaryCount}`);
        console.log('     普通 (COMMON): ${stats.totalPulls - stats.rareCount - stats.epicCount - stats.legendary}`);

        console.log('\n✅ Gacha 抽卡完成！');

      // 更新保底状态（实际应用中应写入数据库）
        const updatedPityStatus = {
          userId,
          currentPityRate: Math.min(80, 50 + pitStatus.consecutiveMisses * 5),
          consecutiveMisses: 0,
          guaranteeTier: pitStatus.guaranteeTier,
          guaranteeCount: 0,
          lastTriggerTimestamp: new Date().toISOString()
        };

        console.log('\n📝 保底状态更新:');
        console.log(`   连续未命中: ${updatedPityStatus.consecutiveMisses}`);
        console.log(`   新保底率: ${updatedPityStatus.currentPityRate}%`);

        const payload = {
          userId,
          pullResults,
          pityStatus: updatedPityStatus,
          consumedCurrency: { currency },
          timestamp: new Date().toISOString()
        };

        await job.update(payload);

        console.log('✅ 抽卡记录已保存');

      } catch (error: Error) {
        console.error('❌ Gacha Worker 执行失败:', error);
        throw error;
      }
    });

    /**
     * 单次抽取
     */
    private async singlePull(
      pullConfig: WeightedPool,
      userId: string,
      pityStatus: {
        currentPityRate: number,
        guaranteeTier: string,
        guaranteeCount: number,
        lastTriggerTimestamp: string
      },
      usePity?: boolean,
      pullIndex: number,
    ): Promise<{
      instanceId: string;
      templateId: string;
      name: string;
      rarity: string;
      tier: number;
      eventInfo?: {
        eventId: string;
        eventType: string;
        name: string;
        trigger: boolean;
        description: string;
      };
      isPityResult: boolean;
    }> {
      // ===== 步骤 1: 初始化临时保底状态 =====

      // 检查是否触发保底
      let _usePity = false;
      let triggeredLuckRate = pityStatus.currentPityRate;

      // 判断是否需要启用保底
      if (usePity && isPityTriggered(
        pityStatus.consecutiveMisses,
        pityStatus.guaranteeTier,
        pityStatus.guaranteeCount
      )) {
        _usePity = true;
        // 保底时使用保底概率
        triggeredLuckRate = pityStatus.currentPityRate;
        console.log('\n🎯 使用保底机制');
      }

      console.log(`\n🎲 抽卡循环 ${pullIndex + 1}/${_usePity ? '保底' : '标准'} 模式:`);

      // ===== 步骤 2: 计算随机值（原始值 - 根据概率分布） =====
      
      const rollValue = getRandomValue(); // [0-100]

      // 模拟概率分布（基于掉落率配置）
      // 这里简化为均匀分布
      const resultRarity = getRarityFromRate(rollValue);

      // ===== 步骤 3: 找到对应稀有度的第一个模板 =====
      const chosenItem = pullConfig.weightedPool.find(item => {
        item.resultRarity === resultRarity
      });

      if (!chosenItem) {
        console.error(`❌ 未找到稀有度 ${resultRarity} 的模板`);
        // Fallback: 使用 lowest rarity
        const lowestItem = pullConfig.weightedPool.sort((a, b) =>
          a.rarity > b.rarity
        )[0];
        if (lowestItem) {
          console.log(`⚠️  回退使用最低稀有度: ${lowestItem.rarity}`);
          chosenItem = lowestItem;
        } else {
          throw new Error('没有可用的掉落模板');
        }
      }

      // ===== 步骤 4: 检查是否触发隐藏事件 =====
      if (rollValue <= 50) { // 隐藏事件触发阈值
        const hiddenEvents = [
          { eventId: 'evt_001', name: '隐藏事件：幸运暴击', description: '暴击率 +25%' },
          { eventId: 'evt_002', name: '隐藏事件：技能触发', description: '技能冷却 -50%' },
          { eventId: 'evt_003', name: '隐藏事件：隐藏剧情分支', description: '进入隐藏剧情' },
          { eventId: 'evt_004', name: '隐藏事件：稀有道具掉落', description: '稀有稀有道具' },
          { eventId: 'evt_005', name: '隐藏事件：幸运值提升', description: '幸运值 +20' }
        ];

        // 随机选择一个
        const chosenEvent = hiddenEvents[Math.floor(Math.random() * hiddenEvents.length)];
        
        console.log('\n🎭 触发隐藏事件:');
        console.log(`   📅 ${chosenEvent.name}`);
        console.log(`   📝 ${chosenEvent.description}`);
        console.log(`   💬 触发方式: 随机选择`);
      }

      // ===== 步步 5: 生成实例 ID 和基础属性 =====

      const instanceId = 'instance_' + (Date.now() + '_' + Math.floor(Math.random() * 1000));

      // 模拟实例属性生成
      // 在 Gacha Worker 中，会应用 AttributeGenerator 计算
      console.log('\n✨ 生成实例 ID:', instanceId);

      // ===== 步骤 6: 生成事件信息（如果触发）=====
      let eventInfo;

      if (rollValue <= 50 && chosenEvent) {
        eventInfo = {
          eventId: chosenEvent.eventId,
          eventType: 'hidden-event',
          name: chosenEvent.name,
          trigger: true,
          description: chosenEvent.description
        };
        console.log('\n🎬 保底保底触发，获得事件');
      }

      // 模拟实例数据
      let instance: any = {
        instanceId: instanceId,
        templateId: chosenItem.id,
        userId: userId,
        rarity: resultRarity || 'common',
        eventInfo: eventInfo
      };

      // 装备属性（成长曲线）- 应用 AttributeGenerator 计算初始值

      console.log('✨ 实例数据生成完成');
      console.log(`   概率: ${rollValue} (${Math.round(rollValue)})`);
      console.log(`   稀有度: ${resultRarity}`);
      console.log(`   模板: ${chosenItem.name}`);

      // ===== 步骤 7: 更新连续未命中次数 =====

      // 根据是否保底调整状态
      if (!_usePity) {
        const oldMisses = pitStatus.consecutiveMisses;
        console.log(`• 连续未命中: ${oldMisses} → ${oldMisses + 1}`);
        pityStatus.consecutiveMisses++;
      }

      // 如果使用了保底，重置计数
      if (_usePity && !isPityTriggered) {
        console.log(`• 已重置连续未命中计数`);
        pitStatus.consecutiveMisses = 0;
      }

      console.log(`\n✅ 抽卡完成 → 数据已发送至后端处理`);

      return {
        instanceId: instanceId,
        templateId: chosenItem.id,
        rarity: resultRarity || 'common',
        eventInfo,
        isPityResult: _usePity && isPityTriggered,
        rollValue,
        timestamp: new Date()
      };
    }

    /**
     * 保存抽卡记录
     */
    async savePullRecords(
      pullResults: [],
      userId: string,
      poolId: string
    ): Promise<void> {
      await job.data({
        userId,
        poolId,
        pullResults,
        timestamp: new Date()
      });
    }
  }

// ===== 导出 =====
export { GachaWorker };
