# AI Companion 类型定义文件说明文档

## 📋 文件说明

| 文件 | 说明 |
|------|------|
| `models/types.ts` | 核心类型定义（UserProfile, AICompanion 等） |
| `models/data-sanitizer.ts` | 数据清理函数（移除隐藏 luck 属性） |
| `models/examples.ts` | 使用示例 |

---

## 🚀 快速使用

### 1️⃣ 导入类型

```typescript
import {
  UserProfile,
  FrontendUserProfile,
  AICompanion,
  FrontendAICompanion,
  CreateCompanionDTO,
  CreateCompanionRequest,
} from './models/types';
```

### 2️⃣ 导入清理函数

```typescript
import {
  sanitizeForFrontend,
  sanitizeCompanionsArray,
  debugSanitize
} from './models/data-sanitizer';
```

### 3️⃣ 创建完整数据（包含隐藏属性）

```typescript
const backendData: AICompanion = {
  id: 'companion-123',
  userId: 'user-123',
  name: 'Luna',
  appearance: 85,  // 显性 (1-100)
  luck: 75      // 隐藏 (1-100)
  gender: 'female',
  personality: {},
  // ...
};
```

### 4️⃣ 转换为前端可读格式（移除 luck）

```typescript
const frontendData = sanitizeForFrontend(backendData);
// 结果：没有 luck 属性
```

---

## 🎯 属性系统说明

### ✨ 显性属性：APP（颜值）

**范围**: 1-100
**作用**:
- ❌ 初始好感度加成
- ❌ AI 的"容貌评价"回复权重
- ✅ UI 显示：进度条 + 星级

### 🎁 隐藏属性：LCK（幸运）

**范围**: 1-100
**作用**:
- 背包掉落概率
- 技能暴击率
- 特殊隐藏剧情触发
- 前端不显示，后端使用

---

## 🆕 TypeScript Omit 的优势

### 自动隐藏 luck 字段

```typescript
// 自动移除 luck 字段
type FrontendAICompanion = Omit<AICompanion, 'luck'>;

const companion: FrontendAICompanion = {
  id: '123',
  name: 'Luna',
  appearance: 85,
  // luck 字段在类型层面被禁用
};
```

### 编译时类型检查
- luck 字段被 TypeScript 编译器自动移除
- 减少前端暴露隐藏属性的风险
- 强制前端只使用显性属性

---

## 🔍 调试助手函数

**使用 `debugSanitize()` 验证数据清理是否正确**：

```typescript
const result = debugSanitize(fullData);
console.log(result);

// 输出：
// {
//   original: {..., luck: 75, ...},  // 原始数据
//   cleaned: {...},                   // 清理后数据（无 luck）
//   hasLuck: true                    // 是否包含 luck
// }
```

---

## 📝 前后端集成检查清单

### 后端 API 开发

#### 1. 在数据库 Schema 中添加属性列

```typescript
// backend/api/src/entities/companion.entity.ts

@Entity('companions')
export class Companion {
  @Column({ name: 'appearance', type: 'int', nullable: false, default: 70 })
  appearance: number;  // 显性
  
  @Column({ name: 'luck', type: 'int', nullable: true, default: 50 })
  luck: number;  // 隐藏
  
  // ... 其他字段
}
```

#### 2. 在前端响应中清理数据

```typescript
// backend/api/src/companion/companion.controller.ts

@Get('api/v1/companion/:id')
async getCompanion(@Param('id') id: string): Promise<FrontendAICompanion> {
  const companion = await this.companionService.findOne(id);
  return companion;  // Omit 在请求层面生效
}
```

### 前端组件使用

#### 1. 导入清理后的类型

```typescript
import { FrontendAICompanion } from './models/types';
import { sanitizeForFrontend } from './models/data-sanitizer';
```

#### 2. 在组件中使用

```typescript
const [companion, setCompanion] = useState<FrontendAICompanion>();

useEffect(() => {
  fetch('/api/v1/companion/123')
    .then(res => res.json())
    .then(data => {
      // 清理数据确保没有 luck
      const cleanData = sanitizeForFrontend(data);
      setCompanion(cleanData);
    });
}, []);
```

---

## 🎯 集成到 React 项目

### 在前端项目根目录使用

```typescript
// frontend/src/api/client.ts

import type {
  FrontendAICompanion,
  CreateCompanionRequest,
  ChatRequest
} from 'web/models/types';

export async function createCompanion(request: CreateCompanionRequest) {
  const response = await fetch('/api/v1/companions/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request)
  });
  
  return response.json();
}
```

---

## ✅ 已完成的修改

- ✅ 创建 `/web/models/types.ts` - 核心类型定义（包含 Omit）
- ✅ 创建 `/web/models/data-sanitizer.ts` - 数据清理工具函数
- ✅ 创建 `/web/models/examples.ts` - 使用示例
- ✅ 在 `UserProfile` 和 `AICompanion` 中添加：
  - `appearance: number` (显性)
  - `luck?: number` (隐藏)
- ✅ 使用 TypeScript Omit 确保前端不接收 `luck` 属性

---

## 📊 当前文件状态

| 文件 | 状态 | 说明 |
|------|------|------|
| `/web/models/types.ts` | ✅ 已创建 | 完整类型定义 |
| `/web/models/data-sanitizer.ts` | ✅ 已创建 | 数据清理工具 |
| `/web/models/examples.ts` | ✅ 已创建 | 使用示例 |
| `UserProfile` 接口 | ✅ 已更新 | 包含 appearance + luck |
| `AICompanion` 接口 | ✅ 已更新 | 包含 appearance + luck |
| `FrontendUserProfile` | ✅ 已创建 | Omit<luck> 类型 |
| `FrontendAICompanion` | ✅ 已创建 | Omit<luck> 类型 |
| `Omit` 工具 | ✅ 已使用 | 自动移除 front luck |

---

## 🔬 数值生成公式示例

**公式实现（根据 22.1 定义）**:

```typescript
function generateStat(
  base: number,
  luck: number,
  appearance: number,
  multiplier: number
): number {
  // 随机数 [0, 10] × 系数
  const randomBoost = Math.random() * 10 * (luck / 100)
  
  // 幸运值越高，随机增益区间越大
  const luckyBonus = randomBoost * (1 + (luck > 80 ? 0.5 : 0))
  
  // 颜值修正 (微小保底偏移)
  const appearanceBonus = appearance / 20
  
  // 最终数值
  const final = base + luckyBonus * multiplier + appearanceBonus
  
  // Clamp 到 [0, 100]
  return Math.max(0, Math.min(100, parseInt(final.toFixed(0))))
}

// 欧皇角色（高 LCK）测试
const euroStat = generateStat(
  base: 60,        // 基础值
  luck: 90,        // 欧皇
  appearance: 95,   // 高颜值
  multiplier: 1.2    // 角色倍率
)
console.log('欧皇角色 stats:', euroStat)  // 可能更大值
```

---

_类型定义文件已创建完成！_