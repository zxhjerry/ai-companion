/**
 * Types Definitions - Equipment & Gacha System
 * 严格区分 ItemTemplate (静态模板) 和 ItemInstance (玩家实例)
 * 支持 is_soulbound (绑定机制)
 */

// ===== 装备属性类型 =====

export interface EquipmentStats {
  strength?: number;      // 力量：影响伤害
  intelligence?: number;  // 智力：影响技能伤害
  charisma?: number;     // 魅力：影响社交增益
  defense?: number;       // 防御：减免伤害
  luck?: number;           // 幸运：触发隐藏事件
  critical_chance?: number;  // 暴击率 (% × 100)
  speed?: number;         // 速度：攻击速度
  magic_attack?: number;  // 法术攻击
  magic_defense?: number;  // 法术防御
  hp?: number;           // 生命值
  mp?: number;           // 魔力值
}

// ===== 装备类型枚举 =====

export enum EquipmentType {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  ACCESSORY = 'accessory',
  MATERIAL = 'material',
  SPECIAL = 'special',
}

export enum WeaponType {
  MAIN_HAND = 'main_hand',
  OFF_HAND = 'off_hand',
  TWO_HAND = 'two_hand',
  DUAL_WIELD = 'dual_wield'
}

export enum ArmorType {
  HELMET = 'helmet',
  CHEST = 'chest',
  GAUNTLETS = 'gauntlets',
  BOOTS = 'boots',
  SHIELD = 'shield'
}

export enum WeaponClass {
  SWORD = 'sword',
  BOW = 'bow',
  STAFF = 'staff',
  WAND = 'wand'
}

// ===== 稀有度等级定义 =====

export enum Rarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

export const RARITY_CONFIG = {
  [Rarity.COMMON]: {
    name: '普通',
    multiplier: 1.0,
    color: '#b2bec3',
    pullRate: 60     // 60% 抽中
  },
  [Rarity.UNCOMMON]: {
    name: '不普通',
    multiplier: 1.2,
    color: '#0984e3',
    pullRate: 75     // 75% 抽中概率
  },
  [Rarity.RARE]: {
    name: '稀有',
    multiplier: 1.5,
    color: '#a29bfe',
    pullRate: 85     // 85% 抽中概率
  },
  [Rarity.EPIC]: {
    name: '史诗',
    multiplier: 2.0,
    color: '#fd79a8',
    pullRate: 92     // 92% 抽中概率
  },
  [Rarity.LEGENDARY]: {
    name: '传説',
    multiplier: 3.0,
    color: '#ff7675',
    pullRate: 97     // 97% 抽中概率
  }
};

// ===== ItemTemplate（静态装备模板）=====

export interface ItemTemplate {
  // 基础信息
  id: string;                           // 模板唯一 ID
  name: string;                         // 装备名称
  description: string;                  // 装备描述
  icon: string;                          // 图标 URL（本地路径或 CDN）
  
  // 类型分类
  type: EquipmentType;                     // 装备类型
  weaponType?: WeaponType;                // 武器类型
  armorType?: ArmorType;                 // 防具类型（可选）
  weaponClass?: WeaponClass;              // 武器职业（可选）
  
  // 稀有度
  rarity: Rarity;
  tier: number;                          // 层数（装备阶级 1-100）
  
  // 稀有度权重计算
  pullWeight: number;                      // 基础权重（1-1000）
  basePullRate: number;                    // 基础掉率（0-100）
  eventOnly: boolean;                      // 是否仅隐藏事件掉落
  
  // 装备属性模板（基础值）
  stats: EquipmentStats;                  // 属性配置
  
  // 装备成长值（每升级一次的属性加成）
  growthStats?: EquipmentStats;             // 成长曲线
  maxLevel?: number;                       // 最大等级
  
  // 视觉元素
  appearanceConfig: {
    hair?: string;
    eyes?: string;
    style?: string;
  };

  // 背包显示
  inventorySize: number;                  // 背包占用格子（1-20）
  stackSize: number;                      // 可堆叠数量（99）
}

// ===== 装备实例（玩家实际获得）=====

export interface ItemInstance {
  // 实例 ID（唯一）
  instanceId: string;
  templateId: string;                      // 模板 ID 关联
  userId: string;
  
  // 装备信息
  name: string;
  description: string;
  icon: string;
  type: EquipmentType;
  weaponType?: WeaponType;
  armorType?: ArmorType;
  weaponClass?: WeaponClass;
  
  // 稀有度信息
  rarity: Rarity;
  tier: number;
  rarityMultiplier: number;              // 模板稀有度乘数
  
  // 绑定机制
  isSoulbound: boolean;                   // 是否绑定（不可交易）
  isPermanent: boolean;                   // 是否永久保存（无法删除）
  isEquipped: boolean;                   // 是否已装备
  
  // 当前属性（含成长加成）
  baseStats: EquipmentStats;
  additionalStats: EquipmentStats;        // 增强属性（强化石附魔效果等）
  
  // 成长系统
  level: number;                          // 当前等级 (1-100)
  exp: number;                             // 当前进度
  
  // 来源信息
  obtainedFrom: 'gacha' | 'quest' | 'shop' | 'admin';
  gachaBatch: string;                       // 抽卡批次 ID
  timestamp: string;                       // 获得时间
  obtainedAt: Date;
  
  // 交易相关
  tradeCount: number;                     // 交易次数
  tradeHistory: TradeRecord[];
}

// ===== 交易记录 =====

