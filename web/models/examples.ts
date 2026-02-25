/**
 * AI Companion 类型定义与数据转换示例
 * 
 * 使用说明：
 * 1. 导入类型定义
 * 2. 导入数据清理函数
 * 3. 创建 API 路由时使用 Omit 或 sanitizeForFrontend
 */

import {
  UserProfile,
  FrontendUserProfile,
  AICompanion,
  FrontendAICompanion,
  CreateCompanionDTO,
  CreateCompanionRequest,
  ChatRequest,
  ChatMessage
} from './types';

import {
  sanitizeForFrontend,
  sanitizeCompanionsArray,
  debugSanitize
} from './data-sanitizer';

// ===== API 请求示例 =====

// 示例 1: 创建角色请求（前端 → 后端）
const createCompanionRequest: CreateCompanionRequest = {
  userId: 'user-123',
  name: 'Luna',
  gender: 'female',
  personality: {
    traits: ['warm', 'curious'],
    speakingStyle: 'casual',
    backStory: '...',
    catchphrases: []
  },
  appearance: 85, // 显性
  luck: undefined  // 不发送到后端（undefined 会被忽略）
};

// 发送到后端 API
// fetch('/api/v1/create-companion', {
//   method: 'POST',
//   body: JSON.stringify(createCompanionRequest)
// });

// ===== API 响应示例（后端 → 前端） =====

// 示例 2: 后端返回的完整角色（包含 luck）
const backendCompanion: AICompanion = {
  id: 'companion-123',
  userId: 'user-123',
  name: 'Luna',
  appearance: 85,  // 显性
  luck: 75,      // 隐藏
  gender: 'female',
  personality: {
    traits: ['warm', 'curious'],
    speakingStyle: 'casual',
    backStory: '...',
    catchphrases: []
  },
  appearance_config: {},
  relationshipLevel: 0,
  voiceConfig: {},
  createdAt: new Date(),
  updatedAt: new Date()
};

// 清理后用于前端展示（移除 luck 属性）
const frontendCompanion = sanitizeForFrontend(backendCompanion);

// console.log('前端显示：', frontendCompanion);
// 结果：没有 luck 属性

// ===== React 组件示例 =====

import { useState, useEffect } from 'react';

function CompanionDetail() {
  const [companion, setCompanion] = useState<FrontendAICompanion | null>(null);
  const [userProfile, setUserProfile] = useState<FrontendUserProfile | null>(null);
  
  useEffect(() => {
    // 加载角色数据（后端响应）
    fetch('/api/v1/companions/123')
      .then(res => res.json())
      .then(data => {
        // 清理数据，确保不包含 luck
        const cleanData = sanitizeForFrontend(data);
        setCompanion(cleanData)
      });
      
    // 加载用户档案
    fetch('/api/v1/user/profile')
      .then(res => res.json())
      .then(data => {
        // 清理数据，确保不包含 luck
        const cleanData = sanitizeForFrontend(data);
        setUserProfile(cleanData)
      });
  }, []);

  // 组件渲染 - luck 属性已被自动移除，不会在 UI 显示
  return (
    <div>
      <h1>{companion?.name}</h1>
      <div className="attribute">
        <span>✨ 颜值 (APP): {companion?.appearance}/100</span>
        <span>⭐ 星级: {Math.floor((companion?.appearance || 0) / 20)} ⭐</span>
      </div>
      {/* luck 属性不会出现在这里，已被 Omit 移除 */}
    </div>
  )
}

// ===== 数组清理示例 =====

// 后端返回的角色列表（包含 luck）
const backendCompanions: AICompanion[] = [
  {
    id: '1',
    userId: 'user-123',
    name: 'Luna',
    appearance: 85,
    luck: 75,
    gender: 'female',
    personality: {},
    appearance_config: {},
    relationshipLevel: 0,
    voiceConfig: {},
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    userId: 'user-123',
    name: 'Max',
    appearance: 75,
    luck: 50,
    gender: 'male',
    personality: {},
    appearance_config: {},
    联系系统: 0,
    voiceConfig: {},
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// 清理用于前端列表展示
const frontendCompanions = sanitizeCompanionsArray(backendCompanions);

// console.log('前端列表：', frontendCompanions);
// 结果：两个角色都没有 luck 属性

// ===== 开发调试示例 =====

// 调试：检查数据清理是否正确
const debugResult = debugSanitize(backendCompanion);
console.log('调试信息：', debugResult);
// 输出：
// {
//   original: { id: ..., luck: 75, ... },
//   cleaned: { id: ..., ... },  // 没有 luck 属性
//   hasLuck: true
// }

// ===== 认证请求示例 =====

type RegisterRequest = Omit<UserProfile, 'luck'>;

const registerRequest: RegisterRequest = {
  userId: 'user-123',
  email: 'user@example.com',
  appearance: 75,
  // luck 字段不会出现（已被 Omit）
};

// ===== GraphQL Fragment 示例（如果使用 GraphQL）=====

import { graphql } from '@apollo/client';

const FRAGMENT = graphql`
  fragment CompanionFields on FrontendAICompanion {
    id
    name
    appearance
    gender
  }
`;

// 使用 fragment
const { data } = useQuery(GET_COMPANION, {
  variables: { id: 'abc' }
});
