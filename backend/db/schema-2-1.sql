# 🚀 AI Companion 2.1 - 完整架构开发计划

**版本**: 2.0
**开发模式**: 完整架构开发
**时间**: 6-12 周
**状态**: 开始

---

## 📋 架构总览

### 5+1+1 属性系统
- ✅ 显性基础（APP）: 颜值（1-100）
- ✅ 隐藏核心（LCK）: 幸运（1-100，隐藏）
- ✅ 五维数值: 力量/智力/魅力/颜值/幸运

### 三大分层
- 角色初始化层
- 逻辑层（LLM + 隐藏事件 + 美术 Prompt 引擎）
- 交互层（对话 + 4K 立绘 + 道包道具）

---

## 🎯 开发阶段

### Phase 1: 数据库 Schema 设计（1-2 天）

#### 表结构设计
```
┌────────────────────────────────────────┐
│ users                              │
│ - id (UUID)                      │
│ - email                             │
│ - created_at                       │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ companions (角色表)                    │
│ - id (UUID)                      │
│ - user_id (UUID)                  │
│ - name (TEXT)                       │
│ - appearance (INT, 显性: 1-100)        │
│ - luck (INT, 隐藏: 1-100)          │
│ - personality (JSONB)                │
│ - appearance_config (JSONB)             │
│ └────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ stats (五维数值)                     │
│ - id (UUID)                      │
│ - character_id (UUID)              │
│ - strength (INT: 0-100)           │
│ - intelligence (INT: 0-100)        │
│ - charisma (INT: 0-100)            │
│ - appearance (INT: 0-100)           │
│ - luck (INT: 1-100)                 │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ messages (聊天记录)                    │
│ - id (UUID)                      │
│ - user_id (UUID)                  │
│ - character_id (UUID)             │
│ - role (TEXT)                     │
│ - content (TEXT)                   │
│ - metadata (JSONB)                 │
│ - created_at (TIMESTAMP)              │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ hidden_events (隐藏事件)                │
│ - id (UUID)                      │
│ - type (TEXT)                     │
│ - userId (UUID)                   │
│ - characterId (UUID)              │
│ - luckRequired (INT: 1-100)       │
│ - timestamp (TIMESTAMP)              │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ items (背包道具)                      │
│ - id (UUID)                      │
│ - userId (UUID)                   │
│ - name (TEXT)                     │
│ - itemType (TEXT)                  │
│ - rarity (INT: 1-100)             │
│ - stats (JSONB)                   │
└────────────────────────────────────────┘
```

---

## 🔬 快速执行：现在开始 Schema 设计

### 1️⃣ 创建 Schema 文件

