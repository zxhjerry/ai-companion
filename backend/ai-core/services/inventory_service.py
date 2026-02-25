"""
Inventory Service - Phase 6: Item Drop System
LCK-driven item rarity and drop probability system
"""

import random
import sqlite3
import json
from typing import List, Dict, Optional
from enum import Enum
from datetime import datetime

# 数据库连接
AI_CORE_DB_FILE = '/home/node/.openclaw1/projects/ai-companion/ai_companion.db'


class ItemRarity(Enum):
    """稀有度等级"""
    COMMON = (1, 20, 'common')         # 1-20      (常见)
    UNCOMMON = (21, 50, 'uncommon')     # 21-50     (不常见)
    RARE = (51, 80, 'rare')            # 51-80     (稀有)
    EPIC = (81, 95, 'epic')            # 81-95     (史诗)
    LEGENDARY = (96, 100, 'legendary') # 96-100   (传说)

    def __init__(self, min_val, max_val, rarity_name):
        self.min_val = min_val
        self.max_val = max_val
        self.rarity_name = rarity_name


class ItemType(Enum):
    """道具类型"""
    WEAPON = 'weapon'
    ARMOR = 'armor'
    ACCESSORY = 'accessory'
    POTION = 'potion'
    MATERIAL = 'material'
    SPECIAL = 'special'
    GIFT = 'gift'


# ===== 道具配置 =====

ITEM_POOL = {
    # 武器
    'weapon': [
        {'name': 'Rusty Sword', 'type': 'weapon', 'rarity': 1, 'stats': {'strength': 10, 'power': 20}},
        {'name': 'Iron Spear', 'type': 'weapon', 'rarity': 15, 'stats': {'strength': 20, 'power': 30}},
        {'name': 'Blade of Dawn', 'type': 'weapon', 'rarity': 60, 'stats': {'strength': 40, 'power': 60}},
        {'name': 'Celestial Excalibur', 'type': 'weapon', 'rarity': 85, 'stats': {'strength': 80, 'power': 95}},
        {'name': 'Divine Sword of Creation', 'type': 'weapon', 'rarity': 98, 'stats': {'strength': 100, 'power': 100, 'luck': 20}}
    ],
    # 护甲
    'armor': [
        {'name': 'Leather Vest', 'type': 'armor', 'rarity': 3, 'stats': {'defense': 15, 'charm': 5}},
        {'name': 'Steel Plate', 'type': 'armor', 'rarity': 25, 'stats': {'defense': 35, 'charm': 10}},
        {'name': 'Dragon Scale Armor', 'type': 'armor', 'rarity': 65, 'stats': {'defense': 70, 'charm': 25}},
        {'name': 'Guardians Plate', 'type': 'armor', 'rarity': 90, 'stats': {'defense': 90, 'charm': 40, 'luck': 10}}
    ],
    # 配饰
    'accessory': [
        {'name': 'Simple Ring', 'type': 'accessory', 'rarity': 2, 'stats': {'charm': 10}},
        {'name': 'Silver Amulet', 'type': 'accessory', 'rarity': 20, 'stats': {'charm': 20, 'defense': 15}},
        {'name': 'Ethereal Necklace', 'type': 'accessory', 'rarity': 55, 'stats': {'charm': 45, 'defense': 30}},
        {'name': 'Starlight Crown', 'type': 'accessory', 'rarity': 95, 'stats': {'charm': 90, 'intelligence': 80, 'luck': 15}}
    ],
    # 药水
    'potion': [
        {'name': 'Health Potion', 'type': 'potion', 'rarity': 3, 'stats': {'heal': 20}},
        {'name': 'Mana Potion', 'type': 'potion', 'rarity': 8, 'stats': {'mana': 30}},
        {'name': 'Elixir of Life', 'type': 'potion', 'rarity': 70, 'stats': {'heal': 80, 'mana': 50}},
        {'name': 'Ambrosia of Immortality', 'type': 'potion', 'rarity': 97, 'stats': {'heal': 100, 'mana': 100, 'charm': 30}}
    ],
    # 材料
    'material': [
        {'name': 'Iron Ingot', 'type': 'material', 'rarity': 5, 'stats': {'craft': 10}},
        {'name': 'Mythril Core', 'type': 'material', 'rarity': 45, 'stats': {'craft': 40}},
        {'name': 'Dragon Scale', 'type': 'material', 'rarity': 80, 'stats': {'craft': 70, 'defense': 30}},
        {'name': 'Essence of Creation', 'type': 'material', 'rarity': 99, 'stats': {'craft': 100, 'power': 100, 'luck': 25}}
    ],
    # 特殊物品
    'special': [
        {'name': 'Ancient Scroll', 'type': 'special', 'rarity': 40, 'stats': {'knowledge': 50}},
        {'name': 'Crystal of Destiny', 'type': 'special', 'rarity': 85, 'stats': {'luck': 30, 'charm': 60}},
        {'name': 'The Chronosphere', 'type': 'special', 'rarity': 100, 'stats': {'power': 100, 'luck': 100, 'charm': 100, 'strength': 100, 'intelligence': 100}}
    ]
}


