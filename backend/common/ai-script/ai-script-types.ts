/**
 * AI Script Generation - AI 剧本生成模块
 * 类型定义
 */

// ==========================================
// 任务类型定义
// ==========================================

export interface AIScriptGenerationTask {
    taskId: string;
    userId: string;
    companionId: string;

    // 剧本上下文
    scenarioType: 'daily_dialog' | 'battle_intro' | 'battle_outro' | 'gift_response' | 'hidden_event' | 'special_scene';
    sceneId?: string;

    // 角色信息
    character: {
        name: string;
        gender: string;
        personality: string;      // 性格
        appearance: number;       // 颜值 (APP)
        luck: number;             // 幸运 (LCK)
        relationship: string;     // 关系状态
        currentStats: {
            strength: number;
            intelligence: number;
            charisma: number;
            defense: number;
        };
    };

    // 用户信息
    user: {
        name?: string;
        stats: {
            strength: number;
            intelligence: number;
            charisma: number;
            defense: number;
        };
    };

    // 剧情上下文
    context: {
        previousNodes?: string[];  // 之前的节点ID
        previousChoices?: number[]; // 之前的选择
        flags: Record<string, boolean>; // 剧情标记
        currentLocation?: string;  // 当前位置
        timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    };

    // 配置
    options: {
        includeDialog: boolean;     // 是否包含对话
        includeStatCheck: boolean;  // 是否包含数值判定
        includeCombat: boolean;     // 是否包含战斗触发
        maxNodes: number;           // 最大节点数
        language: 'zh-CN' | 'en-US';
    };

    // 创建时间
    createdAt: Date;
}

// ==========================================
// 任务结果类型定义
// ==========================================

export interface AIScriptGenerationResult {
    taskId: string;
    userId: string;
    companionId: string;
    success: boolean;

    // 生成的剧本节点
    nodes: ScriptNode[];

    // 元数据
    metadata: {
        model: string;           // 使用的模型
        tokensUsed: number;      // 使用的token数
        latency: number;         // 延迟（秒）
        generationTime: Date;
    };

    // 错误信息（如果失败）
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

// ==========================================
// 剧本节点类型
// ==========================================

export type ScriptNode =
    | DialogNode
    | StatCheckNode
    | CombatNode
    | ChoiceNode
    | BranchNode;

/**
 * 对话节点
 */
export interface DialogNode {
    type: 'dialog';
    nodeId: string;

    // 对话内容
    speaker: string;             // 说话者（NPC名字）
    text: string;                // 对话文本
    emotion?: string;            // 情绪（happy, sad, angry, neutral）
    portrait?: string;           // 立绘ID

    // 后续选项
    choices?: Array<{
        id: string;
        text: string;
        nextNodeId?: string;      // 下一个节点ID（可选）
        requirements?: {
            stat?: string;         // 属性要求（strength, intelligence等）
            minValue?: number;     // 最小值
            flag?: string;         // 剧情标记要求
            value?: boolean;       // 标记值
        };
    }>;

    // 节点元数据
    metadata?: {
        hint?: string;            // 提示文本
        background?: string;      // 背景图
        sound?: string;           // 背景音乐
    };
}

/**
 * 数值判定节点
 */
export interface StatCheckNode {
    type: 'stat_check';
    nodeId: string;

    // 判定规则
    check: {
        stat: string;             // 属性名（strength, intelligence, charisma, luck, appearance）
        operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
        value: number;            // 阈值
        label: string;            // 显示文本（例："力量判定 ≥ 60"）
    };

    // 判定结果分支
    branches: {
        success: {
            nodeId: string;       // 成功时进入的节点
            text: string;         // 描述文本
            reward?: {
                exp?: number;
                gold?: number;
                items?: string[];
            };
        };
        failure: {
            nodeId: string;       // 失败时进入的节点
            text: string;         // 描述文本
            penalty?: {
                damage?: number;
                exp?: number;
            };
        };
    };

    // 节点元数据
    metadata?: {
        hint?: string;
        isHidden?: boolean;       // 是否隐藏判定过程
    };
}

/**
 * 战斗触发节点
 */
export interface CombatNode {
    type: 'combat';
    nodeId: string;

    // 战斗配置
    combat: {
        enemyId: string;          // 敌方阵容ID
        enemyName: string;
        enemyCount: number;       // 敌人数量
        difficulty: 'easy' | 'normal' | 'hard' | 'extreme';

        // 胜利条件
        winCondition: {
            turns?: number;       // 回合限制
            eliminateAll?: boolean; // 全灭敌人
        };

        // 失败条件
        loseCondition: {
            turns?: number;       // 回合限制
            eliminateAll?: boolean; // 我方全灭
        };

        // 胜利奖励
        rewards: {
            exp: number;
            gold: number;
            items?: Array<{
                templateId: string;
                count: number;
            }>;
        };

        // 失败惩罚
        penalties?: {
            exp?: number;
            gold?: number;
        };
    };

    // 战斗结果分支
    branches: {
        victory: {
            nodeId: string;       // 胜利后进入的节点
            text: string;         // 描述文本
        };
        defeat: {
            nodeId: string;       // 失败后进入的节点
            text: string;         // 描述文本
        };
    };

    // 战斗前对话（可选）
    preCombatDialog?: string;

    // 节点元数据
    metadata?: {
        backgroundImage?: string; // 战斗背景
        battleMusic?: string;     // 战斗音乐
        isBoss?: boolean;         // 是否Boss战
    };
}

/**
 * 选项节点（用户选择）
 */
export interface ChoiceNode {
    type: 'choice';
    nodeId: string;

