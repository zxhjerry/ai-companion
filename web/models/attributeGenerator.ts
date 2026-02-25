/**
 * 角色属性生成器
 * 用于 22.1 增强架构：根据外观和幸运生成五维初始值
 */

import { CharacterStats, CharacterCreationConfig } from './types';

/**
 * 内部工具：随机数生成器（0-10）
 */
function generateRandomBoost(): number {
  return Math.random() * 10;
}

/**
 * 内部工具：数值范围限制（Clamp 到 [0, 100]）
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, parseFloat(value.toFixed(0))));
}

/**
 * 角色倍率系数定义（M_role）
 */
export const ROLE_MULTIPLIERS = {
  DEFAULT: 1.0,
  WARRIOR: 1.2,      // 战士：力量加成
  MAGE: 1.1,        // 法师：智力加成
  ROGUE: 1.3,       // 盗贼：敏捷加成
  PALADIN: 1.1,      // 圣骑士：魅力加成
  BARD: 1.0,         // 吟游师: 灵巧加成（无额外加成）
  NINJA: 1.2,        // 忍者：幸运加成
  DRUID: 1.15,       // 德鲁伊：平衡加成
  SORCERER: 1.25     // 术士：幸运加成（高幸运）
};

export type RoleType = keyof typeof ROLE_MULTIPLIERS;

/**
 * 默认基础值配置
 */
export const DEFAULT_BASE_STATS: CharacterStats = {
  strength: 50,
  intelligence: 50,
  charisma: 50,
  appearance: 50,
  luck: 50
};

/**
 * AttributeGenerator 类
 *
 * 功能：
 * 1. 生成随机幸运值 (1-100)
 * 2. 生成随机颜值 (1-100)
 * 3. 应用数值生成公式
 * 4. Clamp 到 [0, 100]
 * 5. 交叉验证结果
 */
export class AttributeGenerator {
  /**
   * 生成角色的幸运值 (LCK)
   * 范围: 1-100
   */
  generateLuck(): number {
    const luck = Math.floor(Math.random() * 100) + 1;
    console.log(`✅ 生成幸运值 (LCK): ${luck}`);
    return luck;
  }

  /**
   * 生成角色的颜值 (APP)
   * 范围: 1-100
   */
  generateAppearance(): number {
    const appearance = Math.floor(Math.random() * 100) + 1;
    console.log(`✅ 生成颜值 (APP): ${appearance}`);
    return appearance;
  }

  /**
   * 生成全角色属性（包含幸运和颜值）
   */
  GenerateFullAttributes(): {
    appearance: number;
    luck: number;
  } {
    return {
      appearance: this.generateAppearance(),
      luck: this.generateLuck()
    };
  }

  /**
   * 生成单个属性值
   *
   * @param base - 基础值
   * @param luck - 幸运值 (LCK)
   * @param appearance - 颜值 (APP)
   * @param multiplier - 角色倍率系数
   * @returns 最终属性值 (0-100)
   */
  generateStat(
    base: number,
    luck: number,
    appearance: number,
    multiplier: number = 1.0
  ): number {
    // 步骤 1: 计算 [0, 10] 的随机数
    // 步骤 2: 应用幸运值影响：幸运值越高，随机数增益区间越大
    const randomBoost = generateRandomBoost() * (luck / 50);
    
    // 幸运值越高，欧皇角色（高 LCK）有更大的数值波动优势
    const luckyBonus = randomBoost * (1 + (luck > 80 ? 0.5 : 0));
    
    // 步骤 3: 应用角色倍率
    // 步骤 4: 应用颜值修正（微小保底偏移）
    // 颜值会给予最终数值一个微小保底偏移，确保高颜值角色在初始属性上具备天然优势
    const appearanceBonus = appearance / 20;
    
    // 步骤 5: 计算最终数值
    const final = base + luckyBonus * multiplier + appearanceBonus;
    
    // 步骤 6: Clamp 到 [0, 100] 范围
    const clamped = clamp(final);
    
    console.log(`📊 Stat 计算:`);
    console.log(`   基础: ${base}, 幸运: ${luck}, 颜值: ${appearance}, 系数: ${multiplier}`);
    console.log(`   随机加成: ${luckyBonus.toFixed(2)}, 颜值修正: ${(appearanceBonus).toFixed(2)}`);
    console.log(`   最终: ${final.toFixed(2)}, Clamp: ${clamped}`);
    
    return clamped;
  }