# ===== 核心服务 =====

class InventoryService:
    """LCK-driven inventory and item drop system for AI Companion 2.1"""

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
            print(f"[InventoryService] 初始化失败: {e}")
            return False

    def check_item_drop(
        self,
        user_id: str,
        companion_id: str,
        luck: int,
        event_type: Optional[str] = None
    ) -> Optional[Dict]:
        """
        基于角色的幸运值 (LCK) 检查是否掉落道具

        Args:
            user_id: 用户 ID
            companion_id: 角色 ID
            luck: 角色的幸运值 (LCK)
            event_type: 触发掉落的事件类型（可选）

        Returns:
            掉落的道具数据（如果有）
        """
        if not self._initialized:
            self.initialize()

        # 1. 基础掉落概率计算（LCK 驱动）
        base_drop_chance = self._calculate_drop_chance(luck)

        # 2. 事件类型加成
        if event_type == 'special_gift':
            base_drop_chance += 20
        elif event_type == 'item_discovery':
            base_drop_chance += 30
        elif event_type == 'hidden_scenario':
            base_drop_chance += 40

        # 3. 随机决定是否掉落
        drop_chance = min(95, base_drop_chance)
        if random.randint(1, 100) <= int(drop_chance):
            # 掉落成功
            item = self._generate_item(luck, event_type)
            
            # 保存到数据库
            if item:
                item_record = self._add_to_inventory(
                    user_id=user_id,
                    companion_id=companion_id,
                    item=item
                )
                
                return item_record

        return None

    def _calculate_drop_chance(self, luck: int) -> float:
        """
        计算基础掉落概率（LCK 驱动）

        Args:
            luck: 幸运值 1-100

        Returns:
            基础掉落概率 (%) 0-95
        """
        if luck < 30:
            # 低幸运：掉落率 5-15%
            return 5 + (luck / 30) * 10
        elif luck < 60:
            # 中等幸运：掉落率 15-40%
            return 15 + ((luck - 30) / 30) * 25
        elif luck < 80:
            # 高幸运：掉落率 40-70%
            return 40 + ((luck - 60) / 20) * 30
        else:
            # 欧皇级别：掉落率 70-95%
            return 70 + ((luck - 80) / 20) * 25

    def _generate_item(self, luck: int, event_type: Optional[str] = None) -> Dict:
        """
        生成道具（稀有度受 LCK 影响）

        Args:
            luck: 幸运值 1-100
            event_type: 触发事件类型（可选）

        Returns:
            生成的道具数据
        """
        # 1. 决定稀有度（LCK 驱动）
        rarity_score = self._calculate_rarity(luck, event_type)
        
        # 2. 在道具池中选择对应稀有度的道具
        selected_item = self._select_item_by_rarity(rarity_score)
        
        if not selected_item:
            # 生成默认道具
            selected_item = {
                'name': 'Generic Item',
                'type': 'special',
                'rarity': 1,
                'stats': {'power': 10}
            }
        
        # 3. 应用 LCK 加成到 stats
        augmented_stats = self._augment_stats(selected_item['stats'], luck)
        
        return {
            'name': selected_item['name'],
            'type': selected_item['type'],
            'rarity': rarity_score,
            'stats': augmented_stats,
            'effect_description': f"Rare item granting {', '.join([f'{k}+{v}' for k, v in augmented_stats.items()])} bonuses.",
            'icon_url': f"/items/{selected_item['type']}/{selected_item['rarity']}.png"
        }

    def _calculate_rarity(self, luck: int, event_type: Optional[str] = None) -> int:
        """
        计算道具稀有度（LCK 驱动）

        Args:
            luck: 幸运值 1-100
            event_type: 事件类型（加成）

        Returns:
            稀有度分数 1-100
        """
        # 基础稀有度：LCK / 2 (随机 0-50)
        base_rarity = random.randint(0, 50) + (luck / 2)
        
        # 事件类型加成
        if event_type == 'special_gift':
            base_rarity += 10
        elif event_type == 'item_discovery':
            base_rarity += 5
        elif event_type == 'hidden_scenario':
            base_rarity += 20
        elif event_type == 'fortune_boost':
            base_rarity += 30
        
        # Clamp 到 1-100
        rarity_score = max(1, min(100, int(base_rarity)))
        
        return rarity_score

    def _select_item_by_rarity(self, rarity_score: int) -> Optional[Dict]:
        """
        从道具池中选择对应稀有度的道具

        Args:
            rarity_score: 稀有度分数 1-100

        Returns:
            选择的道具
        """
        # 确定稀有度等级
        rarity_class = self._get_rarity_class(rarity_score)
        
        # 从道具池中随机选择
        items_in_pool = []
        
        for item_type, items in ITEM_POOL.items():
            for item in items:
                item_rarity_class = self._get_rarity_class(item['rarity'])
                
                # 匹配稀有度等级
                if item_rarity_class == rarity_class:
                    items_in_pool.append(item)
        
        if items_in_pool:
            # 随机选择
            return random.choice(items_in_pool)
        
        return None

    def _get_rarity_class(self, rarity_score: int) -> ItemRarity:
        """根据稀有度分数返回稀有度等级"""
        for rarity_class in ItemRarity:
            if rarity_class.min_val <= rarity_score <= rarity_class.max_val:
                return rarity_class
        return ItemRarity.COMMON

    def _augment_stats(self, stats: Dict, luck: int) -> Dict:
        """
        根据 LCK 加成道具属性

        Args:
            stats: 原始属性
            luck: 幸运值

        Returns:
            加成后的属性
        """
        augmented = stats.copy()
        
        for stat_name, base_value in stats.items():
            # 加成计算：base + (base * luck / 100)
            bonus = int(base_value * (luck / 100))
            augmented[stat_name] = base_value + bonus
        
        return augmented

    def _add_to_inventory(
        self,
        user_id: str,
        companion_id: str,
        item: Dict
    ) -> Dict:
        """
        添加道具到背包

        Args:
            user_id: 用户 ID
            companion_id: 角色 ID（实际使用 character_id）
            item: 道具数据

        Returns:
            记录的道具数据
        """
        cursor = self.conn.cursor()
        
        item_id = str(random.randint(1000000, 9999999))
        
        cursor.execute('''
            INSERT INTO items
            (id, user_id, character_id, name, item_type, rarity, stats, effect_description, icon_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ''', (
            item_id,
            user_id,
            companion_id,
            item['name'],
            item['type'],
            item['rarity'],
            json.dumps(item['stats']),
            item['effect_description'],
            item.get('icon_url', '')
        ))
        
        self.conn.commit()
        
        return {
            'item_id': item_id,
            'name': item['name'],
            'type': item['type'],
            'rarity': item['rarity'],
            'stats': item['stats']
        }

    def get_inventory(
        self,
        user_id: str,
        companion_id: Optional[str] = None
    ) -> List[Dict]:
        """
        获取用户背包中的道具

        Args:
            user_id: 用户 ID
            companion_id: 可选，指定角色的道具

        Returns:
            道具列表
        """
        if not self._initialized:
            self.initialize()
        
        cursor = self.conn.cursor()
        
        if companion_id:
            cursor.execute('''
                SELECT * FROM items
                WHERE user_id = ? AND companion_id = ?
                ORDER BY rarity DESC, created_at DESC
            ''', (user_id, companion_id))
        else:
            cursor.execute('''
                SELECT * FROM items
                WHERE user_id = ?
                ORDER BY rarity DESC, created_at DESC
            ''', (user_id,))
        
        items = []
        for row in cursor.fetchall():
            items.append({
                'item_id': row['id'],
                'name': row['name'],
                'type': row['item_type'],
                'rarity': row['rarity'],
                'stats': json.loads(row['stats']),
                'effect_description': row['effect_description'],
                'icon_url': row['icon_url'],
                'created_at': row['created_at']
            })
        
        return items

    def use_item(
        self,
        item_id: str,
        user_id: str
    ) -> Optional[Dict]:
        """
        使用道具

        Args:
            item_id: 道具 ID
            user_id: 用户 ID

        Returns:
            使用效果
        """
        if not self._initialized:
            self.initialize()
        
        cursor = self.conn.cursor()
        
        # 获取道具
        cursor.execute('''
            SELECT * FROM items
            WHERE id = ? AND user_id = ?
        ''', (item_id, user_id))
        
        item = cursor.fetchone()
        
        if not item:
            return None
        
        # 应用道具效果
        item_stats = json.loads(item['stats'])
        
        # 计算效果
        effect_result = item_stats
        
        # 从背包移除道具（如果是一次性道具）
        if item['item_type'] in ['potion', 'material', 'special']:
            cursor.execute('''
                DELETE FROM items
                WHERE id = ? AND user_id = ?
            ''', (item_id, user_id))
            self.conn.commit()
        
        return {
            'item_name': item['name'],
            'effect': effect_result,
            'deleted': item['item_type'] in ['potion', 'material', 'special']
        }

    def test_item_drop(self):
        """测试道具掉落系统"""
        print("\n" + "=" * 60)
        print("🎒 背包道具系统测试")
        print("=" * 60 + "\n")

        service = InventoryService()
        
        if not service.initialize():
            print("❌ 初始化失败")
            return False
        
        print("✅ Inventory Service 初始化完成\n")
        
        # 测试不同 LCK 值的掉落概率
        luck_values = [20, 40, 60, 80, 100]
        test_iterations = 10
        
        for luck in luck_values:
            print(f"\n{'=' * 60}")
            print(f"测试 LCK = {luck}（迭代 {test_iterations} 次）")
            print(f"{'=' * 60}\n")
            
            test_user_id = f'test-{luck}'
            test_companion_id = f'test-companion-{luck}'
            
            drops = []
            
            for i in range(test_iterations):
                # 模拟道具掉落
                drop_item = service.check_item_drop(
                    user_id=test_user_id,
                    companion_id=test_companion_id,
                    luck=luck
                )
                
                if drop_item:
                    drops.append(drop_item)
            
            # 统计
            drop_rate = len(drops) / test_iterations * 100
            
            print(f"📊 掉落统计:")
            print(f"   掉落率: {drop_rate:.1f}% ({len(drops)}/{test_iterations})")
            print(f"   掉落物品:")
            
            for item in drops:
                rarity_class = service._get_rarity_class(item['rarity'])
                print(f"     • [{rarity_class.rarity_name.upper()}] {item['name']} (稀有度 {item['rarity']})")
            
            # 查看背包
            inventory = service.get_inventory(user_id=test_user_id)
            print(f"\n📦 背包中的道具 ({len(inventory)} 个):")
            for item in inventory:
                print(f"     • [{item['rarity']}] {item['name']}")
        
        print("\n" + "=" * 60)
        print("✅ 道具掉落测试完成")
        print("=" * 60 + "\n")
        
        return True


# ===== 测试脚本 =====

if __name__ == '__main__':
    import sys
    service = InventoryService()
    success = service.test_item_drop()
    sys.exit(0 if success else 1)
