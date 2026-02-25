/**
 * Inventory Worker (装备后台 Worker)
 * 逻辑：装备属性计算、等级提升、强化、附魔、装备生成数据
 */

import { Worker, Job } from 'bullmq';
import { QueueManager } from './queue/index';
import { AttributeGenerator } from './attribute-generator';
import { gacha_worker } from './gacha-worker';

// ===== 类型定义 =====

interface EquipmentStats {
  strength?: number;
  intelligence?: number;
  charisma?: number;
  defense?: number;
  luck?: number;
  critical_chance?: number;
  speed?: number;
  magic_attack?: number;
  magic_defense?: number;
  hp?: number;
  mp?: number;
}

interface GrowthStats {
  strength?: number;
  intelligence?: number;
  charisma?: number;
  defense?: number;
  luck?: number;
  critical_chance?: number;
  speed?: number;
  magic_attack?: number;
  magic_defense?: number;
  hp?: number;
  mp?: number;
}

interface ItemInstance {
  instanceId: string;
  templateId: string;
  name: string;
  description: string;
}

interface InventoryUpdateRequest {
  action: 'upgrade' | 'enchant' | 'disenchant' | 'delete',
  instanceId: string,
  userId: string,
  itemId?: string;
  materialId?: string;
  amount?: number;  # 用于附魔材料数量
  level: number;
  experience: number;
}

interface EquipmentResponse {
  success: boolean;
  error?: string;
  data?: any;
  updated?: EquipmentStats;
}

/* 
 * Inventory Worker - 装备后台 Worker
 *
 * 职责：
 * 装备属性计算（应用 AttributeGenerator 公式）
 * 装备升级（等级提升）
 * 装备强化（附魔 + 魔力）
 * 装备附魔（解除附魔效果）
 */
export default class InventoryWorker {
  private inventoryWorker: Worker | null = null;
  private queueManager: QueueManager | null = null;