    // 问题文本
    question: string;

    // 选项列表
    choices: Array<{
        id: string;
        text: string;
        nextNodeId: string;
        requirements?: {
            stat?: string;
            minValue?: number;
            flag?: string;
            value?: boolean;
        };
    }>;
}

/**
 * 分支节点（条件分支）
 */
export interface BranchNode {
    type: 'branch';
    nodeId: string;

    // 分支条件
    condition: {
        type: 'stat' | 'flag' | 'affinity' | 'random';
        stat?: string;
        minValue?: number;
        flag?: string;
        flagValue?: boolean;
        affinity?: number;        // 好感度阈值
        probability?: number;     // 随机概率（0-1）
    };

    // 分支结果
    branches: Array<{
        nodeId: string;
        text?: string;           // 描述文本
        weight?: number;         // 权重（用于随机选择）
    }>;
}

// ==========================================
// Prompt 模板定义
// ==========================================

export const PROMPT_TEMPLATES = {
    // 系统提示词（基础）
    SYSTEM_BASE: `你是一个专业的 RPG 游戏剧本编写 AI，专为《AI Companion 2.1》服务。

规则：
1. 必须返回严格的 JSON 格式
2. 不能返回任何 JSON 之外的内容
3. 必须包含完整的节点结构
4. 节点ID必须唯一，格式为"node_001", "node_002"...
5. 对话文本要符合角色性格和当前关系状态
6. 数值判定要合理，考虑角色属性值
7. 战斗触发要符合剧情逻辑`,

    // 系统提示词（节点类型说明）
    SYSTEM_NODES: `
支持的节点类型：

1. Dialog_Node (对话节点)
   - type: "dialog"
   - speaker: 说话者名字
   - text: 对话文本
   - emotion: 情绪（happy, sad, angry, neutral）
   - choices: 选项列表（可选）

2. Stat_Check_Node (数值判定节点)
   - type: "stat_check"
   - check: 判定规则（属性、操作符、阈值）
   - branches:成功/失败分支

3. Combat_Node (战斗触发节点)
   - type: "combat"
   - combat: 战斗配置（敌方、难度、奖励）
   - branches: 胜利/失败分支

4. Choice_Node (选项节点)
   - type: "choice"
   - question: 问题文本
   - choices: 选项列表（必须包含）

5. Branch_Node (分支节点)
   - type: "branch"
   - condition: 分支条件
   - branches: 分支结果列表`,

    // 对话场景 Prompt
    DAILY_DIALOG: `根据以下信息生成日常对话剧本：

角色信息：
- 名字：{name}
- 性别：{gender}
- 性格：{personality}
- 颜值：{appearance} (0-100, 越高越迷人)
- 幸运：{luck} (0-100, 越高事件越多)
- 关系状态：{relationship}

用户信息：
- 属性：{userStats}

当前场景：
- 时间：{timeOfDay}
- 位置：{currentLocation}

要求：
1. 生成1-3个对话节点
2. 可以包含数值判定（基于角色属性）
3. 根据关系调整对话语气
4. 可以隐藏事件（如果幸运值高）`,

    // 战斗场景 Prompt
    BATTLE_INTRO: `根据以下信息生成战斗开场剧本：

角色信息：
- 名字：{name}
- 性格：{personality}
- 颜值：{appearance}
- 幸运：{luck}
- 战斗能力：{stats}

敌方阵容：
- 敌人ID：{enemyId}
- 敌人数量：{enemyCount}
- 难度：{difficulty}

要求：
1. 生成1个战斗触发节点（Combat_Node）
2. 包含战斗前对话
3. 可以加入数值判定（影响战斗难度）
4. 根据角色性格调整台词`,

    // 赠送礼物场景 Prompt
    GIFT_RESPONSE: `根据以下信息生成赠送礼物响应剧本：

角色信息：
- 名字：{name}
- 性格：{personality}
- 关系状态：{relationship}
- 当前好感度：{affinity}/100

礼物信息：
- 物品名：{itemName}
- 稀有度：{itemRarity}
- 用户附言：{message}

要求：
1. 生成1-2个对话节点
2. 根据稀有度和关系调整反应
3. 高稀有度+高关系 → 可能有特殊剧情
4. 可以包含好感度加成判定`,

    // 隐藏事件场景 Prompt
    HIDDEN_EVENT: `根据以下信息生成隐藏事件剧本：

角色信息：
- 名字：{name}
- 性格：{personality}
- 幸运：{luck} (高幸运更容易触发)
- 当前属性：{stats}

场景类型：{eventType}

要求：
1. 生成1-3个节点
2. 必须有数值判定（幸运值）
3. 可以包含战斗或特殊奖励
4. 高幸运值 → 获得更好奖励
5. 成功触发后设置剧情标记`
};

// ==========================================
// JSON Schema 验证
// ==========================================

export const SCRIPT_NODE_SCHEMA = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: ['dialog', 'stat_check', 'combat', 'choice', 'branch']
        },
        nodeId: { type: 'string' }
    },
    required: ['type', 'nodeId']
};

// ==========================================
// 错误类型定义
// ==========================================

export class AIScriptError extends Error {
    constructor(
        public code: string,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'AIScriptError';
    }
}

export const ERROR_CODES = {
    INVALID_JSON: 'INVALID_JSON',
    INVALID_NODE_TYPE: 'INVALID_NODE_TYPE',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    LLM_API_ERROR: 'LLM_API_ERROR',
    TIMEOUT: 'TIMEOUT',
    RATE_LIMIT: 'RATE_LIMIT'
};
