"""
Memory Service - Phase 8: Short-Term and Long-Term Memory
短期和长期记忆系统
"""

import json
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from enum import Enum
import sqlite3

# 数据库连接
AI_CORE_DB_FILE = '/home/node/.openclaw1/projects/ai-companion/ai_companion.db'


class MemoryType(Enum):
    """记忆类型"""
    SYSTEM = 'system'       # 系统消息（角色信息等）
    USER = 'user'           # 用户消息
    ASSISTANT = 'assistant' # AI 回复
    CONTEXT = 'context'     # 上下文信息
    EVENT = 'event'         # 事件记录（隐藏事件、道具掉落等）
    SUMMARY = 'summary'     # 长期记忆摘要
    IMPORTANT = 'important' # 重要记忆（高重要性）


class Memory:
    """记忆对象"""
    def __init__(
        self,
        id: str,
        user_id: str,
        content: str,
        memory_type: MemoryType,
        importance: float = 0.5,
        timestamp: datetime = None,
        metadata: Optional[Dict] = None
    ):
        self.id = id
        self.user_id = user_id
        self.content = content
        self.memory_type = memory_type
        self.importance = importance  # 0.0-1.0
        self.timestamp = timestamp or datetime.now()
        self.metadata = metadata or {}

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'content': self.content,
            'memory_type': self.memory_type.value,
            'importance': self.importance,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata
        }


