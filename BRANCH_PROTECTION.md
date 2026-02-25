# Branch Protection Rules - 分支保护规则

## 🛡️ 目的

确保 main 分支保持干净、稳定，不被开发过程中的代码污染。

---

## 📋 规则列表

### ✅ 规则 1: main 分支保护

**状态**: 强制执行

**要求**:
- 所有对 main 分支的修改必须通过 Pull Request (PR)
- 禁止直接推送到 main 分支
- PR 必须通过 Code Review（至少 1 个 approve）
- CI 检查必须通过

---

### ✅ 规则 2: 分支使用规范

| 分支 | 用途 | 可直接推送 | 需要 PR |
|------|------|-----------|---------|
| `main` | 稳定版本 | ❌ 禁止 | ✅ 需要 |
| `epic/v3-architecture` | 重构开发 | ✅ 允许 | ❌ 不需要 |
| `feature/*` | 功能开发 | ✅ 允许 | ❌ 不需要 |
| `bugfix/*` | Bug 修复 | ✅ 允许 | ❌ 不需要 |

---

### ✅ 规则 3: 代码提交规范

**格式**: `[TYPE] 描述`

**类型**:
- `[FEAT]` - 新功能
- `[FIX]` - Bug 修复
- `[REFACTOR]` - 重构
- `[STYLE]` - 代码风格
- `[TEST]` - 测试
- `[DOCS]` - 文档
- `[CHORE]` - 杂项

**示例**:
```
[FEAT] 实现抽卡保底递增算法
[FIX] 修复 PostgreSQL 连接池并发问题
[REFACTOR] 将 SQLite 迁移到 PostgreSQL
[DOCS] 更新 API 文档
```

---

### ✅ 规则 4: 敏感数据保护

**禁止**:
- ✗ 数据库文件（`*.db`, `*.sqlite3`）
- ✗ 环境变量（`.env`, `.env.local`）
- ✗ 密钥文件（`*.pem`, `*.key`, `*.crt`）
- ✗ 临时文件（`*.log`, `tmp/`）

**措施**:
- ✅ 所有敏感文件必须在 `.gitignore` 中
- ✅ 提交前检查 `git ls-files` 输出
- ✅ 使用 pre-commit hook 自动检查

---

### ✅ 规则 5: 分支合并规范

**合并到 main 分支**:
1. 从 `epic/v3-architecture` 创建 PR
2. PR 必须通过 Code Review
3. CI 检查必须通过
4. 合并策略：Squash and Merge（保持 main 分支干净）

**不允许**:
- ❌ Fast-forward 自动合并
- ❌ 直接推送到 main

---

## 🔒 实施措施

### 1. Git Hook 配置

创建 `.git/hooks/pre-commit`:
```bash
#!/bin/bash

echo "🔍 检查敏感文件..."

# 检查数据库文件
if git diff --cached --name-only | grep -E "\.(db|sqlite|sqlite3)$"; then
    echo "❌ 数据库文件不应被提交！"
    exit 1
fi

# 检查环境变量
if git diff --cached --name-only | grep -E "\.env$"; then
    echo "❌ 环境变量文件不应被提交！"
    exit 1
fi

# 检查密钥文件
if git diff --cached --name-only | grep -E "\.(pem|key|crt)$"; then
    echo "❌ 密钥文件不应被提交！"
    exit 1
fi

echo "✅ 敏感文件检查通过"
exit 0
```

### 2. GitHub Branch Protection

在 GitHub 仓库设置中配置：

**Settings → Branches → Add rule**:

| 配置项 | 值 |
|--------|---|
| Branch name pattern | `main` |
| Require status checks | ✅ |
| Require branches to be up to date before merging | ✅ |
| Require pull request reviews | ✅（至少 1 个 approve） |
| Disallow pushing commits | ✅ |
| Do not allow bypassing | ✅ |

### 3. CI/CD 集成

在 PR 提交时自动运行：
- Lint 检查
- 单元测试
- 代码覆盖率
- 安全扫描

---

## 📊 分支状态检查

### 检查当前分支

```bash
git branch --show-current
```

### 检查是否有未提交的敏感文件

```bash
# 检查数据库文件
git ls-files | grep -E "\.(db|sqlite|sqlite3)$"

# 检查环境变量
git ls-files | grep -E "\.env$"

# 检查密钥文件
git ls-files | grep -E "\.(pem|key|crt)$"
```

### 检查与 main 分支的差异

```bash
# 切换到 main 分支
git checkout main

# 查看差异
git diff main epic/v3-architecture

# 查看文件差异统计
git diff --stat main epic/v3-architecture
```

---

## ⚠️ 违规处理

### 发现违规提交到 main 分支

1. 立即回滚：
   ```bash
   git revert <commit_id>
   git push origin main
   ```

2. 修复提交：
   ```bash
   git reset --hard HEAD~1
   git push origin main --force
   ```

3. 通知团队并在 PR 中说明问题

---

## 📞 联系信息

- **仓库维护者**: zxhsuan
- **邮箱**: zxhsuan@gmail.com
- **紧急联系**: 联系仓库维护者

---

_更新时间: 2026-02-25_
