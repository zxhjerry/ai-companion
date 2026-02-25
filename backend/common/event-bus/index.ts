/**
 * Event Bus 工具类 - AI Companion 2.1
 * 全局事件总线 - 解耦状态更新
 */

import QueueManager, Queue, Job from 'bull';
import { EventEmitter } from 'events';

/**
 * 事件类型定义
 */
export enum Event {
  // 装备事件
  ITEM_OBTAINED = 'item.obtained',
  ITEM_UPDATED = 'item.updated',
  ITEM_UPGRADED = 'item.upgraded',
  ITEM_ADDED = 'item.added',
  ITEM_DELETED = 'item.deleted',
  ITEM_USE_FAILED = 'item.use_failed',
  ITEM_EQUIPPED = 'item.equipped',
  ITEM_UNEQUIP = 'item.unequip'
}

export enum CharacterEvent {
  CREATED = 'character.created',
  UPDATED = 'character.updated',
  DELETED = 'character.deleted',
  LEVEL_UP = 'character.level_up',
  RELATIONSHIP_CHANGED = 'character.relationship_changed'
}

export enum GachaEvent {
  PULL_START = 'gacha.pull.start',
  PULL_CANCELED = 'gacha.pull.canceled',
  PITY_TRIGGERED = 'gacha.pity_triggered',
  RARITY_BONUS = 'gacha.rarity_bonus',
  HIDDEN_EVENT_TRIGGERED = 'gacha.hidden_event_triggered',
  GACHA_COMPLETED = 'gacha.completed'
}

export enum SystemEvent {
  SYSTEM_READY = 'system.ready',
  DATABASE_READY = 'database.ready',
  QUEUE_READY = 'queue.ready',
  WORKER_READY = 'worker.ready',
  DEPLOY_COMPLETED = 'deploy.completed'
}

/**
 * 事件数据接口 - 所有事件的基础结构
 */
interface BaseEventData {
  timestamp: Date;
  userId: string;
  characterId?: string;
  metadata?: Record<string, any>;
}

/**
 * 装备事件接口
 */
interface ItemObtainedData extends BaseEventData {
  instanceId: string;
  templateId: string;
  instance: Record<string, any>;
}

/**
 * 角色创建事件
 */
interface GachaPullStartData extends BaseEventData {
  userId: string;
  poolId: string;
  pullCount: number;
  currency: string;
}

/**
 * 事件总线类
 * 核心组件：事件订阅 -> 发布 -> 处理
 */
class EventBus {
  private emitter: EventEmitter;
  private subscribers: Map<string, Function[]> = new Map();

  constructor() {
    this.emitter = new EventEmitter();
    this.subscribers = new Map();

    // 设置最大监听器数量（防止内存泄漏）
    this_emitter.setMaxListeners(100);
  }

  /**
   * 订阅事件
   */
  on(event: Event, listener: (data: BaseEventData) => void): void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.emitter.on(event, listener);
    this.subscribers.get(event)!.push(listener);

