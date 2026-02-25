# Epic: v3-Architecture 重大版本重构

## 🏷️ 分支信息
- **分支名**: `epic/v3-architecture`
- **基础分支**: `main` (基于 v2.1.0-mvp)
- **当前提交**: `a62382d`
- **创建日期**: 2026-02-25
- **远程地址**: `https://github.com/zxhjerry/ai-companion/tree/epic/v3-architecture`

---

## 🎯 分支用途

这是一个**重大版本重构分支**，所有底层重构工作必须在此分支进行，**绝对不能污染 main 分支**。

### 重构内容

1. **PostgreSQL 数据库架构**
   - 从 SQLite 迁移到 PostgreSQL 14+
   - 实现连接池（pg-pool）
   - 支持高并发事务

2. **Redis 消息队列**
   - 引入 Redis
   - 实现 BullMQ 消息队列
   - 异步 Worker 处理（AI 剧本生成、抽卡等）

3. **抽卡保底算法**
   - 实现 70 抽保底递增
   - 服务器端随机数生成
   - 权重池保密（不暴露给前端）

4. **装备系统**
   - ItemTemplate（静态模板）
   - ItemInstance（动态实例）
   - is_soulbound 绑定机制

5. **好感度系统**
   - NPC 好感度枚举状态机
   - Stranger → Partner 关系状态
   - 赠送礼物功能

6. **卡牌战斗引擎**
   - 除法减伤模型
   - 回合制战斗
   - 服务器端结算

7. **前端性能重构**
   - Zustand 状态管理
   - 高性能图片加载（4K/8K）
   - WebSocket 实时通信
   - 虚拟滚动支持

---

## 🚀 工作流程

### 1. 切换到此分支

```bash
# 从 main 分支切换（首次）
git checkout -b epic/v3-architecture origin/epic/v3-architecture

# 如果本地已存在
git checkout epic/v3-architecture
```

### 2. 进行开发
- 所有底层重构在此分支进行
- 不要修改 main 分支
- 使用语义化提交信息（[FEAT], [FIX], [REFACTOR] 等）

### 3. 推送代码

```bash
# 提交到 epic/v3-architecture 分支
git add .
git commit -m "[FEAT] 实现新的功能"
git push origin epic/v3-architecture
```

### 4. 创建 Pull Request（可选）

当重构完成后，通过 PR 将改动合并到 main 分支：

```bash
# 访问链接创建 PR
https://github.com/zxhjerry/ai-companion/pull/new/epic/v3-architecture
```

---

## 📊 与 main 分支的关系

```
main (v2.1.0-mvp)
    │
    │ 基于 v2.1.0-mvp 创建
    ↓
epic/v3-architecture (当前分支)
    │
    │ 进行底层重构
    │ - PostgreSQL
    │ - Redis + BullMQ
    │ - 抽卡保底
    │ - 装备系统
    │ - 好感度系统
    │ - 战斗引擎
    │ - 前端性能优化
    │
    ↓
    │（完成重构后）
    ↓ 合并到 main
main (v3.0.0)
```

---

## ⚠️ 重要规则

### 必须遵守

1. **绝对不要直接修改 main 分支**
2. **所有底层重构必须在 epic/v3-architecture 分支进行**
3. **不要推送敏感数据到任何分支**（数据库、环境变量等）
4. **提交前检查 .gitignore 配置**
5. **使用清晰的提交信息**

### 提交信息规范

格式：`[TYPE] 描述`

- `[FEAT]` - 新功能
- `[FIX]` - Bug 修复
- `[REFACTOR]` - 重构
- `[STYLE]` - 代码风格
- `[TEST]` - 测试
- `[DOCS]` - 文档
- `[CHORE]` - 杂项

---

## 📝 分支状态

### 当前提交信息

```bash
a62382d - 🔒 更新 .gitignore - epic/v3-architecture 分支
a62382d - 🔒 更新 .gitignore - epic/v3-architecture 分支
90e9142 - 📝 添加 Git 提交报告 - v2.1.0-mvp 提交详情
a026518 - 🎉 v2.1.0 MVP - AI Companion 2.1 完整架构版本
697ac38 - Initial commit for ai-companion
```

### 分支差异

由于 epic/v3-architecture 是基于 main 分支创建的，因此：

**当前状态**: 与 main 分支相同（除了最新的 .gitignore 提交）

**后续状态**: 将在此分支上进行所有底层重构

---

## 🔒 安全检查

### 检查敏感文件

```bash
# 检查数据库文件是否被跟踪
git ls-files | grep -E "\.(db|sqlite|sqlite3)$"

# 检查环境变量文件是否被跟踪
git ls-files | grep -E "\.env\."

# 检查密钥文件是否被跟踪
git ls-files | grep -E "\.(pem|key|crt)$"
```

所有这些文件都应该在 .gitignore 中，不应该被 Git 跟踪。

---

## 📞 联系信息

- **仓库**: https://github.com/zxhjerry/ai-companion
- **作者**: zxhsuan
- **邮箱**: zxhsuan@gmail.com
- **创建日期**: 2026-02-25

---

## 🎨 标签和里程碑

- **当前标签**: 无（此分支不使用标签）
- **目标里程碑**: v3.0.0（重构完成后合并到 main）

---

_更新时间: 2026-02-25_
