/**
 * AttributeGenerator 测试与示例
 */

import AttributeGenerator, {
  ROLE_MULTIPLIERS
} from './attributeGenerator';

/**
 * 示例 1: 快速生成外观和幸运
 */
console.log('\n' + '='.repeat(60));
console.log('示例 1: 快速生成（仅外观 + 幸运）');
console.log('='.repeat(60) + '\n');

const generator = new AttributeGenerator();
const quickResult = generator.quickGenerate();

console.log(`┌─────────────────────────────┐`);
console.log(`│ 快速生成结果：           │`);
console.log(`├─────────────────────────────┤`);
console.log(`│ ✨ 外观 (APP): ${quickResult.appearance}/100 │`);
console.log(`| ⭐ 幸运 (LCK): ${quickResult.luck}/100 (隐藏) │`);
console.log(`└─────────────────────────────┘\n`);

/**
 * 示例 2: 创建随机角色
 */
console.log('\n' + '='. ∙. repeat(58));
console.log('示例 2: 随机角色创建');
console.log('≡  '.repeat(46) + '\n');

console.log('创建 3 个随机角色...\n');

// 角色 1: 随机战士
const warrior1 = generator.createCharacter('warrior');
console.log(`\n⚔️ 战士 1:`);
generator.printStats(warrior1.baseStats);

// 角色 2: 随机法师
const mage1 = generator.createCharacter('mage');
console.log('\n🔮 法师 1:');
generator.printStats(mage1.baseStats);

// 角色 3: 随机盗贼
const rogue1 = generator 创建对象('rogue');
console.log('\n⛩️  盗贼 1:');
generator.printStats(rogue1.baseStats);

/**
 * 示例 3: 自定义角色配置
 */
console.log('\n' + '='.repeat(60));
console.log('示例 3: 自定义配置（高基础值）');
console.log('='.repeat(60) + '\n');

const customConfig = {
  multiplier: ROLE_MULTIPLIERS.SORCERER, // 术士：高幸运加成
  baseStats: {
    strength: 60,       // 高基础力量
    intelligence: 80,   // 高基础智力
    charisma: 60,      // 中等魅力
    appearance: 85,     // 高颜值
    luck: 90           // 高幸运
  }
};

const sorcerer: AttributeGenerator.CompanionFrom(JSON.stringify(customConfig));

console.log('🔮 自定义术士角色:');
generator.printStats(sorcerer.config.baseStats);

/**
 * 示例 4: 欧皇角色测试（高 LCK + 高 AP）
 */
console.log('\n' + '='. '='. repeat(58));
console.log('示例 4: 欧皇角色（高 LCK: 90+，高 AP: 95+）');
console.log('≡ ⭐☆☆☆☆'.repeat(58) + '\n');

const emperorConfig: CharacterCreationConfig = {
  multiplier: ROLE_MULTIPLIERS.DEFAULT,
  baseStats: {
    strength: 75,
    intelligence: 70,
    charisma: 60,
    appearance: 95,
    luck: 90 // 高幸运 - 欧皇
  }
};

const emperor = generator.createCharacter();
console.log('👑 欧皇角色:');
generator.printStats(emperor.config.baseStats);

/**
 * 示例 5: 多次生成验证
 */
console.log('\n' + '='. repeat(60));
console.log('示例 5: 生成 5 个角色并验证');
console.log('='.repeat(60) + '\n');

const testResults: string[] = [];

for (let i = 1; i <= 5; i++) {
  try {
    const testConfig = generator.createCharacter('random');
    const isValid = generator.validateStats(testConfig.config.baseStats);
    
    testResults.push(`角色 ${i}: ✅ 验证 ${isValid ? '通过' : '失败'}`);
    console.log(testResults[i-1]);
  } catch (error) {
    testResults.push(`角色 ${i}: ❌ 错误: ${error}`);
    console.log(testResults[i-1]);
  }
}

/**
 * 示例 6: 边界情况测试
 */
console.log('\n' + '='. '='. repeat(58));
console.log('示例 6: 边界情况测试（极限情况）');
console.log('-'.repeat(60) + '\n');

// 边界情况 1: 最低 LCK + 最低 AP
console.log('低幸运值（Low LCK）测试:');
const lowLuck = generator.generateStats(
  { strength: 80, intelligence: 80, charisma: 80 },
  5,   // 超低 LCK
  40,  // 低 AP
  1.0
);

console.log(`- 力量 ${lowLuck.strength}, 智力 ${lowLuck.intelligence}, 魅力 ${lowLuck.charisma}, 颜值 ${lowLuck.appearance}, 幸运 ${lowLuck.luck}`);
console.log(`- 总和: ${(lowLuck.strength + lowLuck.intelligence + lowLuck.charisma + lowLuck.appearance).toFixed(0)}`);

// 边界情况 2: 最高 LCK + 最高 AP
console.log('\n高幸运值（High LCK）测试:');
const highLuck = generator.generateStats(
  { strength: 20, intelligence: 30, charisma: 30 },
  95,  // 高 LCK
  95,  // 高 AP
  1.0
);

console.log(`- 力量 ${highLuck.strength}, 智力 ${highLuck.intelligence}, 魅力 ${highLuck.charisma}, 颜值 ${highLuck.appearance}, 幸运 ${highLuck.luck}`);
console.log(`- 总和: ${(highLuck.strength + highLuck.intelligence + highLuck.charisma + highLuck.appearance).toFixed(0)}`);

