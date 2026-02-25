"""
Phase 9: Payment Service - Mock Mode (Fixed)
支付系统 - 简化版（模拟支付）
"""

from typing import Dict, Optional, List
from enum import Enum
import uuid

# ===== 订阅层级配置 =====

class SubscriptionTier(Enum):
    """订阅层级"""
    FREE = 'free'
    PRO = 'pro'
    PREMIUM = 'premium'


class SubscriptionConfig:
    """订阅配置"""
    PLANS = {
        SubscriptionTier.FREE: {
            'name': '基础版',
            'price': 0.0,
            'currency': 'USD',
            'interval': 'lifetime',
            'features': [
                '1 个 AI 伴侣',
                '基础聊天',
                '普通颜值'
            ],
            'limits': {
                'max_characters': 1,
                'max_hidden_events_per_month': 0,
                'max_items_per_month': 5
            }
        },
        SubscriptionTier.PRO: {
            'name': '专业版',
            'price': 9.99,
            'currency': 'USD',
            'interval': 'month',
            'features': [
                '3 个 AI 伴侣',
                '高级聊天',
                '高级颜值解锁',
                '隐藏事件触发（LCK ≥ 60）',
                '武器装备系统'
            ],
            'limits': {
                'max_characters': 3,
                'max_hidden_events_per_month': 10,
                'max_items_per_month': 20
            }
        },
        SubscriptionTier.PREMIUM: {
            'name': '旗舰版',
            'price': 19.99,
            'currency': 'USD',
            'interval': 'month',
            'features': [
                '无限 AI 伴侣',
                '尊贵聊天体验',
                '全颜值解锁',
                '隐藏事件全解锁（任何 LCK）',
                '完整武器装备系统',
                '优先级客服支持'
            ],
            'limits': {
                'max_characters': 9999,
                'max_hidden_events_per_month': 9999,
                'max_items_per_month': 9999
            }
        }
    }


class PaymentServiceSimple:
    """简化的支付服务（模拟模式）"""

    @staticmethod
    def get_tiers() -> List[Dict]:
        """获取所有订阅层级"""
        plans = []
        
        for tier, config in SubscriptionConfig.PLANS.items():
            plans.append({
                'tier': tier.value,
                'name': config['name'],
                'price': config['price'],
                'currency': config['currency'],
                'interval': config['interval'],
                'features': config['features'],
                'limits': config['limits']
            })
        
        return plans

    @staticmethod
    def create_mock_payment(tier: SubscriptionTier) -> Dict:
        """创建模拟支付"""
        plan = SubscriptionConfig.PLANS[tier]
        
        return {
            'payment_id': str(uuid.uuid4()),
            'tier': tier.value,
            'plan_name': plan['name'],
            'amount': plan['price'],
            'currency': plan['currency'],
            'status': 'success',
            'created_at': '2026-02-25 01:20:00 UTC'
        }

    @staticmethod
    def check_limits(tier: SubscriptionTier, usage: Dict) -> Dict:
        """检查订阅限制"""
        plan = SubscriptionConfig.PLANS[tier]
        limits = plan['limits']
        
        return {
            'tier': tier.value,
            'can_create_more_characters': usage.get('characters', 0) < limits['max_characters'],
            'can_trigger_more_events': usage.get('events', 0) < limits['max_hidden_events_per_month'],
            'can_drop_more_items': usage.get('items', 0) < limits['max_items_per_month']
        }


# ===== 测试 =====

def test_payment_simple():
    """测试简化版支付服务"""
    print("\n" + "=" * 60)
    print("💰 Phase 9 支付系统测试（简化版）")
    print("=" * 60 + "\n")
    
    print("📋 订阅计划:\n")
    
    tiers = PaymentServiceSimple.get_tiers()
    
    for tier in tiers:
        print(f"\n{tier['name']} ({tier['tier'].upper()})")
        print(f"   价格: ${tier['price']}/{tier['interval']}")
        print(f"   特性:")
        for feature in tier['features']:
            print(f"      • {feature}")
        print(f"   限制:")
        for key, value in tier['limits'].items():
            print(f"      • {key}: {value}")
    
    # 测试模拟支付
    print("\n" + "=" * 60)
    print("\n📝 模拟支付（PRO 订阅）\n")
    
    payment = PaymentServiceSimple.create_mock_payment(SubscriptionTier.PRO)
    
    print(f"✅ 模拟支付已创建:")
    print(f"   支付ID: {payment['payment_id']}")
    print(f"   订阅: {payment['plan_name']}")
    print(f"   金额: ${payment['amount']}")
    print(f"   状态: {payment['status']}")
    
    print("\n" + "=" * 60)
    print("✅ Phase 9 支付系统测试完成")
    print("=" * 60 + "\n")
    
    return True


if __name__ == '__main__':
    import sys
    success = test_payment_simple()
    sys.exit(0 if success else 1)