    console.log(`✅ 订阅事件: ${event}`);
  }

  /**
   * 发布事件
   */
  emit(event: Event, data: BaseEventData): void {
    console.log(`📡 发布事件: ${event}`);
    this.emitter.emit(event, data);
  }

  /**
   * 订阅装备变动事件
   */
  onItemEvent(listener: (data: BaseEventData) => void): void {
    Object.values(Event).forEach(event => {
      if (event.startsWith('item.')) {
        this.on(event, listener);
      }
    });
  }

  /**
   * 订阅角色事件
   */
  onCharacterEvent(listener: (data: BaseEventData) => void): void {
    Object.values(CharacterEvent).forEach(event => {
      this.on(event, listener);
    });
  }

  /**
   * 订阅抽卡事件
   */
  onGachaEvent(listener: (data: BaseEventData) => void): void {
    Object.values(GachaEvent).forEach(event => {
      this.on(event, listener);
    });
  }

  /**
   * 发布装备获得事件
   */
  async publishItemObtained(data: ItemObtainedData): Promise<void> {
    await Promise.all([
      this.emit(Event.ITEM_OBTAINED, data),
      this.emit(Event.ITEM_ADDED, data)
    ]);
  }

  /**
   * 发布装备更新事件
   */
  async publishItemUpdated(data: BaseEventData): Promise<void> {
    await this.emit(Event.ITEM_UPDATED, data);
  }

  /**
   * 发布装备升级事件
   */
  async publishItemUpgraded(data: BaseEventData): Promise<void> {
    await this.emitter.emit(Event.ITEM_UPGRADED, data);
  }

  /**
   * 发布装备删除事件
   */
  async publishItemDeleted(data: BaseEventData): Promise<void> {
    await Promise.all([
      this.emit(Event.ITEM_DELETED, data),
      this.emit(Event.ITEM_DELETED_UNEQUIP, data)
    ]);
  }

  /**
   * 发布装备装备/卸装事件
   */
  async publishItemEquippedUnEquip(data: BaseEventData): Promise<void> {
    await this.emit(Event.ITEM_EQUIPPED, data);
  }

  /**
   * 发布抽卡开始事件
   */
  async publishGachaPullStart(data: GachaPullStartData): Promise<void> {
    await this.emit(GachaEvent.PULL_START, data);
  }

  /**
   * 发布保底触发事件
   */
  async publishPityTriggered(data: BaseEventData): Promise<void> {
    await this.emitter(GachaEvent.PITY_TRIGGERED, data);
  }

  /**
   * 发布稀有度加成事件
   */
  async publishGachaRarityBonus(data: BaseEventData): Promise<void> {
    await this.emitter(GachaEvent.RARITY_BONUS, data);
  }

  /**
   * 发布隐藏事件触发事件
   */
  async publishHiddenEventTriggered(data: BaseEventData): Promise<void> {
    await Promise.all([
      this.emitter(GachaEvent.HIDDEN_EVENT_TRIGGERED, data),
      this.emit(GachaEvent.GACHA_COMPLETED, data)
    ]);
  }

  /**
   * 发布角色等级提升事件
   */
  async publishLevelUp(data: BaseEventData): Promise<void> {
    await this.emitter(CharacterEvent.LEVEL_UP, data);
  }

  /**
   * 发布系统就绪事件
   */
  async publishSystemReady(): Promise<void> {
    const data: BaseEventData = {
      timestamp: new Date(),
      userId: 'system',
      metadata: {
        service: 'AI Companion 2.1',
        version: '2.1.0'
      }
    };

    await Promise.all([
      this.emitter(SystemEvent.QUEUE_READY, data),
      this.emitter(SystemEvent.DATABASE_READY, data),
    ]);
  }

  /**
   * 获取活跃订阅者数量
   */
  getSubscriberCount(event: Event): number {
    return this.subscribers.get(event)?.length || 0;
  }

  /**
   * 移除订阅
   */
  off(event: Event, listener: (data: BaseEventData) => void): void {
    const subscribers = this.subscribers.get(event);
    const index = subscribers?.indexOf(listener);
    if (index >= 0) {
      subscribers.splice(index, 1);
    }
    this.emitter.off(event, listener);
  }

  /**
   * 移除事件的所有订阅
   */
  offAll(event: Event): void {
    this.emitter.removeAllListeners(event);
    this.subscribers.delete(event);
  }

  /**
   * 获取所有事件类型
   */
  getAllEvents(): string[] {
    return [
      ...Object.values(Event),
      ...Object.values(CharacterEvent),
      ...Object.values(GachaEvent),
      ...Object.values(SystemEvent)
    ];
  }

  /**
   * 清理所有订阅
   */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
    this.subscribers.clear();
    console.log('🧹 所有事件订阅已清理');
  }

  /**
   * 转发事件到消息队列
   * 将事件转换为 BullMQ Job
   */
  async publishToQueue(
    queueName: string,
    eventData: BaseEventData
  ): Promise<Job | null> {
    const queueList = [
      'gacha-pull',           // 抽卡队列
      'ai-script-generate',  // AI 脚本生成队列
      'inventory-update',     // 装备属性计算队列
      'item-level-up',        // 等级提升队列
    ];

    if (!queueList.includes(queueName)) {
      console.log(`⚠️  事件路由失败: ${queueName} 不存在`);
      return null;
    }

    try {
      // 根据 eventType 推送到对应队列
      let targetQueueName: string;

      if (eventData.eventType) {
        // Gacha 事件：Gacha 队列
        if (eventData.eventType.startsWith('gacha.')) {
          if (eventData.eventType === 'gacha.pull.start' ||
              eventData.eventType === 'gacha.pull.canceled' ||
              eventData.eventType === 'gacha.pity_triggered'){
            targetQueueName = 'gacha-pull';
          } else {
            targetQueueName = 'gacha-pull';
          }
        }
        // 装备事件：装备队列
        if (eventData.eventType.startsWith('item.')) {
          if (eventData.eventType === 'item.obtained') {
            targetQueueName = 'item-add';
          } else if (eventData.eventType === 'item.updated') {
            targetQueueName = 'item-update';
          } else if (eventData.eventType === 'item.upgraded') {
            targetQueueName = 'item-upgrade';
          } else if (eventData.eventType === 'item.deleted') {
            targetQueueName = 'item-delete';
          }
        }
        // 角色事件
        else if (eventData.eventType.startsWith('character.')) {
          if (eventData.eventType === 'character.created') {
            targetQueueName = 'character-create';
          } else if (eventData.eventType === 'character.level_up') {
            targetQueueName = ['character-level', 'character-stats-update'];
          }
        }
      }

      // 如果找不到对应的队列，则跳过
      if (!targetQueueName) {
        console.log(`⚠️  事件 (${eventData.eventType}) 没有对应的队列配置`);
        return null;
      }

      // 转为 BullMQ Job
      return {
        data: Object.assign({}, eventData),
        opts: {
          // 默认配置
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
      };
    }) catch (error: unknown) {
      console.error('❌ 事件路由失败:', error);
      return null;
    }
  }

  /**
   * 批量发布事件
   */
  async publishEvents(events: BaseEventData[]): Promise<{ success: number; failed: number }> {
    const results = {
      success: 0,
      failed: 0
    };

    for (const event of events) {
      const job = await this.publishToQueue('gacha-pull', event);
      if (job) {
        results.success++;
      } else {
        results.failed++;
      }
    }

    return results;
  }

  /**
   * 订阅所有事件
   */
  subscribeAllEventTypes(listener: (data: BaseEventData) => void): void {
    Object.values(Event).forEach(event => {
      this.on(event, listener);
    });

    console.log('📡 已订阅所有事件类型');
  }

  /**
   * 订阅特定事件类型
   */
  subscribeEventTypes(
    events: Event,
    listener: (data: BaseEventData) => void
  ): void {
    this.on(event, listener);
    console.log(`✅ 订阅事件: ${events.join(', ')}`);
  }

  /**
   * 批量订阅
   */
  subscribeAll(): void {
    const listener = (data: BaseEventData) => {
      console.log(`📡 收到事件: ${data.eventType}`, data);
    };

    console.log('📡 订阅所有事件...');

    this.subscribeAllEventTypes(listener);
  }

  /**
   * 轮发到消息队列的完整事件数据
   */
  async publishEventToQueue<T extends BaseEventData>(eventType: Event, data: T): Promise<Job<any> | null> {
    const wrappedData = {
      eventType: eventType,
      timestamp: new Date(),
      userId: data.userId || 'system',
      metadata: data.metadata || {},
      data: data
    };

    return this.publishToQueue('gacha-pull', wrappedData);
  }

  /**
   * 发布事件并立即执行（测试用途）
   */
  async emitAndExecute<T extends BaseEventData>(
    eventType: Event,
    data: T,
    handler: (data: T) => Promise<any>,
    retryOnFail: boolean = false
  ): Promise<any> {
    try {
      // 发布到 BullMQ
      const job = await this.publishEventToQueue(eventType, data);

      if (!job) {
        throw new Error('事件路由失败');
      })

      console.log(`✅ 已发布事件: ${eventType}`);
      console.log(`   Job ID: ${job.id}`);

      // 等待 Job 完成
      const result: Promise<any> = new Promise((resolve, reject) => {
        job.on('completed', (result) => {
          console.log('✅ Job 完成:', result);
          resolve(result);
        });

        job.on('failed', (error) => {
          if (retryOnFail) {
            console.log('⚠️  失败，重试中...');
            setTimeout(() => this.emitAndExecute(eventType, data, handler, false), 5000);
          } else {
            console.error('❌ 事件执行失败:', error);
            reject(error);
            resolve(false);
          }
        });
      });

      return await result;

    } catch (error: unknown) {
      console.error('❌ 事件执行失败:', error);
      return null;
    }
  }

  /**
   * 关闭 Event Bus
   */
  async close(): Promise<void> {
    this.removeAllListeners();
    this.emitter.removeAllListeners();
    console.log('🔌 Event Bus 已关闭');
  }

  /**
   * 测试事件总线
   */
  async testEventBus(): Promise<boolean> {
    console.log('\n' + '=' * 60);
    console.log('📡 Event Bus 测试');
    console.log('=' * 60 + '\n');

    const eventBus = new EventBus();
    
    let testPassed = true;

    try {
      // 1. 测试订阅和发布
      let eventReceived = false;

      eventBus.on(Event.ITEM_OBTAINED, (data) => {
        console.log(`   ✅ 收到消息: ${event.eventType}`);
        console.log(`   📨 参数: ${JSON.stringify(data).substring(0, 100)}...`);
        eventReceived = true;
      });

      const testData: ItemObtainedData = {
        timestamp: new Date(),
        userId: 'test-user-id',
        instanceId: 'test-instance-id',
        templateId: 'test-template-id',
        instance: { name: '测试装备' }
      };

      console.log('发布装备获得事件...');
      await eventBus.publishItemObtained(testData);

      // 等待事件处理
      await new Promise<void>(resolve => setTimeout(resolve, 1000));

      if (!eventReceived) {
        console.log('❌ 事件未收到');
        testPassed = false;
      }

      // 2. 测试多事件订阅
      let allEventsReceived = false;
      let receivedCount = 0;

      const allListener = (data: BaseEventData) => {
        receivedCount++;
      };

      eventBus.onItemEvent(allListener);

      console.log('发布多个事件测试 (3 个)...');
      await Promise.all([
          eventBus.publishItemObtained({
            ...testData,
            instanceId: 'test-1',
            userId: 'test-user-id'
          }),
          eventBus.publishItemUpdated({
            timestamp: new Date(),
            userId: 'test-user-id'
          }),
          eventBus.publishLevelUp({
            timestamp: new Date(),
            userId: 'test-user-id',
            characterId: 'character-1'
          })
      ]);

      await new Promise<void>(resolve => setTimeout(resolve, 1000));

      if (!allEventsReceived) {
        console.log('❌ 部分测试失败');
        testPassed = false;
      }

      console.log(`\n✅ 收到 ${receivedCount} 个事件`);

    } catch (error) {
      console.error('❌ Event Bus 测试失败:', error);
      return false;
    }

    await eventBus.close();

    console.log('\n' + '=' * 60);
    console.log('✅ Event Bus 测试完成');
    console.log('=' * 60 + '\n');

    return testPassed;
}