  /**
   * 生成五维初始值
   *
   * @param baseStats - 基础值配置
   * @param luck - 幸运值 (LCK)
   * @param appearance - 颜值 (APP)
   * @param multiplier - 角色倍率系数
   * @returns 五维初始值
   */
  generateStats(
    baseStats: Partial<CharacterStats> = {},
    luck: number | 'random',
    appearance: number | 'random',
    multiplier: number | 'random' | string = 'DEFAULT'
  ): CharacterStats {
    // 参数解析
    const resolvedLuck: number = luck === 'random' ? this.generateLuck() : luck as number;
    const resolvedAppearance: number = appearance === 'random' ? this.generateAppearance() : appearance as number;
    
    // 解析角色倍率
    let resolvedMultiplier: number;
    if (typeof multiplier === 'string' && multiplier in ROLE_MULTIPLIERS) {
      resolvedMultiplier = ROLE_MULTIPLIPLIER[multiplier];
      console.log(`✅ 使用预定义角色倍率: ${multiplier} (${resolvedMultiplier})`);
    } else if (multiplier === 'random') {
      // 随机选择角色倍率
      const roles = Object.keys(ROLE_MULTIPLIERS);
      const randomRole = roles[Math.floor(Math.random() * roles.length)];
      resolvedMultiplier = ROLE_MULTIPLIERS[randomRole as RoleType];
      console.log(`✅ 随机角色倍率: ${randomRole} (${resolvedMultiplier})`);
    } else {
      resolvedMultiplier = typeof multiplier === 'number' ? multiplier : ROLE_MULTIPLIERS.DEFAULT;
      console.log(`✅ 使用默认倍率: ${resolvedMultiplier}`);
    }

    const stats: CharacterStats = {
      strength: 0,
      intelligence: 0,
      charisma: 0,
      appearance: 0,
      luck: resolvedLuck
    };

    // 生成五个维度的初始值
    stats.strength = this.generateStat(
      baseStats.strength || DEFAULT_BASE_STATS.strength,
      resolvedLuck,
      resolvedAppearance,
      resolvedMultiplier
    );
    
    stats.intelligence = this.generateStat(
      baseStats.intelligence || DEFAULT_BASE_STATS.intelligence,
      resolvedLuck,
      resolvedAppearance,
      resolvedMultiplier
    );
    
    stats.charisma = this.generateStat(
      baseStats.charisma || DEFAULT_BASE_STATS.charisma,
      resolvedLuck,
      resolvedAppearance,
      resolvedMultiplier
    );
    
    stats.appearance = resolvedAppearance;
    
    // luck 在创建时已设定，不需要计算，直接使用传入或随机值
    
    console.log('\n✅ 五维初始值生成完成:');
    this.printStats(stats);
    
    // 交叉验证
    this.validateStats(stats);
    
    return stats;
  }

  /**
   * 创建角色
   *
   * @param roleType - 角色类型（可选）
   * @returns 完整角色配置（包含属性和五维初始值）
   */
  createCharacter(
    roleType: RoleType | 'random' = 'random'
  ): CharacterCreationConfig {
    console.log(`\n🎨 创建角色: ${roleType}\n`);

    const { appearance, luck } = this.GenerateFullAttributes();

    const stats = this.generateStats(
      {}, // 使用默认基础值
      luck,
      appearance,
      roleType
    );

    return {
      multiplier: roleType === 'random' ? ROLE_MULTIPLIERS.DEFAULT : ROLE_MULTIPLIERS[roleType],
      baseStats: stats
    };
  }

