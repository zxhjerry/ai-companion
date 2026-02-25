"""
Alternative Database Manager using SQLite
用于没有 PostgreSQL/Docker 的开发环境
"""

import sqlite3
import json
import uuid
from datetime import datetime
import os

DATABASE_PATH = 'sqlite:///ai_companion.db'
DB_FILE = '/home/node/.openclaw1/projects/ai-companion/ai_companion.db'

class DatabaseServiceSQLite:
    """SQLite 版本的数据库服务层"""
    
    def __init__(self):
        self.db_file = DB_FILE
        self.conn = None
        self._initialized = False
    
    def initialize(self) -> bool:
        """初始化数据库"""
        try:
            # 创建数据库连接
            self.conn = sqlite3.connect(self.db_file, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row  # 支持字典访问
            
            print(f"✅ SQLite 数据库已创建: {self.db_file}")
            self._initialized = True
            return True
        except Exception as e:
            print(f"❌ SQLite 初始化失败: {e}")
            return False
    
    def initSchema2_1(self) -> bool:
        """初始化 Schema 2.1 (SQLite 版本)"""
        if not self._initialized:
            self.initialize()
        
        schema_sql = '''
        -- Users 表
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            auth_provider TEXT NOT NULL DEFAULT 'email',
            provider_id TEXT,
            subscription_tier TEXT DEFAULT 'free',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Companions 表
        CREATE TABLE IF NOT EXISTS companions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            gender TEXT DEFAULT 'other',
            
            -- 属性系统 5+1+1
            appearance INTEGER NOT NULL DEFAULT 50,
            luck INTEGER NOT NULL DEFAULT 50,
            
            -- 五维初始值
            strength INTEGER DEFAULT 50,
            intelligence INTEGER DEFAULT 50,
            charisma INTEGER DEFAULT 50,
            
            -- JSON 存储字段
            personality TEXT NOT NULL DEFAULT '{}',
            appearance_config TEXT DEFAULT '{}',
            voice_config TEXT DEFAULT '{}',
            
            relationship_level INTEGER DEFAULT 0,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        -- Stats 表
        CREATE TABLE IF NOT EXISTS stats (
            id TEXT PRIMARY KEY,
            character_id TEXT NOT NULL,
            stats_type TEXT NOT NULL DEFAULT 'initial',
            
            strength INTEGER,
            intelligence INTEGER,
            charisma INTEGER,
            appearance INTEGER,
            luck INTEGER,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (character_id) REFERENCES companions(id) ON DELETE CASCADE
        );
        
        -- Messages 表
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            companion_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE
        );
        
        -- Hidden Events 表
        CREATE TABLE IF NOT EXISTS hidden_events (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            companion_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            description TEXT,
            luck_required INTEGER NOT NULL,
            triggered BOOLEAN DEFAULT 0,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (companion_id) REFERENCES companions(id) ON DELETE CASCADE
        );
        
        -- Items 表
        CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            character_id TEXT REFERENCES companions(id),
            name TEXT NOT NULL,
            item_type TEXT DEFAULT 'basic',
            rarity INTEGER DEFAULT 1,
            stats TEXT NOT NULL DEFAULT '{}',
            effect_description TEXT,
            icon_url TEXT,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS idx_messages_user_companion_time 
            ON messages(user_id, companion_id, created_at DESC);
        
        CREATE INDEX IF NOT EXISTS idx_stats_character 
            ON stats(character_id, stats_type);
        
        CREATE INDEX IF NOT EXISTS idx_items_user_rarity 
            ON items(user_id, rarity DESC);
        '''
        
        try:
            cursor = self.conn.cursor()
            cursor.executescript(schema_sql)
            self.conn.commit()
            
            print("\n✅ Schema 2.1 创建完成 (SQLite 版本)")
            print("📊 已创建表:")
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name!='sqlite_sequence'
                ORDER BY name
            """)
            tables = cursor.fetchall()
            for table in tables:
                print(f"  • {table[0]}")
            
            # 插入示例数据
            self.insert_sample_data()
            
            return True
        except Exception as e:
            print(f"❌ Schema 初始化失败: {e}")
            return False
    
    def insert_sample_data(self):
        """插入示例数据"""
        cursor = self.conn.cursor()
        
        # 示例用户
        user_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT OR IGNORE INTO users (id, email, auth_provider, subscription_tier)
            VALUES (?, ?, ?, ?)
        ''', (user_id, 'test@ai-companion.io', 'email', 'free'))
        
        # 示例角色：Luna
        luna_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO companions 
            (id, user_id, name, gender, appearance, luck, 
             personality, appearance_config, relationship_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            luna_id,
            user_id,
            'Luna',
            'female',
            95,
            90,  # High luck (hidden)
            json.dumps({
                'traits': ['warm', 'curious', 'playful'],
                'speakingStyle': 'casual'
            }),
            json.dumps({
                'hair': 'long wavy silver',
                'eyes': 'blue',
                'style': 'casual elegant'
            }),
            0
        ))
        
        # 示例角色：Max
        max_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO companions 
            (id, user_id, name, gender, appearance, luck, 
             personality, appearance_config, relationship_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            max_id,
            user_id,
            'Max',
            'male',
            70,
            50,  # Medium luck (hidden)
            json.dumps({
                'traits': ['adventurous', 'daring', 'humorous'],
                'speakingStyle': 'direct'
            }),
            json.dumps({
                'hair': 'short brown',
                'eyes': 'brown',
                'style': 'practical'
            }),
            0
        ))
        
        self.conn.commit()
        print("✅ 示例数据已插入")
        print("  • 用户: test@ai-companion.io")
        print("  • 角色 Luna (appearance 95, luck 90)")
        print("  • 角色 Max (appearance 70, luck 50)")
    
    def get_companions(self, user_id: str) -> list:
        """获取用户的所有角色 (过滤 luck)"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id, name, gender, appearance, 
                   personality, appearance_config, relationship_level
            FROM companions
            WHERE user_id = ?
            ORDER BY created_at DESC
        ''', (user_id,))
        
        companions = []
        for row in cursor.fetchall():
            companions.append({
                'id': row[0],
                'name': row[1],
                'gender': row[2],
                'appearance': row[3],
                'personality': json.loads(row[4]),
                'appearance_config': json.loads(row[5]),
                'relationshipLevel': row[6]
            })
        
        return companions
    
    def create_character(
        self,
        user_id: str,
        name: str,
        gender: str,
        appearance: int,
        luck: int,
        personality: dict,
        appearance_config: dict
    ) -> dict:
        """创建 AI 伴侣角色"""
        cursor = self.conn.cursor()
        
        character_id = str(uuid.uuid4())
        
        try:
            cursor.execute('''
                INSERT INTO companions 
                (id, user_id, name, gender, appearance, luck, 
                 personality, appearance_config, relationship_level)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                character_id,
                user_id,
                name,
                gender,
                appearance,
                luck,
                json.dumps(personality),
                json.dumps(appearance_config),
                0
            ))
            
            self.conn.commit()
            
            print(f"✅ 角色「{name}」已创建")
            print(f"   ✨ 颜值 (APP): {appearance}/100")
            print(f"   🔒 幸运 (LCK): {luck}/100")
            
            return {
                'characterId': character_id,
                'appearance': appearance,
                'luck': luck
            }
        except Exception as e:
            print(f"❌ 创建角色失败: {e}")
            return None
    
    def save_message(
        self,
        user_id: str,
        companion_id: str,
        role: str,
        content: str,
        metadata: dict = None
    ):
        """保存对话消息"""
        cursor = self.conn.cursor()
        
        cursor.execute('''
            INSERT INTO messages (id, user_id, companion_id, role, content, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            str(uuid.uuid4()),
            user_id,
            companion_id,
            role,
            content,
            json.dumps(metadata or {})
        ))
        
        self.conn.commit()
        
    def close(self):
        """关闭数据库连接"""
        if self.conn:
            self.conn.close()
            print("🔌 数据库连接已关闭")

# ===== 简化测试 =====

def test_database():
    """测试数据库功能"""
    print("\n" + "=" * 60)
    print("🧪 数据库功能测试")
    print("=" * 60 + "\n")
    
    db = DatabaseServiceSQLite()
    
    # 1. 初始化
    print("1️⃣ 初始化数据库...")
    if db.initialize():
        print("✅ 数据库初始化成功\n")
    else:
        return False
    
    # 2. 创建 Schema
    print("2️⃣ 创建 Schema 2.1...")
    if db.initSchema2_1():
        print("✅ Schema 创建完成\n")
    else:
        return False
    
    # 3. 测试查询
    print("3️⃣ 测试查询角色...")
    user_id = 'test-user-id'
    companions = db.get_companions(user_id)
    print(f"✅ 找到 {len(companions)} 个角色")
    for companion in companions:
        print(f"  • {companion['name']}: 颜值 {companion['appearance']}")
    print()
    
    # 4. 测试创建角色
    print("4️⃣ 测试创建角色...")
    new_character = db.create_character(
        user_id=user_id,
        name='Test Companion',
        gender='other',
        appearance=80,
        luck=75,
        personality={'traits': ['test'], 'speakingStyle': 'casual'},
        appearance_config={'hair': 'test', 'eyes': 'test', 'style': 'test'}
    )
    
    if new_character:
        print("✅ 角色创建测试完成\n")
    else:
        print("❌ 角色创建测试失败\n")
        return False
    
    # 5. 测试保存消息
    print("5️⃣ 测试保存消息...")
    try:
        db.save_message(
            user_id=user_id,
            companion_id=new_character['characterId'],
            role='user',
            content='Hello AI Companion!',
            metadata={'test': True}
        )
        print("✅ 消息保存测试完成\n")
    except Exception as e:
        print(f"❌ 消息保存测试失败: {e}\n")
        return False
    
    db.close()
    
    print("=" * 60)
    print("✅ 所有测试通过！")
    print("=" * 60 + "\n")
    
    return True

if __name__ == '__main__':
    import sys
    success = test_database()
    sys.exit(0 if success else 1)
