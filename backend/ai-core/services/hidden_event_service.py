"""
Hidden Event Service - Phase 3: AI Model Integration
LCK-driven hidden story event detection system
"""

import random
import sqlite3
from typing import List, Dict, Optional
from datetime import datetime
import os

# Database connection
AI_CORE_DB_FILE = '/home/node/.openclaw1/projects/ai-companion/ai_companion.db'


class HiddenEventService:
    """LCK-driven hidden event detector for AI Companion 2.1"""

    # 隐藏事件类型定义
    HIDDEN_EVENT_TYPES = {
        'secret_revelation': {
            'name': '隐藏秘密揭露',
            'luck_threshold': 80,
            'cooldown_days': 7,
            'description': '角色的秘密往事被触发',
            'impact': 'relationship_level +5'
        },
        'special_gift': {
            'name': '特殊礼物',
            'luck_threshold': 70,
            'cooldown_days': 3,
            'description': '角色赠送稀有物品',
            'impact': 'item_gain'
        },
        'rare_dialogue': {
            'name': '稀有对话',
            'luck_threshold': 60,
            'cooldown_days': 1,
            'description': '触发角色独特的语言模式',
            'impact': 'dialogue_modification'
        },
        'fortune_boost': {
            'name': '幸运加成',
            'luck_threshold': 90,
            'cooldown_days': 30,
            'description': '角色的幸运值提升 10 点',
            'impact': 'luck +10'
        },
        'hidden_scenario': {
            'name': '隐藏剧情分支',
            'luck_threshold': 85,
            'cooldown_days': 14,
            'description': '进入角色隐藏的世界分支',
            'impact': 'new_story_branch'
        },
        'item_discovery': {
            'name': '发现道具',
            'luck_threshold': 65,
            'cooldown_days': 2,
            'description': '找到隐藏的道具（受 LCK 影响稀有度）',
            'impact': 'item_gain'
        }
    }

    def __init__(self, db_file: str = AI_CORE_DB_FILE):
        self.db_file = db_file
        self.conn = None
        self._initialized = False

    def initialize(self) -> bool:
        """初始化数据库连接"""
        try:
            self.conn = sqlite3.connect(self.db_file, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row
            self._initialized = True
            return True
        except Exception as e:
            print(f"[HiddenEventService] 初始化失败: {e}")
            return False

    def check_trigger(
        self,
        user_id: str,
        companion_id: str,
        luck_value: int
    ) -> Optional[Dict]:
        """
        检查并触发隐藏事件（基于 LCK）

        Args:
            user_id: 用户 ID
            companion_id: 角色 ID
            luck_value: 角色的幸运值 (LCK)

        Returns:
            触发的隐藏事件信息（如果有）
        """
        if not self._initialized:
            self.initialize()

        # 1. 尝试触发随机事件
        eligible_events = []

        # 检查所有事件类型
        for event_type, event_data in self.HIDDEN_EVENT_TYPES.items():
            # 检查 LCK 阈值是否满足
            if luck_value >= event_data['luck_threshold']:
                # 检查冷却时间
                if self._check_cooldown(user_id, companion_id, event_type):
                    eligible_events.append(event_type)

        # 2. 从符合条件的事件中随机触发一个（概率受 LCK 影响）
        for event_type in eligible_events:
            event_data = self.HIDDEN_EVENT_TYPES[event_type]

            # 成功率计算：基础 50% + (LCK - threshold) * 2%
            success_rate = min(95, 50 + (luck_value - event_data['luck_threshold']) * 2)

            # 尝试触发（随机数检查）
            if random.randint(1, 100) <= int(success_rate):
                # 成功触发
                triggered_event = self._trigger_event(
                    user_id,
                    companion_id,
                    event_type,
                    lucky_value=luck_value
                )

                return triggered_event

        # 3. 触发失败
        return None

    def _check_cooldown(
        self,
        user_id: str,
        companion_id: str,
        event_type: str
    ) -> bool:
        """检查事件冷却时间"""
        cursor = self.conn.cursor()

        # 检查最近一次触发时间
        cursor.execute('''
            SELECT MAX(timestamp) as last_trigger
            FROM hidden_events
            WHERE user_id = ? AND companion_id = ? AND event_type = ?
        ''', (user_id, companion_id, event_type))

        result = cursor.fetchone()

        if result['last_trigger']:
            last_trigger = datetime.strptime(result['last_trigger'], '%Y-%m-%d %H:%M:%S')
            cooldown_days = self.HIDDEN_EVENT_TYPES[event_type]['cooldown_days']

            # 检查是否在冷却时间内
            time_diff = (datetime.now() - last_trigger).days

            if time_diff < cooldown_days:
                return False

        return True

    def _trigger_event(
        self,
        user_id: str,
        companion_id: str,
        event_type: str,
        lucky_value: int = 50
    ) -> Dict:
        """
        触发隐藏事件

        Returns:
            触发的事件数据
        """
        cursor = self.conn.cursor()

        # 创建隐藏事件记录
        event_id = str(random.randint(1000000, 9999999))
        event_data = self.HIDDEN_EVENT_TYPES[event_type]

        cursor.execute('''
            INSERT INTO hidden_events
            (id, user_id, companion_id, event_type, description, luck_required, triggered, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        ''', (
            event_id,
            user_id,
            companion_id,
            event_type,
            event_data['description'],
            event_data['luck_threshold'],
            datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        ))

        self.conn.commit()

        triggered_event = {
            'event_id': event_id,
            'event_type': event_type,
            'event_data': event_data,
            'description': event_data['description'],
            'impact': event_data['impact'],
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'lucky_value': lucky_value
        }

        print(f"\n🎁 隐藏事件触发: {event_data['name']}")
        print(f"   👑 角色 LCK: {lucky_value} (阈值: {event_data['luck_threshold']})")
        print(f"   📊 影响: {event_data['impact']}")

        return triggered_event

    def get_active_events(
        self,
        user_id: str,
        companion_id: str
    ) -> List[Dict]:
        """获取角色历史触发的隐藏事件"""
        cursor = self.conn.cursor()

        cursor.execute('''
            SELECT * FROM hidden_events
            WHERE user_id = ? AND companion_id = ?
            ORDER BY timestamp DESC
            LIMIT 10
        ''', (user_id, companion_id))

        events = []
        for row in cursor.fetchall():
            events.append({
                'event_id': row['id'],
                'event_type': row['event_type'],
                'description': row['description'],
                'luck_required': row['luck_required'],
                'triggered': bool(row['triggered']),
                'timestamp': row['timestamp']
            })

        return events

    def test_luck_trigger(self, luck: int, iterations: int = 10) -> Dict:
        """测试隐藏事件触发概率"""
        print(f"\n" + "=" * 60)
        print(f"🧪 隐藏事件触发概率测试")
        print(f"🔍 LCK 值: {luck}")
        print(f"📊 测试次数: {iterations}")
        print("=" * 60 + "\n")

        trigger_counts = {}
        total_triggers = 0

        test_user_id = 'test-user-id'
        test_companion_id = f'test-{random.randint(10000, 99999)}'

        # 创建测试角色
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO companions (id, user_id, name, gender, appearance, luck, personality)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            test_companion_id,
            test_user_id,
            f'Test Companion {luck}',
            'other',
            50,
            luck,
            '{}'
        ))
        self.conn.commit()

        # 迭代测试
        for i in range(iterations):
            event = self.check_trigger(
                user_id=test_user_id,
                companion_id=test_companion_id,
                luck_value=luck
            )

            if event:
                total_triggers += 1
                event_type = event['event_type']

                if event_type not in trigger_counts:
                    trigger_counts[event_type] = 0
                trigger_counts[event_type] += 1

        # 清理测试数据
        cursor.execute('DELETE FROM hidden_events WHERE user_id = ? AND companion_id = ?',
                      (test_user_id, test_companion_id))
        cursor.execute('DELETE FROM companions WHERE id = ?', (test_companion_id,))
        self.conn.commit()

        # 打印结果
        print(f"\n📊 触发统计 (LCK {luck}):")
        print(f"   总触发次数: {total_triggers}/{iterations} ({total_triggers/iterations*100:.1f}%)")

        if trigger_counts:
            print(f"   触发事件分布:")
            for event_type, count in trigger_counts.items():
                event_name = self.HIDDEN_EVENT_TYPES[event_type]['name']
                print(f"     • {event_name}: {count} 次 ({count/total_triggers*100:.1f}%)")

        # 预期成功率对比
        print(f"\n📈 预期成功率:")
        active_events = []
        for event_type, event_data in self.HIDDEN_EVENT_TYPES.items():
            if luck >= event_data['luck_threshold']:
                expected_rate = min(95, 50 + (luck - event_data['luck_threshold']) * 2)
                active_events.append(f"{event_data['name']}: {expected_rate:.1f}%")

        if active_events:
            for event in active_events:
                print(f"   • {event}")
        else:
            print(f"   ⚠️  LCK {luck} 低于所有事件阈值，无法触发")

        print()

        return {
            'luck': luck,
            'total_triggers': total_triggers,
            'trigger_counts': trigger_counts,
            'active_events': active_events
        }

    def close(self):
        """关闭数据库连接"""
        if self.conn:
            self.conn.close()
            self._initialized = False
            print("[HiddenEventService] 连接已关闭")


# ===== 测试脚本 =====

def test_hidden_event_detection():
    """测试隐藏事件检测功能"""
    print("\n" + "=" * 60)
    print("🎭 AI Companion 2.1 - 隐藏事件检测测试")
    print("=" * 60 + "\n")

    service = HiddenEventService()

    if not service.initialize():
        print("❌ 初始化失败")
        return False

    print("✅ Hidden Event Service 初始化完成\n")

    # 测试不同 LCK 值的触发概率
    luck_values = [40, 60, 70, 80, 90, 100]

    for luck in luck_values:
        print(f"\n{'=' * 60}")
        print(f"测试 LCK = {luck}\n")
        service.test_luck_trigger(luck)
        print(f"{'=' * 60}\n")

    service.close()

    print("=" * 60)
    print("✅ 隐藏事件检测测试完成")
    print("=" * 60 + "\n")

    return True


if __name__ == '__main__':
    import sys
    success = test_hidden_event_detection()
    sys.exit(0 if success else 1)
