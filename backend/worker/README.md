# AI Script Worker - AI 剧本生成 Worker

## 📚 概述

AI Script Worker 是《AI Companion 2.1》的核心组件之一，负责异步生成 RPG 游戏剧本内容。

### 核心特性

1. **Worker 消费者模式** - 从 Redis 队列接收生成任务
2. **强化 Prompt Engineering** - 严格的 JSON 格式要求
3. **三种节点类型** - Dialog、Stat_Check 和 Combat
4. **状态回调机制** - 任务完成/失败自动通知
5. **多模型支持** - OpenAI、Anthropic、GLM4、ZAI

---

## 🏗️ 架构设计

```
┌─────────────────┐
│   前端/后端     │
│  (任务提交者)   │
└────────┬────────┘
         │ 1. 提交任务
         ▼
┌─────────────────┐
│   Redis Queue   │
│ (BullMQ 队列)   │
│                 │
│  ai-script-     │
│  generate 队列  │
└────────┬────────┘
         │
         │ 2. Worker 消费
         ▼
┌─────────────────┐
│ AI Script Worker│
│  (消费者进程)   │
└────────┬────────┘
         │ 3. 调用 LLM
         ▼
┌─────────────────┐
│   AIM Service   │
│  (Prompt 构建)  │
└────────┬────────┘
         │ 4. LLM 请求
         ▼
┌─────────────────┐
│  LLM Provider   │
│ (OpenAI/Anthropic)│
└────────┬────────┘
         │ 5. JSON 响应
         ▼
┌─────────────────┐
│  解析 & 验证    │
└────────┬────────┘
         │ 6. 任务完成
         ▼
┌─────────────────┐
│  数据库/WebSocket 通知
└─────────────────┘
```

---

## 📝 类型定义

### 生成任务（AIScriptGenerationTask）

```typescript
{
    taskId: string;
    userId: string;
    companionId: string;

    scenarioType: 'daily_dialog' | 'battle_intro' | 'battle_outro' | 'gift_response' | 'hidden_event' | 'special_scene';

    character: {
        name: string;
        gender: string;
        personality: string;
        appearance: number;
        luck: number;
        relationship: string;
        currentStats: {...};
    };

    user: {
        stats: {...};
    };

    context: {
        previousNodes?: string[];
        previousChoices?: number[];
        flags: Record<string, boolean>;
        currentLocation?: string;
        timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    };

    options: {
        includeDialog: boolean;
        includeStatCheck: boolean;
        includeCombat: boolean;
        maxNodes: number;
        language: 'zh-CN' | 'en-US';
    };

    createdAt: Date;
}
```

### 节点类型（ScriptNode）

AI 剧本支持 5 种节点类型：

1. **Dialog_Node** - 对话节点
2. **Stat_Check_Node** - 数值判定节点
3. **Combat_Node** - 战斗触发节点
4. **Choice_Node** - 选项节点
5. **Branch_Node** - 分支节点

#### Dialog_Node 示例

```json
{
  "type": "dialog",
  "nodeId": "node_001",
  "speaker": "Luna",
  "text": "你好！今天天气真好，你想做什么？",
  "emotion": "happy",
  "portrait": "portrait_001",
  "choices": [
    {
      "id": "choice_001",
      "text": "我想去冒险",
      "nextNodeId": "node_002"
    },
    {
      "id": "choice_002",
      "text": "我想休息一下",
      "nextNodeId": "node_003"
    }
  ]
}
```

#### Stat_Check_Node 示例

```json
{
  "type": "stat_check",
  "nodeId": "node_002",
  "check": {
    "stat": "charisma",
    "operator": ">=",
    "value": 60,
    "label": "魅力判定 ≥ 60"
  },
  "branches": {
    "success": {
      "nodeId": "node_003",
      "text": "你的魅力吸引了她的注意，她对你笑了。",
      "reward": {
        "exp": 50,
        "gold": 10
      }
    },
    "failure": {
      "nodeId": "node_004",
      "text": "她似乎对你的话不太感兴趣。",
      "penalty": {
        "exp": 10
      }
    }
  }
}
```

#### Combat_Node 示例

```json
{
  "type": "combat",
  "nodeId": "node_005",
  "combat": {
    "enemyId": "enemy_001",
    "enemyName": "史莱姆",
    "enemyCount": 3,
    "difficulty": "easy",
    "winCondition": {
      "eliminateAll": true
    },
    "rewards": {
      "exp": 100,
      "gold": 50
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
  "preCombatDialog": "小心！敌人来了！"
}
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install bullmq ioredis dotenv

# 或使用 pnpm
pnpm add bullmq ioredis dotenv
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# LLM 配置
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
OPENAI_BASE_URL=https://api.openai.com/v1

# Worker 配置
WORKER_CONCURRENCY=3
WORKER_MAX_RETRIES=3
WORKER_TIMEOUT=120000
```

### 3. 启动 Worker

```bash
# 使用 npm
npm run worker:ai-script

# 或直接运行
ts-node backend/worker/start-ai-script-worker.ts
```

### 4. 添加生成任务

在 API 层（或任何需要生成剧本的地方）：