```bash
cd /home/node/.openclaw1/projects/ai-companion/backend/db

# 创建新的 Schema 文件
cat > schema-2-1.sql << 'EOF'
-- AI Companion 2.1 - 完整架构 Schema

-- 删除旧表（如果需要）
DROP TABLE IF EXISTS EXISTS messages CASCADE;
DROP TABLE IF EXISTS hidden_events CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS stats CASCADE;
DROP TABLE IF EXISTS companions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 启用 pgvector（向量数据库，如果需要语义检索）
-- CREATE EXTENSION IF NOT EXISTS "vector";

-- Users 表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    auth_provider VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255),
    subscription_tier VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Companions 表（角色表）
CREATE TABLE IF NOT EXISTS companions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    gender VARCHAR(20) DEFAULT 'other',
    
    -- 属性系统 5+1+1
    appearance INT NOT NULL DEFAULT 50,      -- 显性：颜值 (APP) 1-100
    luck INT NOT NULL DEFAULT 50,             -- 隐藏：幸运 (LCK) 1-100（后端使用，前端不显示）)
    
    -- 五维数值（初始化）
    strength INT DEFAULT 50,              -- 力量 0-100
    intelligence INT DEFAULT 50,           -- 智力 0-100
    charisma INT DEFAULT 50,             -- 魅力 0-100
    appearance INT DEFAULT 50,           -- 颜值 0-100
    luck INT DEFAULT 50,                 -- 幸运 1-100（前端隐藏）
    
    -- 基础信息
    personality JSONB NOT NULL DEFAULT '{
\"traits\": [], \"speakingStyle\": \"casual\"}'::jsonb,
    appearance_config JSONB DEFAULT '{
      \"hair\": \"short black\",
      \"eyes\": \"brown\",
      \"style\": \"casual\"
    }'::jsonb,
    
    relationship_level INT DEFAULT 0,
    voice_config JSONB DEFAULT '{\"provider\": \"openai\", \"voiceId\": \"nova\", \"speed\": 1.0}'::jsonb,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW());

-- Stats 五维数值表
CREATE TABLE IF NOT EXISTS stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    character_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    
    stats_type VARCHAR(20) NOT NULL,  -- 'initial', 'battle', 'growth', 'special'
    
    strength INT,                              -- 力量
    intelligence INT,                          -- 智力
    charisma INT,                              -- 魅力
    appearance INT,                           // 颜值 (APP)
    luck INT,                                  -- 幸运 (隐藏)
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages 消息表
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    companion_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
  -- 创建索引：用户 + 伴侣 + 按时间
);

CREATE INDEX IF NOT EXISTS idx_messages_user_companion_time 
  ON messages(user_id, character_id, created_at DESC);

-- Hidden Events 隐藏事件表
CREATE TABLE IF NOT EXISTS hidden_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    description TEXT,
    luck_required INT NOT NULL,
    triggered BOOLEAN DEFAULT FALSE DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hidden_events_user_character_time 
  ON hidden_events(user_id, character_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hidden_events_trigger 
  ON hidden_events(triggered FALSE, luck_required);

-- Items 背包道具表
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID REFERENCES companions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    item_type VARCHAR(20) DEFAULT 'basic',  -- 'basic', 'rare', 'legendary'
    rarity INT NOT NULL DEFAULT 1,            -- 1-100, 100 最稀有的道具
    stats JSONB NOT NULL DEFAULT '{
      \"strength\": 80,
      \"intelligence\": 80,
      \"charisma\": 80,
      \"power\": 80
    }'::jsonb,
    effect_description TEXT,
    icon_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_user_rarity 
  ON items(user_id, rarity DESC);

-- 插入示例数据
-- 用户
INSERT INTO users (email, auth_provider, provider_id, subscription_tier) 
VALUES 
  ('test@ai-companion.io', 'email', 'email-123', 'free')
ON CONFLICT (email) DO NOTHING;

-- 角色：Luna (高颜值 + 高幸运)
INSERT INTO companions 
  SELECT uuid_generate_v4(), 
         user_id,
         'Luna',
         'female',
         95,  -- 高颜值
         90,  -- 高幸运（隐藏）
         '{\"traits\": [\"warm\", \"curious\", \"playful\"], \"speakingStyle\": \"casual\"}'::jsonb,
         '{\"hair\": \"long wavy silver\", \"eyes\": \"blue\", \"style\": \"casual elegant\"}'::jsonb,
         1,
         '{\"provider\": \"openai\", \"voiceId\": \"nova\", \"speed\": 1.0}'::jsonb
ON CONFLICT DO NOTHING;

-- 角色：Max (中等颜值 + 中等幸运)
INSERT INTO companions 
  SELECT uuid_generate_v4(), 
         user_id,
         'Max',
         'male',
         70,  // 中等颜值
         50,  // 中等幸运（隐藏）
         '{\"traits\": [\"adventurous\", \"daring\", \"humorous\"], \"speakingStyle\": \"direct\"}'::jsonb,
         '{\"hair\": \"short brown\", \"eyes\": \"brown\", \"style\": \"practical\"}'::jsonb,
         0,
         '{\"provider\": \"openai\", \"voiceId\": \"echo\", \"speed\": 1.0}'::jsonb
ON CONFLICT DO NOTHING;

-- Stats 初始值
INSERT INTO stats (character_id, stats_type, strength, intelligence, charisma, appearance, luck)
SELECT id, 'initial', 50, 50, 50, (SELECT appearance FROM companions WHERE name='Luna' LIMIT 1), (SELECT luck FROM companions WHERE name='Luna' LIMIT 1)),
       'Max', 'initial', 50, 50, 50, (SELECT appearance FROM companions WHERE name='Max' LIMIT 1), (SELECT luck FROM companions WHERE name='Max' LIMIT 1));

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_stats_character 
  ON stats(character_id, stats_type);
CREATE INDEX IF NOT EXISTS idx_stats_strength 
  ON stats(strength);
CREATE INDEX IF NOT EXISTS idx_stats_intelligence 
  ON stats(intelligence);
CREATE INDEX IF NOT EXISTS idx_stats_charisma 
  ON stats(charisma);
CREATE INDEX IF NOT EXISTS idx_stats_appearance 
  ON stats(appearance);
CREATE INDEX IF NOT EXISTS idx_stats_luck 
  ON stats(luck);

-- 验证是否创建成功
DO $$
-- 查看 schema 系统表
SELECT table_name, table_type 
FROM information_schema.tables
ORDER BY table_name;

-- 检查是否包含以下关键字
SELECT table_schema
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name LIKE '%hidden%' OR column_name LIKE '%luck%' OR column_name LIKE '%appearance%'
ORDER BY table_name, column_name;

-- 测试 SQL 查询角色（包含 APP 和 LCK）
SELECT id, name, appearance, luck, personality::jsonb->>traits, relationship_level 
FROM companions;

-- 测试五维数值（包括隐藏 LCK）
SELECT s.id, c.name AS character, s.stats_type, 
       s.strength, s.intelligence, s.charisma, s.appearance, s.luck 
FROM stats s
JOIN companions c ON s.character_id = c.id;

-- 测试隐藏事件触发
SELECT * FROM hidden_events 
WHERE triggered = FALSE 
ORDER BY created_at LIMIT 10;

-- 测试背包道具（按稀有度排序）
SELECT * FROM items 
WHERE user_id = (SELECT id FROM users WHERE email = 'test@ai-companion.io' LIMIT 1)
ORDER BY rarity DESC
LIMIT 5;

-- 检查对话记录
SELECT m.id, c.name AS companion, m.role, m.content, m.metadata::jsonb 
FROM messages m
JOIN companions c ON m.companion_id = c.id
ORDER BY m.created_at DESC
LIMIT 10;

-- 性能索引检查
SELECT schemaname, tablename, attname = 'luck'::int;
FROM pg_stats 
WHERE tabname = 'companions' AND attname = 'luck';

-- 统计信息
SELECT 
  '' AS user_count,
  COUNT(*) AS total_characters,
  COUNT(*) FILTER (relationship_level > 0) AS active_companions
FROM companions;

print '✅ Schema 2.1 创建完成';
print '包含: users, companions, stats, messages, hidden_events, items';
EOF