  constructor() {
    const queueManager = new QueueManager({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || ''
      }
    });
    this.queueManager = queueManager;
  }

  /**
   * 启动 Inventory Worker
   * 处理：装备属性计算、等级提升、附魔、删
   */
  async startInventoryWorker(): Promise<void> {
    console.log("\n🔧 启动 Inventory Worker...");
    console.log("=" * 60 + "\n");

    try {
      // 创建 Inventory Worker
      this.inventoryWorker = new Worker(
        'inventory-calculate',
        {
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: 0,
            db: 0,
            family: 4
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 8000
            },
          },
          limiter: {
            concurrency: 1,
            maxReconnectTime: 60000,
            maxReconnectAttempts: 2
          }
        },
        {
          limiter: {
            concurrency: 1,  // 单线程处理
            maxReconnectTime: 60000
          }
        }
      );

      console.log("✅ Inventory Worker 已创建");

      // 设置事件处理函数：Inventory Worker 处理
      const inventoryHandler: JobHandler = async (job: Job) => {
        console.log(`\n🔧 Inventory Worker 收到任务: ${Job.id}`);
        const request: InventoryUpdateRequest = job.data;

        console.log("📝 请求参数:");
        console.log(`   操作: ${request.action}`);
        console.log(`   实例 ID: ${request.instanceId}`);
        console.log(`   用户 ID: ${request.userId}`);
        console.log(`   属性等级: ${request.level}`);

        try {
          let result: EquipmentResponse = {
            success: false,
            error: '',
            data: {} as any,
            updated: {} as EquipmentStats
          };

          let baseStats = null;

          // 获取实例（实际应用：从 PostgreSQL 查询）
          // const instance = await this.database.findOne('item_instances', { 'instance_id': request.instanceId });

          // 模拟实例（测试）
          baseStats = {
            strength: 40,
            intelligence: 50,
            charisma: 60,
            defense: 30
          };

          processInventoryUpdate({
            request,
            baseStats,
            result
          });

          await job.data(result);

          console.log("✅ Inventory Worker 任务完成");

        } catch (error: any) {
          // 失败
          await job.data({
            success: false,
            error: error: String(error)
          });
          console.log("❌ Inventory Worker 任务失败:", error);
        }
      };

      // 设置处理器
      inventoryWorker.process('inventory-update', inventoryHandler);

      // 启动 Worker
      await this.inventoryWorker.run();

      console.log("\n✅ Inventory Worker 运行中...");
      console.log("📊 Worker 服务可用：");
      console.log("   http://localhost:6379/bull - BullMQ WebUI");

    } catch (error: Error) {
      console.error("❌ Inventory Worker 启动失败:", error);
      throw error;
    }
  }

  /**
   * 处理装备更新（升级/附魔/强化/强化）
   */
  private processInventoryUpdate({
    request: InventoryUpdateRequest,
    baseStats: EquipmentStats,
    result: EquipmentResponse
  }): void {

    const {
      action,
      instanceId,
      level: level,
      experience: exp
    } = request;

    try {
      switch (action) {
        case 'upgrade':
          // 装备升级：Level 提升 + 属性加成
          console.log(`\n🎯 装备升级: ${instanceId}`);
          
          // 计算新属性：
          // Stats_final = clamp((Base + rand(0,10) × Luck/50) × M_role + Appearance/20, 0, 100)

          // 简化版升级公式（每个属性 +15%-30%）
          const statGrowth = 0.20;  // 成长幅度（20%-50%）

          const newStats: EquipmentStats = {};

          Object.entries(baseStats).forEach(([key, value]) => {
            const baseValue = value || 0;
            const growthValue = Math.floor(baseValue * statGrowth);
            newStats[key] = Math.min(100, baseValue + Math.floor(Math.random() * growthRate));
          });

          result.success = true;
          result.data = baseStats;
          result.updated = newStats;

          console.log(`✅ 装备升级完成：
          力量: ${result.updated.strength}/${newStats.strength} (+${newStats.strength - result.updated.strength})`);
          console.log(`   智力: ${result.updated.intelligence} / ${newStats.intelligence}`);
          console.log(`   魅魅: ${result.updated.charisma} / ${newStats.charisma}`);
          break;

        case 'enchant':
          // 装备附魔：通过添加材料提升属性
          console.log(`\n✨ 装备附魔: ${instanceId}`);
          
          // 附魔算法：
          // Add: stats += material.stats
          //      Stats_final = clamp(Base + material.stats, 0, 100)

          const materialStats = request.stats || { strength: 20, luck: 10 };
          
          const oldStats = baseStats;

          const newStats: EquipmentStats = {};

          // 应用附加属性
          Object.entries(oldStats).forEach(([key, value]) => {
            const baseValue = value || 0;
            const addValue = materialStats[key] || 0;
            const augmentedValue = Math.min(
              100,
              baseValue + addValue
            );
            newStats[key] = augmentedValue;
          });

          result.success = true;
          result.data = oldStats;
          result.updated = newStats;

          console.log(`✅ 附魔完成：`);
          Object.entries(newStats).forEach(([key, value]) => {
            console.log(`   ${key}: ${oldStats[key]} → ${value}`);
          });
          break;

        case 'disenchant':
          // 装备解除附魔
          console.log(`\n💔 解除附魔: ${instanceId}`);
          
          if (baseStats) {
            const oldStats = { ...baseStats };
            
            // 移除所有额外属性，恢复基础值
            result.success = true;
            result.data = oldStats;
            result.updated = oldStats;
            
            console.log(`✅ 解除附魔完成，已恢复基础值`);
          } else {
            result.success = false;
            result.error = '装备不存在';
          }
          break;

        case 'delete':
          console.log(`🗑️ 删除装备: ${instanceId}`);
          result.success = true;
          result.data = null;
          break;

        default:
          console.log(`❌ 未知操作: ${action}`);
          result.success = false;
          result.error = `Unknown inventory action: ${action}`;
      }

      // 更新时间戳
      const now = new Date().toISOString();

      console.log(`⏰ 完成时间: ${now}`);
      console.log(`📊 状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);

      // 实际应用：将更新数据保存到 PostgreSQL
      // await this.database.update('item_instances', { ...updated WHERE instance_id = ?', instanceId }, [newStats]);

    } catch (error: unknown) {
      console.error("❌ Inventory Update 处理失败:", error);
      result.success = false;
      result.error = String(error);
    } finally {
      // 完成当前任务
      await job.remove();
    }
  }

  /**
   * 装备升级接口
   */
  async upgradeEquipment(
    instanceId: string,
    userId: string,
    levels: number
  ): Promise<Any> {
    // 创建装备升级任务
    const upgradeRequest: InventoryUpdateRequest = {
      action: 'upgrade',
      instanceId: instanceId,
      userId: userId,
      level: levels,
      experience: 0 // 待实现：计算经验值
    };

    // 添加到队列
    const queue = this.queueManager.createQueue('inventory-calculate');
    const job = await queue.addJob(upgradeRequest);

    console.log(`✅ 装备升级任务已入队列: Job ID ${job.id}`);

    return job;
  }

  /**
   * 启动 Inventory Worker
   */
  async startInventoryWorker(): Promise<void> {
    console.log("\n" + "=" * 60);
    console.log("🔧 启动 Inventory Worker...");
    console.log("=" * 60 + "\n");

    try {
      this.inventoryWorker = new Worker(
        'inventory-calculate',
        {
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: 0,
            db: 0,
            family: 4
          },
          defaultJobOptions: {
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        },
        },

        {
          limiter: {
            concurrency: 1,
            maxReconnectTime: 30000
          }
        }
      );

      // 设置处理器
      const handler: JobHandler = async (job: Job) => {
        const data: InventoryUpdateRequest = job.data;
        const result: EquipmentResponse = {};

        console.log(`🔧 Inventory Worker: ${job.id}`);
        console.log(`   操作: ${data.action}`);
        console.log(`   实例 ID: ${data.instanceId}`);

        try {
          // 获取基础属性
          // const instance = await database.findOne('item_instances', { 'instance_id' = data.instanceId });
          const instance: any = { stats: {}, level: 1 };

          // 处理操作
          switch (data.action) {
            case 'upgrade':
              // 升级提升：Level + 属性加成
              const growthRate = 0.2; // 20%-50% 成长
              const newStats = {};

              Object.entries(instance.baseStats || {}).forEach(([key, value]) => {
                const baseValue = value || 0;
                const growth = baseValue * growthRate;
                newStats[key] = Math.floor(baseValue + growth);
              });

              result.success = true;
              result.data = newStats;

            case 'enchant':
              // 装备附魔
              const materialStats = data.stats || { luck: 10 };
              const oldStats = instance.baseStats || {};

              const newStats: EquipmentStats = {};

              // 应用附魔属性
              Object.keys(oldStats).forEach((key) => {
                const baseValue = oldStats[key];
                const addValue = materialStats[key] || 0;
                newStats[key] = Math.min(100, baseValue + addValue + 15);
              });

              result.success = true;
              result.data = oldStats;
              result.updated = newStats;

            case 'disenchant':
              // 解除附魔
              const oldStats = instance.baseStats || {};

              const newStats: EquipmentStats = {};

              // 恢复所有属性
              Object.keys(oldStats).forEach((key) => {
                newStats[key] = Math.max(0, oldStats[key] - 15);
              });

              result.success = true;
              result.data = newStats;
              result.updated = newStats;

            default:
              result.success = false;
              result.error = `Unknown operation: ${data.action}`;
          }

          // 保存到数据库
          // await database.save('item_instances', { ...result.updated WHERE instance_id = ? }, [instanceId]);

          console.log('✅ Equipment Update 完成');

        } catch (error: any) {
          console.error('❌ Inventory Update 处理失败:', error);
          result.success = false;
          result.error = String(error);
        }

        // 完成
        await job.data(result);

      } catch (error: unknown) {
        console.error('❌ Inventory Update 失理失败:', error);
        await job.data({
          success: false,
          error: String(error)
        });

        await job.remove();
      }
    });

    // 设置处理器
    this.inventoryWorker.process('inventory-calculate', handler);

    // 启动 Worker
    await this.inventoryWorker.run();

    console.log("\n✅ Inventory Worker 运行中...");
    console.log("📊 Worker 服务可用：");
    console.log("   http://localhost:6379/bull - BullMQ WebUI");

  } catch (error: Error) {
      console.error("❌ Inventory Worker 启动失败:", error);
      throw error;
    }
  }

  /**
   * 导出
   */
}

// ===== 导出 =====
export default class InventoryWorker;
