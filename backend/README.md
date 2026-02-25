# Backend Architecture - AI Companion 2.1
# 权威服务器 + 异步微服务架构

## 目录结构

```
backend/
├── api/                           # 核心 REST API 服务器
│   ├── src/
│   │   ├── main.ts                 # NestJS 主入口
│   │   ├── app.module.ts             # 应用根模块
│   │   ├── characters/              # 角色管理模块
│   │   ├── inventory/               # 背包管理 API
│   │   ├── gacha/                   # 抽卡系统 API
│   │   └── users/                   # 用户管理 API
│   └── package.json
│
├── worker/                         # 异步后端 Worker
│   ├── gacha-worker.ts             # Gacha 抽卡 Worker
│   ├── ai-script-worker.ts         # AI 剧本生成 Worker
│   ├── inventory-worker.ts         # 装备后台 Worker
│   ├── docker-compose.yml          # Worker 服务编排
│   └── package.json
│
├── common/                        # 公共库（连接池、队列、工具）
│   ├── database/                    # 数据库接口
│   │   ├── postgres.ts              # PostgreSQL 连接池（pg-pool）
│   │   ├── schema.sql               # PostgreSQL 数据库 Schema
│   │   └── postgres-connection.ts    # 连接管理
│   │
│   ├── queue/                       # 消息队列（Redis + BullMQ）
│   │   ├── bull.ts                  # BullMQ 配置
│   │   │   producer.ts             # 消息生产者
│   │   ├── index.ts                # BullMQ 索引
│   │   └── worker.ts              BullMQ Worker 模板
│   │
│   ├── config/                       # 配置管理
│   │   ├── app.config.ts             # 应用配置
│   │   ├── db.config.ts              # 数据库配置（PostgreSQL）
│   │   ├── queue.config.ts           # BullMQ 配置（Redis）
│   │   └── redis.config.ts           # Redis 配置
│   │
│   └── utils/                       # 工具函数
│       ├── logger.ts                # 日志工具
│       ├── validation.ts           # 数据验证
│       └── helpers.ts              # 辅助函数
│
└── scripts/                       # 迁移脚本
    ├── migrate-sqlite-to-pgsql.sh       # SQLite -> PostgreSQL 迁移
    ├── init-db.sh                   # 初始化 PostgreSQL 数据库
    └── seed-data.sh                 # 种子数据

---

## 架构说明

### 权威服务器 (Main API Server)
- 职责处理 HTTP 请求
- PostgreSQL 连接池集成（pg-pool）
- Redis 消息队列集成
- 向 BullMQ 推送任务

### 异步 Worker
职责：
- **gacha-worker**: 处理 Gacha 抽卡计算、保底逻辑、稀有度计算
- **ai-script-worker**: 生成 AI 剧本
- **infventory-worker**: 处理装备后台计算、属性加成、背包操作

### 公共库 (Common)
- database/: PostgreSQL 连接池（pg-pool）事务管理
- queue/: Redis BullMQ 配置 + Worker 管理
- config/: 环境变量管理
- utils/: 日志、验证、辅助函数

---

## 技术栈

- **后端**: NestJS
- **数据库**: PostgreSQL 14+
  - pg-pool 连接池（高并发事务）
- **消息队列**: Redis + BullMQ
- **ORM**: TypeORM
- **容器化**: Docker Compose

---

## API 设计

### REST API
- GET /api/v1/characters
- GET /api/v1/inventory/:userId
- POST /api/v1/gacha/pull
- POST /api/v1/ai-script/generate

### Worker API
- POST /api/v1/worker/gacha - 触发 Gacha 抽卡
- POST /api/v1/worker/ai-script - 生成 AI 剧本
- POST /api/v1/worker/inventory - 装备属性计算

---

## 环境变量

```
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/ai_companion
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

_创建时间: 2026-02-25 06:20 UTC_
