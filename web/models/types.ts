// AI Companion TypeScript Type Definitions
// 用于属性系统：APP (颜值, 显性) + LCK (幸运, 隐藏)

// ===== 核心类型定义 =====

/**
 * 用户档案接口
 */
export interface UserProfile {
  id: string;
  userId: string;
  email: string;
  /**
   * 显性属性：颜值 (APP)
   * 范围: 1-100
   * 作用: 影响 AI "容貌评价" 回复权重 + 初始好感度加成
   * 显示: ✅ 可见
   */
  appearance: number;
  
  /**
   * 隐藏属性：幸运 (LCK)
   * 范围: 1-100
   * 作用: 影响背包掉落概率、技能暴击率、隐藏剧情触发
   * 显示: ❌ 隐藏（不对前端用户显示）
   */
  luck?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AI 伴侣/角色接口
 */
export interface AICompanion {
  id: string;
  userId: string;
  name: string;
  
  /**
   * 显性属性：颜值 (APP)
   * 范围: 1-100
   * 作用: 影响 AI "容貌评价" 回复权重 + 初始好感度加成
   * 显示: ✅ 可见
   */
  appearance: number;
  
  /**
   * 隐藏属性：幸运 (LCK)
   * 范围: 1-100
   * 作用: 影响背包掉落概率、技能暴击率、隐藏剧情触发
   * 显示: ❌ 隐藏（不对前端用户显示）
   */
  luck?: number;
  
  gender: 'male' | 'female' | 'other';
  personality: {
    traits: string[];
    speakingStyle: string;
    backStory: string;
    catchphrases: string[];
  };
  appearance_config: {
    hair: string;
    eyes: string;
    style: string;
  };
  relationshipLevel: number;
  voiceConfig: {
    provider: string;
    voiceId: string;
    speed: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ===== Omit 类型：隐藏 luck 字段 =====

/**
 * 前端可访问的用户档案（不含隐藏的 luck）
 * 使用 Omit 排除 luck 字段
 */
export type FrontendUserProfile = Omit<UserProfile, 'luck'>;

/**
 * 前端可访问的 AI 伴侣（不含隐藏的 luck）
 * 使用 Omit 排除 luck 字段
 */
export type FrontendAICompanion = Omit<AICompanion, 'luck'>;

/**
 * 扩展角色属性接口（用于游戏逻辑）
 */
export interface CharacterAttributes {
  characterId: string;
  userId: string;
  attributes: {
    /**
     * 颜值 (APP) - 显性
     */
    appearance: number;
    
    /**
     * 幸运 (LCK) - 隐藏
     */
    luck: number;
  };
}

/**
 * 五维数值接口（后续扩展）
 */
export interface CharacterStats {
  strength: number;     // 力量
  intelligence: number; // 智力
  charisma: number;     // 魅力
  appearance: number;   // 颜值
  luck: number;         // 幸运
}

/**
 * 角色生成配置
 */
export interface CharacterCreationConfig {
  /**
   * 角色倍率系数
   * 系数越高，数值生成范围越大
   */
  multiplier: number;
  
  /**
   * 角色基础值
   */
  baseStats: CharacterStats;
}

/**
 * 后端创建的完整角色（包含所有属性）
 */
export interface CreateCompanionDTO {
  userId: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  personality: any;
  appearance: number;
  luck?: number; // 隐藏，可选
  appearance_config?: any;
  voiceConfig?: any;
}

/**
 * 前端展示的角色信息（不含隐藏属性）
 */
export type CreateCompanionRequest = Omit<CreateCompanionDTO, 'luck'>;

/**
 * 聊天请求接口
 */
export interface ChatRequest {
  userId: string;
  companionId: string;
  message: string;
  // 其他聊天相关字段...
  attributes?: Omit<CharacterAttributes['attributes'], 'luck'>;
}

/**
 * 对话消息接口
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    attributes?: Omit<CharacterAttributes['attributes'], 'luck'>;
  };
}

/**
 * 记忆接口（扩展以包含隐藏属性）
 */
export interface Memory {
  id: string;
  userId: string;
  content: string;
  importance: number;
  emotion?: string;
  tags?: string[];
  createdAt: Date;
  // 隐藏属性相关（如需要）
  hiddenEvents?: HiddenEvent[];
}

/**
 * 隐藏事件接口（隐藏逻辑判定）
 */
export interface HiddenEvent {
  id: string;
  userId: string;
  characterId: string;
  eventType: string;
  timestamp: Date;
  luckRequirement: number; // 触发所需的幸运值

}