```typescript
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

// 创建队列
const redis = new Redis();
const queue = new Queue('ai-script-generate', { connection: redis });

// 添加任务
const task = {
    taskId: 'task_' + Date.now(),
    userId: 'user_001',
    companionId: 'companion_001',
    scenarioType: 'daily_dialog',
    character: {
        name: 'Luna',
        gender: 'female',
        personality: 'optimistic',
        appearance: 85,
        luck: 75,
        relationship: 'friend',
        currentStats: {
            strength: 70,
            intelligence: 80,
            charisma: 90,
            defense: 60
        }
    },
    user: {
        stats: {
            strength: 60,
            intelligence: 70,
            charisma: 85,
            defense: 55
        }
    },
    context: {
        timeOfDay: 'morning',
        currentLocation: 'town_square',
        flags: {
            hasMetBefore: true,
            questAccepted: false
        }
    },
    options: {
        includeDialog: true,
        includeStatCheck: true,
        includeCombat: false,
        maxNodes: 5,
        language: 'zh-CN'
    },
    createdAt: new Date()
};

await queue.add('generate-script', task);
console.log('✅ 任务已添加到队列');
```

---

## 🎯 Prompt Engineering

### 系统提示词

系统提示词定义了 LLM 的输出格式和规则：

1. **必须返回严格的 JSON 格式** - 不返回任何 JSON 之外的内容
2. **节点 ID 必须唯一** - 格式为 "node_001", "node_002", "node_003"...
3. **节点类型必须正确** - 只支持 5 种类型
4. **对话文本要符合角色性格** - 根据角色属性和关系状态调整语气
5. **数值判定要合理** - 考虑角色属性值

### 场景专属 Prompt

每个场景类型都有专属的 Prompt：

- **daily_dialog** - 日常对话场景
- **battle_intro** - 战斗开场场景
- **battle_outro** - 战斗收尾场景
- **gift_response** - 赠送礼物场景
- **hidden_event** - 隐藏事件场景

### JSON 验证

返回的 JSON 会经过严格验证：

1. **节点检查** - 每个节点都有 `type` 和 `nodeId`
2. **字段检查** - 根据节点类型检查必需字段
3. **链接检查** - 所有 `nextNodeId` 都存在于 `nodes` 数组
4. **数值检查** - 验证操作符、值等

---

## 📊 监控状态

### 使用 BullBoard

BullBoard 可以可视化队列状态，支持监控任务进度。

安装：

```bash
npm install @bull-board/express
```

添加到 Express 应用：

```typescript
import { createBullBoard } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import express from 'express';

const app = express();

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(queue)],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

app.listen(3000, () => {
  console.log('BullBoard 运行在 http://localhost:3000/admin/queues');
});
```

---

## 🔧 配置选项

### Worker 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `queueName` | `ai-script-generate` | 队列名称 |
| `concurrency` | `3` | 并发任务数 |
| `maxRetries` | `3` | 最大重试次数 |
| `timeout` | `120000` | 任务超时（毫秒）|

### LLM 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `apiKey` | - | LLM API 密钥 |
| `model` | `gpt-4` | 使用的模型 |
| `baseUrl` | `https://api.openai.com/v1` | API 基础 URL |
| `timeout` | `60000` | 请求超时（毫秒）|

---

## 🐛 错误处理

### 错误类型

| 错误代码 | 说明 |
|----------|------|
| `INVALID_JSON` | JSON 解析失败 |
| `INVALID_NODE_TYPE` | 节点类型无效 |
| `MISSING_REQUIRED_FIELD` | 缺少必需字段 |
| `LLM_API_ERROR` | LLM API 错误 |
| `TIMEOUT` | 任务超时 |
| `RATE_LIMIT` | API 速率限制 |

### 重试策略

- 使用指数退避算法：`delay = 5000 * 2^(attempt - 1)`
- 最大重试次数：3 次
- 超时：2 分钟

---

## 📚 文件结构

```
backend/
├── common/
│   └── ai-script/
│       ├── ai-script-types.ts       # 类型定义
│       └── prompt-engineering.ts    # Prompt 模板
├── ai-core/
│   └── services/
│       └── ai-script.service.ts     # AI 剧本服务
├── worker/
│   ├── ai-script-worker.ts          # Worker 实现
│   └── start-ai-script-worker.ts    # 启动入口
└── scripts/
    └── init-db.sh                   # 数据库初始化
```

---

## 🎨 示例输出

### 日常对话场景

```json
{
  "nodes": [
    {
      "type": "dialog",
      "nodeId": "node_001",
      "speaker": "Luna",
      "text": "你好！今天天气真好，你想做什么？",
      "emotion": "happy",
      "choices": [
        {
          "id": "choice_001",
          "text": "我想去冒险",
          "nextNodeId": "node_002"
        }
      ]
    },
    {
      "type": "stat_check",
      "nodeId": "node_002",
      "check": {
        "stat": "charisma",
        "operator": ">=",
        "value": 60,
        "label": "魅力判定 ≥ 60"
      },
      "branches": {
        "success": {
          "nodeId": "node_003",
          "text": "你的魅力吸引了她的注意，她对你笑了。",
          "reward": {
            "exp": 50,
            "gold": 10
          }
        },
        "failure": {
          "nodeId": "node_004",
          "text": "她似乎对你的话不太感兴趣。",
          "penalty": {
            "exp": 10
          }
        }
      }
    }
  ]
}
```

---

## 📝 注意事项

1. **LLM 耗时较长** - 建议使用 Worker 异步处理
2. **JSON 严格性** - 必须确保返回的 JSON 格式正确
3. **节点链接** - 确保所有 `nodeId` 引用都存在
4. **成本控制** - LLM 请求有成本，建议添加速率限制
5. **错误监控** - 定期检查失败任务，优化 Prompt

---

## 🤝 贡献

欢迎提交 PR 或 Issue！

---

## 📄 许可

MIT License