  /**
   * 交叉验证：检查所有数值是否在有效范围内 [0, 100]
   *
   * @param stats - 待验证的五维数值
   * @throws Error 如果验证失败
   */
  validateStats(stats: CharacterStats): boolean {
    const checks = {
      strength: true,
      intelligence: true,
      charisma: true,
      appearance: true,
      luck: true
    };

    const errors: string[] = [];

    if (stats.strength < 0 || stats.strength > 100) {
      errors.push(`Strength ${stats.strength} 超出范围 [0, 100]`);
      checks.strength = false;
    }
    if (stats.intelligence < 0 || stats.intelligence > 100) {
      errors.push(`Intelligence ${stats.intelligence} 超出范围 [0, 100]`);
      checks.intelligence = false;
    }
    if (stats.charisma < 0 || stats.charisma > 100) {
      errors.push(`Charisma ${stats.charisma} 超出范围 [0, 100]`);
      checks.charisma = false;
    }
    if (stats.appearance < 0 || stats.appearance > 100) {
      errors.push(`Appearance ${stats.appearance} 超范围 [0, 100]`);
      checks.appearance = false;
    }
    if (stats.luck < 0 || stats.luck > 100) {
      errors.push(`Luck ${stats.luck} 超范围 [0, 100]`);
      checks.luck = false;
    }

    if (errors.length > 0) {
      console.error('\n❌ 验证失败:');
      errors.forEach(err => console.error(`   - ${err}`));
      return false;
    }

    console.log('\n✅ 交叉验证通过：所有数值均在有效范围 [0, 100]');
    return true;
  }

  /**
   * 打印五维数值
   */
  private printStats(stats: CharacterStats): void {
    console.log('┌────────────────────────────────────┐');
    console.log('│ 五维数值 (五维初始值)         │');
    console.log('├────────────────────────────────────┤');
    console.log(`│ 力量: ${stats.strength.toString().padStart(4)}  │`);
    console.log(`│ 智力: ${stats.intelligence.toString().padStart(4)}  │`);
    console.log(`| 魅力: ${stats.charisma.toString().padStart(4)}  │`);
    console.log(`│ 颜值: ${stats.appearance.toString().padStart(4)}  │`);
    console.log(`│ 幸运: ${stats.luck.toString().padStart(4)}   │`);
    console.log('└────────────────────────────────────┘');
    console.log(`│ 总和: ${(stats.strength + stats.intelligence + stats.charisma + stats.appearance).toString().padStart(4)}  │`);
  }

  /**
   * 快速生成：仅生成外观和幸运
   */
  quickGenerate(): {
    const { appearance, luck } = this.GenerateFullAttributes();
    
    console.log('\n🚀 快速生成完成');
    console.table([
      { 特性: '外观 (APP)', 值: appearance + '/100', 类型: '显示' },
      { 特性: '幸运 (LCK)', 值: luck + '/100', 类型: '隐藏' }
    ]);
    
    return { appearance, luck };
  }

  /**
   * 导出为 JSON
   */
  exportJSON(): string {
    const config = this.createCharacter('random');
    return JSON.stringify(config, null, 2);
  }

  /**
   * 从 JSON 导入配置
   */
  static fromJSON(json: string): AttributeGenerator {
    const config = JSON.parse(json) as CharacterCreationConfig;
    const generator = new AttributeGenerator();
    const stats = generator.generateStats(
      config.baseStats,
      config.multiplier === undefined ? ROLE_MULTIPLIERS.DEFAULT : config.multiplier,
      undefined,
      undefined
    );
    
    // 更新 baseStats 的 appearance 字段为实际生成的值
    config.baseStats.appearance = stats.appearance;
    config.baseStats.luck = stats.luck;
    
    console.log('\n✅ 从 JSON 导入角色配置完成');
    generator.printStats(config.baseStats);
    
    return generator;
  }
}

// ===== 默认导出 =====
export default AttributeGenerator;