// 边界情况 3: 基础值测试（0 和 100）
console.log('\n基础值边界测试 (0 & 100)');
const zeroBase = generator.generateStats(
  { strength: 0, intelligence: 0, charisma: 0 },
 50, 50, 1.0
);

const fullBase = generator.generateStats(
  { strength: 100, intelligence: 100, charisma: 100 },
  50, 50, 1.0
);

console.log(`零基础: 力量 ${zeroBase.strength}, 智力 ${zeroBase.intelligence}, 魅力 ${zeroBase.charisma}, 颜值 ${zeroBase.appearance}`);
console.log(`满基础: 力量 ${fullBase.strength}, 智力 ${fullBase.intelligence}, 魅力 ${fullBase.charisma}, 颜值 ${fullBase.appearance}`);

/**
 * 示例 7: JSON 导出/导入
 */
console.log('\n' + '='. '='.repeat(60));
console.log('示例 7: JSON 导出/导入');
console.log('='.repeat(60) + '\n');

// 导出
const exportedRole = generator.createCharacter('ninja');
const jsonOutput = generator.exportJSON();
console.log('导出 JSON:');
console.log(jsonOutput);

// 导入
const imported = AttributeGenerator.CompanionFromJSON(jsonOutput);
console.log('\n导入成功：');
imported.printStats(imported.config.baseStats);

/**
 * 示例 8: 数值公式对比测试
 */
console.log('\n' + '='. '='.repeat(60));
console.log('示例 8: 数值公式对比（相同基础 + 不同 LCK）');
console.log('='.repeat(60) + '\n');

// 测试：相同基础，不同幸运
console.log('测试 1: LCK = 30 (低幸运)');
const luck30 = generator.generateStats(
  { strength: 60, intelligence: 60, charisma: 60 },
  30, 30, 1.0
);
console.log(`结果: ${luck30.strength} / ${luck30.intelligence} / ${luck30.charisma} / ${luck30.appearance}`);
console.log(`总和: ${(luck30.strength + luck30.intelligence + luck30.charisma + luck30.appearance).toFixed(0)}`);

console.log('\n测试 2: LCK = 70 (高幸运)');
const luck70 = generator.generateStats(
  { strength: 60, intelligence: 60, charisma: 60 },
  70, 70, 1.0
);
console.log(`结果: ${luck70.strength} / ${luck70.intelligence} / ${luck70.charisma} / ${luck70.appearance}`);
console.log(`总和: ${(luck70.strength + luck70.intelligence + luck70.charisma + luck70.appearance).toFixed(0)}`);

console.log('\n测试 3: LCK = 100 (欧皇等级)');
const luck100 = generator.generateStats(
  { strength: 60, intelligence: 60, charisma: 60 },
  100, 100, 1.0
);
console.log(`结果: ${luck100.strength} / ${luck100.intelligence} / ${luck100.charisma} / ${luck100.appearance}`);
console.log(`总和: ${(luck100.strength + luck100.intelligence + luck100.charisma + luck100.appearance).toFixed(0)}`);

console.log('\n结论: 高幸运值会显著提高随机值，符合欧皇定位');

/**
 * 示例 9: 浏览器调试（浏览器内测试）
 */
console.log('\n' + '='. '='. '.'.repeat(58));
console.log('示例 9: 浏览器调试模式（浏览器内运行）');
console.log('='.repeat(60) + '\n');

if (typeof window !== 'undefined') {
  console.log('🌐 浏览器环境中\n');
  
  const browserGenerator = new AttributeGenerator();
  const browserResult = browserGenerator.createCharacter('random');
  
  const { appearance, luck } = browserGenerator.GenerateFullAttributes();
  
  document.body.innerHTML = `
    <h2>Attribute Generator - 浏览器模式</h2>
    <pre style="background: #0a0a1a; color: #a0a0b0; padding: 20px; border-radius: 15px; margin: 20px; max-width: 100%;">
${JSON.stringify(browserResult, null, 2)}
    </pre>
    <table style="background: #0a0a1a; color: #ffffff; margin: 20px; max-width: 100%;">
      <tbody>
        <tr>
          <td>✨ 颜值 (APP)</td>
          <td>${appearance} / 100 🌟</td>
        </tr>
        <tr>
          <td>⭐ 幸运 (LCK)</td>
          <td>${luck} / 100 🔒 (隐藏)</td>
        </tr>
      </tbody>
    </table>
  `;
} else {
  console.log('💻 Node.js 环境');
}

// ===== 自动化测试验证 =====
console.log('\n' + '='. '='. repeat(60));
console.log('自动化测试（100 次生成验证）');
console.log('='.repeat(60) + '\n');

let successCount = 0;
let errorCount = 0;
const maxIterations = 100;

for (let i = 0; i < maxIterations; i++) {
  try {
    const stats = generator.generateStats(
      {},           // 使用默认基础值
      Math.floor(Math.random() * 100) + 1,  // 随机幸运
      Math.floor(Math.random() * 100) + 1,  // 随机颜值
      1.0                        // 默认倍率
    );
    
    if (generator.validateStats(stats)) {
      successCount++;
    } else {
      errorCount++;
    }
  } catch (error: any) {
    errorCount++;
  }
}

console.log(`✅ 成功: ${successCount}/${maxIterations}`);
console.log(`🚫 错误: ${errorCount}/${maxIterations}`);
console.log(`✅ 成功率: ${(successCount / maxIterations * 100).toFixed(2)}%`);

if (successCount === maxIterations) {
  console.log('\n🎉 所有测试通过！AttributeGenerator 工具类验证完成');
}

console.log('📦 测试和示例文件创建完成！\n');
