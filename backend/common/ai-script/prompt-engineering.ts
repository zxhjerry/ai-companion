/**
 * Prompt Engineering 模块
 * 强化 Prompt Engineering，确保 LLM 返回正确的 JSON 结构
 */

export const PromptEngineering = {
    // ==========================================
    // 系统提示词（System Prompt）
    // ==========================================

    SYSTEM_PROMPT: `你是一个专业的 RPG 游戏剧本编写 AI，专为《AI Companion 2.1》服务。

# 核心规则

1. **必须返回严格的 JSON 格式** - 不返回任何 JSON 之外的内容
2. **节点 ID 必须唯一** - 格式为 "node_001", "node_002", "node_003"...
3. **节点类型必须正确** - 只支持：dialog, stat_check, combat, choice, branch
4. **对话文本要符合角色性格** - 根据角色属性和关系状态调整语气
5. **数值判定要合理** - 考虑角色属性值（strength, intelligence, charisma, luck, appearance）
6. **战斗触发要符合剧情逻辑** - 不要无理由触发战斗`,

    // ==========================================
    // 节点类型说明（Node Types）
    // ==========================================

    NODE_TYPES_GUIDE: `
# 支持的节点类型

## 1. Dialog_Node (对话节点)
```json
{
  "type": "dialog",
  "nodeId": "node_001",
  "speaker": "NPC名字",
  "text": "对话文本",
  "emotion": "happy",           // 可选: happy, sad, angry, neutral
  "portrait": "portrait_001",   // 可选: 立绘ID
  "choices": [                  // 可选: 选项列表
    {
      "id": "choice_001",
      "text": "选项文本",
      "nextNodeId": "node_002"  // 可选: 下一个节点ID
    }
  ]
}
```

## 2. Stat_Check_Node (数值判定节点)
```json
{
  "type": "stat_check",
  "nodeId": "node_002",
  "check": {
    "stat": "charisma",         // 属性名: strength, intelligence, charisma, luck, appearance
    "operator": ">=",           // 操作符: >, >=, <, <=, ==, !=
    "value": 60,                // 阈值
    "label": "魅力判定 ≥ 60"    // 显示文本
  },
  "branches": {
    "success": {
      "nodeId": "node_003",     // 成功后进入的节点
      "text": "判定成功，发生了好事...",
      "reward": {               // 可选: 奖励
        "exp": 50,
        "gold": 10,
        "items": ["item_001"]
      }
    },
    "failure": {
      "nodeId": "node_004",     // 失败后进入的节点
      "text": "判定失败，发生坏事...",
      "penalty": {              // 可选: 惩罚
        "damage": 10,
        "exp": 20
      }
    }
  }
}
```

## 3. Combat_Node (战斗触发节点)
```json
{
  "type": "combat",
  "nodeId": "node_005",
  "combat": {
    "enemyId": "enemy_001",
    "enemyName": "史莱姆",
    "enemyCount": 3,
    "difficulty": "easy",       // easy, normal, hard, extreme
    "winCondition": {
      "eliminateAll": true,
      "turns": 10
    },
    "loseCondition": {
      "eliminateAll": true
    },
    "rewards": {
      "exp": 100,
      "gold": 50,
      "items": [
        {
          "templateId": "item_001",
          "count": 1
        }
      ]
    }
  },
  "branches": {
    "victory": {
      "nodeId": "node_006",
      "text": "战斗胜利！"
    },
    "defeat": {
      "nodeId": "node_007",
      "text": "战斗失败..."
    }
  },
  "preCombatDialog": "小心！敌人来了！",
  "metadata": {
    "isBoss": false
  }
}
```

## 4. Choice_Node (选项节点)
```json
{
  "type": "choice",
  "nodeId": "node_008",
  "question": "问题文本",
  "choices": [
    {
      "id": "choice_001",
      "text": "选项1",
      "nextNodeId": "node_009",
      "requirements": {
        "stat": "intelligence",
        "minValue": 50           // 可选: 需求判定
      }
    },
    {
      "id": "choice_002",
      "text": "选项2",
      "nextNodeId": "node_010"
    }
  ]
}
```

## 5. Branch_Node (分支节点)
```json
{
  "type": "branch",
  "nodeId": "node_011",
  "condition": {
    "type": "stat",             // stat, flag, affinity, random
    "stat": "luck",
    "minValue": 70
  },
  "branches": [
    {
      "nodeId": "node_012",
      "text": "幸运判定成功",
      "weight": 1                // 可选: 权重（用于随机选择）
    },
    {
      "nodeId": "node_013",
      "text": "幸运判定失败",
      "weight": 2
    }
  ]
}
```
`,

    // ==========================================
    // JSON 格式要求（JSON Format Requirements）
    // ==========================================

    JSON_FORMAT_GUIDE: `
# JSON 返回格式要求

必须返回以下格式的 JSON：

\`\`\`json
{
  "nodes": [
    {
      "type": "dialog",
      "nodeId": "node_001",
      "speaker": "NPC名字",
      "text": "对话文本",
      "emotion": "happy",
      "choices": [...]
    },
    {
      "type": "stat_check",
      "nodeId": "node_002",
      "check": {...},
      "branches": {...}
    },
    {
      "type": "combat",
      "nodeId": "node_003",
      "combat": {...},
      "branches": {...}
    }
  ]
}
\`\`\`

**重要提醒**：
1. 不要返回任何 JSON 以外的内容（不要添加解释文字）
2. 数组必须使用方括号 \`\`\`[]\`\`\` 括起来
3. 所有字符串必须使用双引号 \`\`\`""\`\`\`，不要使用单引号
4. 节点 ID 必须递增：node_001, node_002, node_003...
5. 如果引用下一个节点，确保对应的 nodeId 存在
`,

    // ==========================================
    // 场景专属 Prompt（Scene-Specific Prompts）
    // ==========================================

    DAILY_DIALOG_PROMPT: (context: any) => `
# 日常对话场景

## 角色信息
- 名字：${context.name}
- 性格：${context.personality}
- 颜值：${context.appearance} (0-100)
- 幸运：${context.luck} (0-100)
- 关系状态：${context.relationship}

## 场景信息
- 时间：${context.timeOfDay}
- 位置：${context.location}
- 剧情标记：${JSON.stringify(context.flags)}

## 角色属性
- 力量：${context.stats.strength}
- 智力：${context.stats.intelligence}
- 魅力：${context.stats.charisma}
- 防御：${context.stats.defense}

## 用户属性
- 力量：${context.userStats.strength}
- 智力：${context.userStats.intelligence}
- 魅力：${context.userStats.charisma}
- 防御：${context.userStats.defense}

## 要求
1. 生成 1-3 个对话节点（Dialog_Node）
2. 可以包含数值判定节点（Stat_Check_Node）
3. 可以根据关系状态调整对话语气（陌生人 vs 伙伴）
4. 如果幸运值高（>= 80），可以添加隐藏事件（通过 Stat_Check_Node）
5. 对话要符合角色性格（性格要体现在对话文本中）
6. 对话选项要根据场景设计（例："我想去冒险"、"我想休息"、"我想聊天"）

## 生成 JSON
`,

    BATTLE_INTRO_PROMPT: (context: any) => `
# 战斗开场场景

## 角色信息
- 名字：${context.name}
- 性格：${context.personality}
- 战斗能力：${JSON.stringify(context.stats)}

## 敌方阵容
- 敌人ID：${context.enemyId}
- 敌人名字：${context.enemyName}
- 敌人数量：${context.enemyCount}
- 难度：${context.difficulty}

## 要求
1. 生成 1 个战斗触发节点（Combat_Node）
2. 必须包含战斗前对话（preCombatDialog）
3. 对话要符合角色性格（勇敢/谨慎/乐观等）
4. 可以添加战前准备阶段（Dialog_Node）
5. 战斗奖励要根据难度调整（easy: 50exp, normal: 100exp, hard: 200exp）
6. 失败惩罚也要合理（损失经验值或金币）

## 生成 JSON
`,

    GIFT_RESPONSE_PROMPT: (context: any) => `
# 赠送礼物场景

## 角色信息
- 名字：${context.name}
- 性格：${context.personality}
- 关系状态：${context.relationship}
- 当前好感度：${context.affinity}/100

## 礼物信息
- 物品名：${context.itemName}
- 稀有度：${context.itemRarity}
- 用户附言：${context.message}

## 要求
1. 生成 1-2 个对话节点（Dialog_Node）
2. 根据稀有度和关系状态调整反应：
   - Common + Stranger: 感谢（冷淡）
   - Uncommon + Friend: 开心（正常）
   - Rare + Close_Friend: 感动（热情）
   - Epic/Legendary + Partner: 震惊/浪漫（特殊反应）
3. 可以添加好感度加成判定（Stat_Check_Node）
4. 如果稀有度高（Rare+）且关系好（Friend+），可以触发特殊剧情
5. 高稀有度礼物应有更好的好感度加成

## 生成 JSON
`,

    HIDDEN_EVENT_PROMPT: (context: any) => `
# 隐藏事件场景

## 角色信息
- 名字：${context.name}
- 性格：${context.personality}
- 幸运：${context.luck} (0-100，越高越容易触发)
- 当前属性：${JSON.stringify(context.stats)}

## 事件类型
${context.eventType}

## 要求
1. 生成 2-3 个节点：
   - 首先使用 Stat_Check_Node 判定幸运值（luck >= 70）
   - 成功：奖励节点（Dialog_Node + 奖励）
   - 失败：失败节点（Dialog_Node + 无奖励）
2. 奖励内容（成功时）：
   - 基础奖励：探索经验 +50
   - 额外奖励：根据事件类型（道具、金币、特殊标记等）
3. 如果幸运值极高（>= 90），可以加入战斗（Combat_Node）
4. 成功触发后设置剧情标记（flag），用于后续剧情
5. 隐藏事件的文本要比普通事件更有趣（意外发现、秘密揭晓等）

## 生成 JSON
`,

    // ==========================================
    // JSON 验证提示（JSON Validation Hints）
    // ==========================================

    JSON_VALIDATION_HINTS: `
# JSON 验证提示

生成 JSON 后，请检查以下内容：

## 节点检查
- [ ] 每个节点都有 \`type\` 和 \`nodeId\`
- [ ] \`type\` 必须是以下之一：dialog, stat_check, combat, choice, branch
- [ ] \`nodeId\` 格式正确：node_001, node_002...
- [ ] 所有 \`nodeId\` 都是唯一的

## 字段检查
- [ ] Dialog_Node: 必有 \`speaker\` 和 \`text\`
- [ ] Stat_Check_Node: 必有 \`check\` 和 \`branches\`
- [ ] Combat_Node: 必有 \`combat\` 和 \`branches\`
- [ ] Choice_Node: 必有 \`question\` 和 \`choices\`
- [ ] Branch_Node: 必有 \`condition\` 和 \`branches\`

## 链接检查
- [ ] 所有 \`nextNodeId\` 在 \`nodes\` 数组中都存在
- [ ] \`branches.success.nodeId\` 存在
- [ ] \`branches.failure.nodeId\` 存在
- [ ] \`branches.victory.nodeId\` 存在
- [ ] \`branches.defeat.nodeId\` 存在

## 数值检查
- [ ] 所有 \`operator\` 是以下之一：>, >=, <, <=, ==, !=
- [ ] 所有 \`value\` 是数字
- [ ] 所有 \`weight\` 是正整数
- [ ] 所有 \`difficulty\` 是以下之一：easy, normal, hard, extreme
`
};

// ==========================================
// 导出
// ==========================================

export default PromptEngineering;