export interface TradeRecord {
  recordId: string;
  instanceId: string;
  fromUserId: string;
  toUserId: string;
  instanceName: string;
  tradePrice: number;
  currency: 'gold' | 'gems';
  timestamp: string;
  tradeType: 'sale' | 'exchange' | 'gift';
}

// ===== 抽卡池配置 =====

export interface GachaPool {
  poolId: string;                         // 抽卡池 ID
  poolName: string;                       // 抽卡池名称
  poolType: 'normal' | 'limited' | 'event'; // 普通池 / 限时池 /活动池
  
  // 权重配置
  templates: Array<{
    templateId: string;                 // 模板 ID
    pullWeight: number;                // 权重（影响掉落概率）
    gachaId: string;                   // 关联的抽卡系统 ID
  }>;
  
  // 抽卡概率配置
  pullCountPerPlay: number;              // 每次抽取次数（默认 10）
  costPerPull: number;                    // 每次抽取消耗
  currency: 'gold' | 'gems';
  
  // 时间限制（限时池）
  startTime?: Date;
  endTime?: Date;
}

// ===== 保底系统配置 =====

export interface PitySystemConfig {
  enabled: boolean;                      // 是否启用保底
  basePityRate: number;                   // 基础保底率（0-50%）
  pityIncrement: number;                   // 每次未达标后增加的保底率（5%）
  maxPityRate: number;                     // 最大保底率（默认 50%）
  guaranteeTierMin: number;                // 保底稀有度最低值（例如：RARE）
  guaranteeCount: number;                  保底触发连续次数（例如：70 次必出稀有或以上）
}

export interface PityStatus {
  currentPityRate: number;                # 当前保底概率（% × 100）
  consecutiveMisses: number;             # 当前连续未命中次数
  guaranteedRarity: Rarity;             # 当前保底稀有度
  lastTriggerTimestamp: string;       # 上次保底触发时间
}

// ===== 抽卡记录 =====

export interface GachaRecord {
  id: string;
  userId: string;
  poolId: string;
  poolName: string;
  
  // 抽卡结果
  templateId: string;
  instanceId?: string;
  
  // 稀有度结果
  pullRarity: Rarity;
  rarityBonus: boolean;                 // 是否触发事件加成
  pityTriggered: boolean;                // 是否保底触发的抽中
  
  // 概率计算
  pullRate: number;                       // 实际抽取概率
  rollValue: number;                        // 随机生成的原值
  adjustedValue: number;                    # 经过保底调整后的值
  
  // 触发事件
  hiddenEventTriggered?: {
    eventId: string;
    type: string;
    description: string;
    impact: string;
  };
  
  timestamp: string;
}

// ===== 抽卡请求 =====

export interface GachaRequest {
  poolId: string;
  userId: string;
  pullCount: number;                      // 抽取数量（默认 10 次）
  currency?: 'gold' | 'gems';
  usePity?: boolean;                      // 是否启用保底机制
  
  // 可选：指定模板池
  templateIds?: string[];                     // 指定模板 ID 列表
  
  // 可选：指定稀有度范围
  minRarity?: Rarity;
  maxRarity?: Rarity;
}

// ===== 抽卡响应 =====

export interface GachaResponse {
  pullResults: GachaResult[];
  pityStatus?: PityStatus;                // 保底状态更新
  
  // 消耗信息
  currency: 'gold' | 'gems';
  cost: number;
  pulledCount: number;
  totalCost: number;
  
  timestamp: string;
}

// ===== 抽卡结果 =====

export interface GachaResult {
  instanceId: string;                      // 实例 ID
  templateId: string;                      # 模板 ID
  name: string;
  rarity: Rarity;
  tier: number;
  rarityMultiplier: number;
  
  instance: ItemInstance;                    # 实例数据
  
  // 是否触发隐藏事件
  hiddenEventTriggered?: {
    eventId: string;
    type: string;
    description: string;
  };
  
  pityTriggered: boolean;
  isPityResult: boolean;
}

export { v4 as uuidv4 } from 'uuid';

// ===== 辅助：保底值映射到稀有度 =====

export const PITY_TIER_MAPPING: {
  50-59: Rarity.UNCOMMON,
  60-69: Rarity.RARE,
  70-79: Rarity.EPIC,
  80-100: Rarity.LEGENDARY
};

export function getPityRateForTier(pityRate: number): Rarity {
  // 将 50-100 的保底率映射到稀有度等级
  for (const [min, max, rarity] of Object.entries(PITY_TIER_MAPPING)) {
    if (pityRate >= min && pityRate <= max && rarity) {
      return rarity;
    }
  }
  return Rarity.UNCOMMON; // 默认：不普通
}

// ===== 前端 API 类型（用于响应过滤 luck 字段）

export interface FrontendGachaResponse {
  pullResults: {
    instanceId: string;
    templateId: string;
    name: string;
    rarity: string;
    tier: number;
    rarityMultiplier: number;

    instance: {
      instanceId: string;
      instance: name;
      name: string;
      rarity: string;
      tier: number;
      rarityMultiplier: number;
      baseStats: EquipmentStats;
      level: number;
      isSoulbound: boolean;
    };
    hiddenEventTriggered?: {
      eventId: string;
      type: string;
      description: string;
    };
  }[];
  pityStatus?: Omit<PityStatus, 'consecutiveMisses' | 'lastTriggerTimestamp'>;
  currency: 'gold' | 'gems';
  cost: number;
  pulledCount: number;
  timestamp: string;
}