class MemoryService:
    """
    记忆系统服务
    功能：短期记忆（会话）、长期记忆（重要信息）
    """

    def __init__(self, db_file: str = AI_CORE_DB_FILE):
        self.db_file = db_file
        self.conn = None
        self._initialized = False

        # 短期记忆缓存（会话级别）
        self.session_cache: Dict[str, List[Memory]] = {}

    def initialize(self) -> bool:
        """初始化数据库连接"""
        try:
            self.conn = sqlite3.connect(self.db_file, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row
            self._initialized = True

            # 创建记忆表
            self._create_tables()

            return True
        except Exception as e:
            print(f"[MemoryService] 初始化失败: {e}")
            return False

    def _create_tables(self):
        """创建记忆相关表"""
        cursor = self.conn.cursor()

        # 记忆表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                character_id TEXT,
                content TEXT NOT NULL,
                memory_type TEXT NOT NULL,
                importance REAL DEFAULT 0.5,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT DEFAULT '{}',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (character_id) REFERENCES companions(id) ON DELETE CASCADE
            )
        ''')

        # 记忆索引
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_memories_user_type
                ON memories(user_id, memory_type, timestamp DESC)
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_memories_importance
                ON memories(importance DESC, timestamp DESC)
        ''')

        self.conn.commit()

    def add_memory(
        self,
        user_id: str,
        content: str,
        memory_type: MemoryType,
        character_id: Optional[str] = None,
        importance: float = 0.5,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        添加记忆（短期和长期）

        Args:
            user_id: 用户 ID
            content: 记忆内容
            memory_type: 记忆类型
            character_id: 可选，角色 ID
            importance: 重要性 0.0-1.0
            metadata: 元数据

        Returns:
            记忆 ID
        """
        if not self._initialized:
            self.initialize()

        cursor = self.conn.cursor()

        import uuid
        memory_id = str(uuid.uuid4())

        cursor.execute('''
            INSERT INTO memories
            (id, user_id, character_id, content, memory_type, importance, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (
            memory_id,
            user_id,
            character_id,
            content,
            memory_type.value,
            min(1.0, max(0.0, importance)),
            json.dumps(metadata or {})
        ))

        self.conn.commit()

        # 添加到短期记忆缓存
        if user_id not in self.session_cache:
            self.session_cache[user_id] = []

        memory = Memory(
            id=memory_id,
            user_id=user_id,
            content=content,
            memory_type=memory_type,
            importance=importance,
            timestamp=datetime.now(),
            metadata=metadata
        )

        self.session_cache[user_id].append(memory)

        return memory_id

    def get_recent_memories(
        self,
        user_id: str,
        memory_type: Optional[MemoryType] = None,
        character_id: Optional[str] = None,
        limit: int = 10
    ) -> List[Memory]:
        """
        获取最近的记忆（短期记忆）

        Args:
            user_id: 用户 ID
            memory_type: 可选，记忆类型过滤
            character_id: 可选，角色 ID 过滤
            limit: 返回数量

        Returns:
            记忆列表
        """
        if not self._initialized:
            self.initialize()

        # 先从缓存中查找
        if user_id in self.session_cache:
            cached_memories = self.session_cache[user_id]

            # 过滤
            if memory_type:
                cached_memories = [m for m in cached_memories if m.memory_type == memory_type]
            if character_id:
                cached_memories = [m for m in cached_memories if m.metadata.get('character_id') == character_id]

            # 返回最近的
            return cached_memories[-limit:]

        # 如果缓存中没有，从数据库查询
        cursor = self.conn.cursor()

        query = '''
            SELECT * FROM memories
            WHERE user_id = ?
        '''
        params = [user_id]

        if memory_type:
            query += ' AND memory_type = ?'
            params.append(memory_type.value)

        if character_id:
            query += ' AND character_id = ?'
            params.append(character_id)

        query += ' ORDER BY timestamp DESC LIMIT ?'
        params.append(limit)

        cursor.execute(query, params)

        memories = []
        for row in cursor.fetchall():
            memory = Memory(
                id=row['id'],
                user_id=row['user_id'],
                content=row['content'],
                memory_type=MemoryType(row['memory_type']),
                importance=row['importance'],
                timestamp=datetime.fromisoformat(row['timestamp']),
                metadata=json.loads(row['metadata'])
            )
            memories.append(memory)

        # 添加到缓存
        if user_id not in self.session_cache:
            self.session_cache[user_id] = []
        self.session_cache[user_id].extend(memories)

        return memories

    def get_important_memories(
        self,
        user_id: str,
        character_id: Optional[str] = None,
        limit: int = 20
    ) -> List[Memory]:
        """
        获取重要的长期记忆

        Args:
            user_id: 用户 ID
            character_id: 可选，角色 ID 过滤
            limit: 返回数量

        Returns:
            重要记忆列表
        """
        if not self._initialized:
            self.initialize()

        cursor = self.conn.cursor()

        query = '''
            SELECT * FROM memories
            WHERE user_id = ? AND importance >= 0.7
        '''
        params = [user_id]

        if character_id:
            query += ' AND character_id = ?'
            params.append(character_id)

        query += ' ORDER BY importance DESC, timestamp DESC LIMIT ?'
        params.append(limit)

        cursor.execute(query, params)

        memories = []
        for row in cursor.fetchall():
            memory = Memory(
                id=row['id'],
                user_id=row['user_id'],
                content=row['content'],
                memory_type=MemoryType(row['memory_type']),
                importance=row['importance'],
                timestamp=datetime.fromisoformat(row['timestamp']),
                metadata=json.loads(row['metadata'])
            )
            memories.append(memory)

        return memories

    def summarize_conversation(self, user_id: str, character_id: str) -> Optional[str]:
        """
        总结对话（生成长期记忆）

        Args:
            user_id: 用户 ID
            character_id: 角色 ID

        Returns:
            总结文本（如果生成成功）
        """
        # 获取最近的对话
        recent_memories = self.get_recent_memories(
            user_id=user_id,
            character_id=character_id,
            limit=20
        )

        if len(recent_memories) < 5:
            return None  # 对话太少，无需总结

        # TODO: 集成 LLM 进行总结
        # 这里使用简单实现：提取重要内容
        summary_parts = []

        for memory in recent_memories:
            if memory.importance >= 0.6:
                summary_parts.append(memory.content[:200])  # 截取前 200 字

        summary = ' '.join(summary_parts)

        if summary:
            # 保存总结为长期记忆
            self.add_memory(
                user_id=user_id,
                content=f"[对话总结] {summary}",
                memory_type=MemoryType.SUMMARY,
                character_id=character_id,
                importance=0.8,
                metadata={'auto_generated': True}
            )

        return summary

    def search_memories(
        self,
        user_id: str,
        query: str,
        limit: int = 10
    ) -> List[Memory]:
        """
        搜索记忆（关键词匹配）

        Args:
            user_id: 用户 ID
            query: 搜索关键词
            limit: 返回数量

        Returns:
            匹配的记忆列表
        """
        if not self._initialized:
            self.initialize()

        cursor = self.conn.cursor()

        # 使用 LIKE 进行简单搜索
        # 实际应用中应该使用向量搜索
        cursor.execute('''
            SELECT * FROM memories
            WHERE user_id = ? AND content LIKE ?
            ORDER BY importance DESC, timestamp DESC
            LIMIT ?
        ''', (user_id, f'%{query}%', limit))

        memories = []
        for row in cursor.fetchall():
            memory = Memory(
                id=row['id'],
                user_id=row['user_id'],
                content=row['content'],
                memory_type=MemoryType(row['memory_type']),
                importance=row['importance'],
                timestamp=datetime.fromisoformat(row['timestamp']),
                metadata=json.loads(row['metadata'])
            )
            memories.append(memory)

        return memories

    def cleanup_old_memories(self, user_id: str, days: int = 30):
        """清理旧记忆（低重要性）"""
        if not self._initialized:
            self.initialize()

        cursor = self.conn.cursor()

        cutoff_date = datetime.now() - timedelta(days=days)

        cursor.execute('''
            DELETE FROM memories
            WHERE user_id = ?
            AND timestamp < ?
            AND importance < 0.5
        ''', (user_id, cutoff_date.isoformat()))

        deleted_count = cursor.rowcount
        self.conn.commit()

        print(f"[MemoryService] 清理了 {deleted_count} 条旧记忆")

        return deleted_count


# ===== 测试脚本 =====

def test_memory_service() -> bool:
    """测试记忆系统"""
    print("\n" + "=" * 60)
    print("🧠 Memory Service 测试")
    print("=" * 60 + "\n")

    service = MemoryService()

    if not service.initialize():
        print("❌ 初始化失败")
        return False

    print("✅ Memory Service 初始化完成\n")

    # 测试添加记忆
    test_user_id = 'test-user-id'
    test_character_id = 'test-character-id'

    print("📝 测试添加记忆...\n")

    memory_id_1 = service.add_memory(
        user_id=test_user_id,
        content="用户说：我喜欢音乐",
        memory_type=MemoryType.USER,
        character_id=test_character_id,
        importance=0.3
    )
    print(f"✅ 添加记忆 1: {memory_id_1}")

    memory_id_2 = service.add_memory(
        user_id=test_user_id,
        content="AI 说：我也是音乐爱好者！",
        memory_type=MemoryType.ASSISTANT,
        character_id=test_character_id,
        importance=0.3
    )
    print(f"✅ 添加记忆 2: {memory_id_2}")

    memory_id_3 = service.add_memory(
        user_id=test_user_id,
        content="🎭 隐藏事件：角色的秘密往事浮出水面",
        memory_type=MemoryType.EVENT,
        character_id=test_character_id,
        importance=0.9,  # 重要记忆
        metadata={'event_type': 'hidden_story'}
    )
    print(f"✅ 添加记忆 3: {memory_id_3}")

    # 测试获取记忆
    print("\n📋 测试获取最近记忆...\n")

    recent_memories = service.get_recent_memories(
        user_id=test_user_id,
        character_id=test_character_id,
        limit=3
    )

    print(f"找到 {len(recent_memories)} 条最近记忆:")
    for memory in recent_memories:
        print(f"   • [{memory.memory_type.value}] {memory.content[:50]}...")

    # 测试获取重要记忆
    print("\n📋 测试获取重要记忆...\n")

    important_memories = service.get_important_memories(
        user_id=test_user_id,
        character_id=test_character_id,
        limit=5
    )

    print(f"找到 {len(important_memories)} 条重要记忆:")
    for memory in important_memories:
        print(f"   • [重要性 {memory.importance}] {memory.content[:50]}...")

    # 测试搜索记忆
    print("\n🔍 测试搜索记忆...\n")

    search_results = service.search_memories(
        user_id=test_user_id,
        query="音乐",
        limit=2
    )

    print(f"找到 {len(search_results)} 条匹配记忆:")
    for memory in search_results:
        print(f"   • {memory.content}")

    print("\n" + "=" * 60)
    print("✅ Memory Service 测试完成")
    print("=" * 60 + "\n")

    return True


if __name__ == '__main__':
    import sys
    success = test_memory_service()
    sys.exit(0 if success else 1)
