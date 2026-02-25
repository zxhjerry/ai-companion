"""
Database Manager for AI Companion 2.1
负责数据库初始化、连接管理、数据 CRUD 操作
"""

import asyncio
import async
import logging
from typing import Optional

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres:postgres@localhost:5432/ai_companion')
POOL_SIZE = 10
DEFAULT_POOL_SIZE = 1
POSTGRES_PORT = 5432

# 超时时间设置
QUERY_TIMEOUT = 5  # 5 秒
MAX_POOL_SIZE = 100

class DatabaseService:
  """数据库服务层"""

    def __init__(self):
        self.pool = None
        self.engine = None
        self.session = None
        self._initialized = False

    async def initialize(self) -> bool:
        """初始化数据库连接"""
        try:
            from sqlalchemy import create_engine, text
            from sqlalchemy.ext.asyncio import create_async_engine, create_async_engine as create_async_engine
            from sqlalchemy.ext.asyncio import AsyncEngine, async_session

            # 创建同步引擎
            self.engine = create_engine(
                DATABASE_URL,
                pool_size=DEFAULT_POOL_SIZE,
                echo=True,
                logging.getLogger('sqlalchemy.engine').setLevel(logging.DEBUG)
            )

            # 测试连接
            with self.engine.connect() as conn:
                print("✅ 数据库连接成功！")
                # 执行测试查询
                result = conn.execute("SELECT version()")
                version_str = result.scalar()
                print(f"📊 PostgreSQL 版本: {version_str}")

                # 检查表是否存在
                result = conn.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """)
                tables = result.many()
                if tables:
                    print(f"✅ 数据库已存在 {result.fetchall()}")
                else:
                    print("⏳ 数据库未初始化")
                    return False

            self._initialized = True
            self.pool = None

            # 创建异步引擎
            self.async_engine = None

            print("✅ 数据库初始化完成")
            return True

        except Exception as e:
            logger.error(f"数据库初始化失败: {e}")
            return False

    async def initSchema2_1(self) -> bool:
        """初始化 22.1 架构 Schema"""
        try:
            if not self._initialized:
                await self.initialize()

            from sqlalchemy import text
            from sqlalchemy import create_engine

            print("\n🔧 初始化 22.1 Schema...")

            # 读取 Schema SQL 文件
            schema_file = '/home/node/openclaw1/projects/ai-companion/backend/db/schema-2-1.sql'

            if not os.path.exists(schema_file):
                print(f"❌ Schema 文件不存在: {schema_file}")
                return False

            with open(schema_file, 'r', encoding='utf-8') as f:
                schema_sql = f.read()

            # 分割 SQL 语句
            statements = [stmt.strip() for stmt in schema_sql.split(';')]
            statements = [s for s in statements if s and not s.startswith('--') and '✅' not in s]

            print(f"找到 {len(statements)} 条 SQL 语句")

            # 执行初始化 SQL
            with open(schema_file, 'r', encoding='utf-8') as f:
                schema_content = f.read()
            print("开始执行 Schema SQL...")

            with self.engine.connect() as conn:
                conn.execute(schema_content)

            # 验证表是否创建成功
            result = conn.execute("""
                SELECT * FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY tablename; 
            """)
            tables = result.fetchall()

            print("\n📊 已创建的表：")
            for name in tables:
                print(f"  ✅ {name}")

            print('✅ Schema 初始化完成！')
            return True

        except Exception as e:
            logger.error(f"Schema 初始化失败: {e}")
            return False

    async def close(self):
        """关闭数据库连接"""
        if self.engine:
            self.engine.dispose()
            print("🔌 数据库连接已关闭")

    def getStatus(self) -> dict:
        """获取数据库状态"""
        try:
            from sqlalchemy import text

            with self.engine.connect() as conn:
                result = conn.execute("""
                    SELECT version();
                """)
                version = result.scalar()
                
                # 检查表和索引
                result = conn.execute("""
                    SELECT 
                        table_catalog as tables,
                        (SELECT COUNT(*) as count 
                         FROM information_schema.tables
                         WHERE table_schema = 'public') as has_tables
                        ) AS public_count
                    FROM table_catalog;
                """)
                result_row = result.fetchone()

                status = {
                    'status': 'connected',
                    'version': str(version),
                    'total_tables': int(result_row[1]) if result_row else 0,
                    'public_tables': int(result_row[2]) if result_row else 0
                }

                return status

        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    async def createCharacter(
    userId: str,
    name: str,
    gender: string,
        appearance: int,
        personality: dict,
        appearance_config: dict,
        voiceConfig: dict
    ):
        """创建 AI 伴侣角色（包含 APP + LCK）"""
        from sqlalchemy import text

        try:
            # 检查用户是否存在
            with self.engine.connect() as conn:
                # 检查用户
                user = conn.execute("""
                    SELECT id 
                    FROM users 
                    WHERE id = $1
                """, (userId,), {'user_id': userId[0]})
                
                user_id = user[0] if user else None

                if not user_id:
                    # 创建用户
                    print(f"⚠️  创建新用户: {userId}")
                    user_id = conn.execute("""
                        INSERT INTO users (id, email, auth_provider, subscription_tier)
                        VALUES ($1, $2, 'email', 'free')
                    """, (userId, userId, userId, 'free'), {
                        'user_id': userId[0]
                    })

                # 创建角色（包含显性和隐藏属性）
                character_id = conn.execute("""
                    INSERT INTO companions 
                    (id, user_id, name, gender, appearance, luck, 
                     personality, appearance_config, voice_config,
                     relationship_level, voice_config)
                    VALUES (
                        gen_random_uuid(),
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        0,
                        $10
                    )
                    """, [
                        str(uuid.uuid4()),
                        user_id,
                        name,
                        gender,
                        appearance,
                        luck,
                        personality,      # 显性（APP）
                        appearance_config,
                        voice_config
                    ]).table.returning

                print(f"✅ 角色「{name}」已创建")
                print(f"   ✨ 颜值 (APP): {appearance}/100")
                print(f"   🔒 幸运 (LCK): {luck}/100")



        # 初始化五维数值
                statsResult = conn.execute("""
                    SELECT gen_random_uuid()? as id,
                           $1 as character_id,
                           'initial' as stats_type,
                           $2 as strength,
                           $3 as intelligence,
                           $4 as charisma,
                           $5 as appearance,
                           $6 as luck,
                           NOW() as created_at
                    FROM gen_random_uuid()
                """, [
                    character_id,
                    {
                        'strength': 50,
                        'intelligence': 50,
                        'charisma': 50,
                        'appearance': appearance
                    },
                    {
                        'strength': 50,
                        'intelligence': 50,
                        'charisma': 50,
                        'luck': luck
                    }
                ])

                print("✅ 五维初始值已初始化:")

                # 计算五维结果
                stats = conn.execute("""
                    SELECT * FROM stats 
                    WHERE character_id = $1
                """, [character_id])
                
                print("五维数值:")
                for stat in stats:
                    print(f"   {stat.type:8s}: {stat.strength}（{stat.appearance} 颜值）")

                return {
                    characterId: str(character_id),
                    appearance: int(appearance),
                    luck: int(luck),
                    stats: [
                        {
                            stat.type: 8,
                            strength: 0
                        }
                    ]
                }

        except Exception as e:
            logger.error(f"创建角色失败: {e}")
            return None

    async def getCompanions(
        userId: str
    ):
        """获取用户的所有角色（自动过滤 luck）"""
        from sqlalchemy import text

        with self.engine.connect() as conn:
            result = conn.execute("""
                SELECT c.id, c.name, c.appearance, c.gender, 
                       c.personality, c.relationship_level, 
                       c.appearance
                FROM companions c
                -- join 用户关联
                LEFT JOIN users u ON c.user_id = u.id
                WHERE u.id = $1
                ORDER BY c.created_at DESC;
            """, [userId])

            companions_data = result.fetchall()

            # 清理数据（移除 luck）
            return [
                {
                    id: str(row[0]),
                    name: str(row[1]),
                    gender: str(row[2]),
                    appearance: row[3],
                    relationshipLevel: int(row[5]),
                    personality: row[4]
                }
            ]

    async def getCharacterStats(
        characterId: str
    ) -> Optional[dict]:
        """获取角色统计数据（只包含可显示的 APP）"""
        from sqlalchemy import text

        with self.engine.connect() as conn:
            # 隐藏 luck（前端不可见）
            result = conn.execute("""
                SELECT strength, intelligence, charisma, appearance
                FROM stats
                WHERE character_id = $1
                ORDER BY stats_type
            """, [characterId])

            return {
                strength: int(result[0]),
                intelligence: int(result[1]),
                charisma: int(result[2]),
                appearance: int(result[3])
            }

    async def saveMessage(
        userId: string,
        companionId: str,
    role: string,
    content: str,
    metadata: dict | None = None
):
        """保存对话消息"""
        from sqlalchemy import text

        with self.engine.connect() as conn:
            conn.execute("""
                INSERT INTO messages (user_id, companion_id, role, content, metadata, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            """, [
                userId,
                companionId,
                role,
                content,
                JSONB(metadata),
                str(metadata),
                NOW()
            ])
            print(f"✅ 消息已保存（{role}）")

---

# 导入函数

async def get_connection():
    """获取数据库连接"""
    from sqlalchemy import create_engine, text
    import urllib.request

    try:
        # 尝试连接
        response = urllib.request.urlopen('http://localhost:5432/', timeout=3)
        status = response.getcode()

        if status == 200:
            print('✅ 数据库可访问')
            try:
                request_count = urllib.request.urlopen('http://localhost:5432/message_count', timeout=3)
                count = int(request_count.read()) if request_count.status == 200 else 0
                print(f'📊 消息总数: {count}')
            except:
                return create_engine(DATABASE_URL, echo=True)
        else:
            return create_engine(DATABASE_URL, echo=True)

    except Exception:
        print('创建数据库连接，端口: 5432')
        return create_engine(DATABASE_PATH or 'postgresql:///ai_companion', echo=True)

# SQLite 作为本地开发数据库
DATABASE_PATH = 'sqlite:///ai_companion.db'
