"""
Payment Service - Phase 9: Payment Integration
支付系统（Stripe + 模拟支付模式）
"""

from typing import Dict, Optional, List
from enum import Enum
from datetime import datetime
import json
import sqlite3

# 数据库连接
AI_CORE_DB_FILE = '/home/node/.openclaw1/projects/ai-companion/ai_companion.db'


class PaymentProvider(Enum):
    """支付提供商"""
    STRIPE = 'stripe'
    PAYPAL = 'paypal'
    MOCK = 'mock'  # 模拟支付（用于测试）


class SubscriptionTier(Enum):
    """订阅层级"""
    FREE = 'free'
    PRO = 'pro'
    PREMIUM = 'premium'


class SubscriptionPlans:
    """订阅计划配置"""

    PLANS = {
        SubscriptionTier.FREE: {
            'name': '基础版',
            'price': 0,
            'currency': 'USD',
            'interval': 'lifetime',
            'features': [
                '1 个 AI 伴侣',
                '基础聊天',
                '普通颜值',
                '无隐藏事件',
                '无武器装备'
            ],
            'max_characters': 1,
            'max_hidden_events_per_month': 0,
            'max_items_per_month': 5
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
            'max_characters': 3,
            'max_hidden_events_per_month': 10,
            'max_items_per_month': 20
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
            'max_characters': 9999,
            'max_hidden_events_per_month': 9999,
            'max_items_per_month': 9999
        }
    }


class PaymentService:
    """
    支付系统服务
    功能：订阅管理、支付处理、层级控制
    """

    def __init__(self):
        self.db_file = AI_CORE_DB_FILE
        self.conn = None
        self._initialized = False

        # Stripe 客户端（需要 API Key）
        self._stripe_client = None

        # 支付提供商
        self.provider = PaymentProvider.MOCK  # 默认使用模拟支付

    def initialize(self, provider: PaymentProvider = PaymentProvider.MOCK) -> bool:
        """初始化支付服务"""
        try:
            # 设置提供商
            self.provider = provider

            # 如果是 Stripe，初始化客户端
            if provider == PaymentProvider.STRIPE:
                try:
                    import stripe
                    stripe.api_key = os.getenv('STRIPE_API_KEY')
                    self._stripe_client = stripe
                    print("✅ Stripe Client 初始化成功")
                except ImportError:
                    print("⚠️  Stripe SDK 未安装，切换到模拟支付模式")
                    self.provider = PaymentProvider.MOCK

            # 初始化数据库
            self.conn = sqlite3.connect(self.db_file, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row
            self._create_tables()

            self._initialized = True
            print(f"✅ Payment Service 初始化完成（模式：{provider.value}）")
            return True

        except Exception as e:
            print(f"❌ Payment Service 初始化失败: {e}")
            return False

    def _create_tables(self):
        """创建支付相关表"""
        cursor = self.conn.cursor()

        # 订阅表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS subscriptions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                tier TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP,
                auto_renew BOOLEAN DEFAULT FALSE,
                provider TEXT DEFAULT 'mock',
                provider_subscription_id TEXT,
                metadata TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 支付历史表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS payment_history (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                subscription_id TEXT,
                amount REAL NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                status TEXT NOT NULL,
                provider TEXT NOT NULL,
                provider_transaction_id TEXT,
                metadata TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 创建索引
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_subscriptions_user_tier
                ON subscriptions(user_id, tier, status DESC, start_date DESC)
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_payment_history_user_status
                ON payment_history(user_id, status, created_at DESC)
        ''')

        self.conn.commit()

    def check_subscription_limits(
        self,
        user_id: str,
        tier: SubscriptionTier
    ) -> Dict:
        """
        检查订阅层级限制

        Args:
            user_id: 用户 ID
            tier: 订阅层级

        Returns:
            限制信息
        """
        if not self._initialized:
            self.initialize()

        plan = SubscriptionPlans.PLANS[tier]

        # 统计当前使用情况
        cursor = self.conn.cursor()

        # 已有角色数量
        cursor.execute('''
            SELECT COUNT(*) as count FROM companions
            WHERE user_id = ?
        ''', (user_id,))
        character_count = cursor.fetchone()['count']

        # 本月隐藏事件触发次数
        cursor.execute('''
            SELECT COUNT(*) as count FROM hidden_events
            WHERE user_id = ? AND strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')
        ''', (user_id,))
        event_count = cursor.fetchone()['count']

        # 本月道具掉落数量
        cursor.execute('''
            SELECT COUNT(*) as count FROM items
            WHERE user_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        ''', (user_id,))
        item_count = cursor.fetchone()['count']

        return {
            'tier': tier,
            'plan': plan,
            'max_characters': plan['max_characters'],
            'max_hidden_events_per_month': plan['max_hidden_events_per_month'],
            'max_items_per_month': plan['max_items_per_month'],
            'usage': {
                'character_count': character_count,
                'event_count': event_count,
                'item_count': item_count
            },
            'can_create_more_characters': character_count < plan['max_characters'],
            'can_trigger_more_events': event_count < plan['max_hidden_events_per_month'],
            'can_drop_more_items': item_count < plan['max_items_per_month']
        }

    def create_payment_link(
        self,
        user_id: str,
        tier: SubscriptionTier,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None
    ) -> Optional[str]:
        """
        创建支付链接（Stripe）

        Args:
            user_id: 用户 ID
            tier: 订阅层级
            success_url: 支付成功后跳转 URL
            cancel_url: 支付取消后跳转 URL

        Returns:
            支付链接 URL
        """
        if not self._initialized:
            self.initialize()

        plan = SubscriptionPlans.PLANS[tier]

        if self.provider == PaymentProvider.STRIPE:
            # 使用 Stripe Checkout
            try:
                checkout_session = self._stripe_client.checkout.Session.create(
                    payment_method_types=['card'],
                    line_items=[{
                        'price_data': {
                            'currency': plan['currency'],
                            'product_data': {
                                'name': f"AI Companion {plan['name']}",
                                'description': f"{tier.value.title()} 订阅 - {plan['interval']}"
                            },
                            'unit_amount': int(plan['price'] * 100),  # 转换为分
                            'recurring': {'interval': plan['interval']} if plan['price'] > 0 else None
                        },
                        'quantity': 1,
                    }],
                    mode='payment',
                    success_url=success_url + '?session_id={CHECKOUT_SESSION_ID}',
                    cancel_url=cancel_url or success_url
                )

                # 保存支付记录
                self._create_payment_record(
                    user_id=user_id,
                    tier=tier,
                    amount=plan['price'],
                    status='pending',
                    provider_transaction_id=checkout_session.id
                )

                return checkout_session.url

            except Exception as e:
                print(f"❌ Stripe 支付链接创建失败: {e}")
                return None

        elif self.provider == PaymentProvider.MOCK:
            # 模拟支付链接
            import uuid
            mock_payment_id = str(uuid.uuid4())

            # 保存模拟支付记录
            self._create_payment_record(
                user_id=user_id,
                tier=tier,
                amount=plan['price'],
                status='pending',
                provider_transaction_id=mock_payment_id
            )

            # 返回模拟支付链接
            return f"/payment/mock?payment_id={mock_payment_id}&tier={tier.value}"

        return None

    def _create_payment_record(
        self,
        user_id: str,
        tier: SubscriptionTier,
        amount: float,
        status: str,
        provider_transaction_id: Optional[str] = None
    ) -> str:
        """创建支付记录"""
        cursor = self.conn.cursor()

        import uuid
        payment_id = str(uuid.uuid4())

        cursor.execute('''
            INSERT INTO payment_history
            (id, user_id, subscription_id, amount, currency, status, provider, provider_transaction_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            payment_id,
            user_id,
            None,  # 暂无关联订阅 ID
            amount,
            'USD',
            status,
            self.provider.value,
            provider_transaction_id
        ))

        self.conn.commit()

        return payment_id

    def activate_subscription(
        self,
        user_id: str,
        tier: SubscriptionTier,
        provider_transaction_id: Optional[str] = None
    ) -> bool:
        """
        激活订阅

        Args:
            user_id: 用户 ID
            tier: 订阅层级
            provider_transaction_id: 支付服务商交易 ID

        Returns:
            是否成功
        """
        if not self._initialized:
            self.initialize()

        import uuid

        cursor = self.conn.cursor()

        # 如果已有活跃订阅，先禁用
        cursor.execute('''
            SELECT id FROM subscriptions
            WHERE user_id = ? AND status = 'active'
            ORDER BY start_date DESC LIMIT 1
        ''', (user_id,))

        existing = cursor.fetchone()

        if existing:
            # 禁用旧订阅
            cursor.execute('''
                UPDATE subscriptions
                SET status = 'cancelled', end_date = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (existing['id'],))

        # 创建新订阅
        subscription_id = str(uuid.uuid4())

        cursor.execute('''
            INSERT INTO subscriptions
            (id, user_id, tier, status, start_date, end_date, auto_renew, provider, provider_subscription_id, metadata)
            VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, ?, ?, ?, ?)
        ''', (
            subscription_id,
            user_id,
            tier.value,
            subscription_id,
            None,  # 暂无结束日期
            False,
            self.provider.value,
            provider_transaction_id,
            json.dumps({})
        ))

        self.conn.commit()

        # 更新支付记录状态
        if provider_transaction_id:
            cursor.execute('''
                UPDATE payment_history
                SET status = 'completed', subscription_id = ?
                WHERE provider_transaction_id = ?
            ''', (subscription_id, provider_transaction_id))
            self.conn.commit()

        print(f"✅ {tier.value.upper()} 订阅已激活")

        return True

    def get_active_subscription(
        self,
        user_id: str
    ) -> Optional[Dict]:
        """
        获取活跃订阅

        Args:
            user_id: 用户 ID

        Returns:
            订阅信息
        """
        if not self._initialized:
            self.initialize()

        cursor = self.conn.cursor()

        cursor.execute('''
            SELECT * FROM subscriptions
            WHERE user_id = ? AND status = 'active'
            ORDER BY start_date DESC LIMIT 1
        ''', (user_id,))

        row = cursor.fetchone()

        if not row:
            return {
                'tier': 'free',
                'status': 'active',
                'plan': SubscriptionPlans.PLANS[SubscriptionTier.FREE]
            }

        plan = SubscriptionPlans.PLANS[SubscriptionTier(row['tier'].upper())]

        return {
            'id': row['id'],
            'user_id': row['user_id'],
            'tier': row['tier'],
            'status': row['status'],
            'start_date': row['start_date'],
            'end_date': row['end_date'],
            'auto_renew': bool(row['auto_renew']),
            'provider': row['provider'],
            'plan': plan
        }

    def cancel_subscription(
        self,
        user_id: str,
        subscription_id: str
    ) -> bool:
        """
        取消订阅

        Args:
            user_id: 用户 ID
            subscription_id: 订阅 ID

        Returns:
            是否成功
        """
        if not self._initialized:
            self.initialize()

        cursor = self.conn.cursor()

        cursor.execute('''
            UPDATE subscriptions
            SET status = 'cancelled', end_date = CURRENT_TIMESTAMP, auto_renew = FALSE
            WHERE id = ? AND user_id = ?
        ''', (subscription_id, user_id))

        self.conn.commit()

        print(f"✅ 订阅 {subscription_id} 已取消")

        return True

    def test_payment_flow(self):
        """测试支付流程"""
        print("\n" + "=" * 60)
        print("💰 Payment Service 测试")
        print("=" * 60 + "\n")

        service = PaymentService()

        if not service.initialize():
            print("❌ 初始化失败")
            return False

        print("✅ Payment Service 初始化完成\n")

        # 测试用户
        test_user_id = 'test-user-payment'

        # 测试订阅层级限制检查
        print("📋 测试订阅层级限制检查...\n")

        for tier_obj in [SubscriptionTier.FREE, SubscriptionTier.PRO, SubscriptionTier.PREMIUM]:
            result = service.check_subscription_limits(test_user_id, tier_obj)

            plan_config = result['plan']
            usage = result['usage']
            limits = result['limits']

            print(f"{tier_obj.value.upper()} 订阅:")
            print(f"   价格: ${plan_config['price']}/{plan_config['interval']}")
            print(f"   功能: {', '.join(plan_config['features'][:2])}...")
            print(f"   角色: {usage['character_count']}/{result['max_characters']}")
            print(f"   隐藏事件: {usage['event_count']}/{result['max_hidden_events_per_month']}")
            print(f"   道具: {usage['item_count']}/{result['max_items_per_month']}")
            print()

        # 测试创建支付链接
        print("📝 测试创建支付链接...\n")

        payment_link = service.create_payment_link(
            user_id=test_user_id,
            tier=SubscriptionTier.PRO,
            success_url="http://localhost:5176/success",
            cancel_url="http://localhost:5176/cancel"
        )

        if payment_link:
            print(f"✅ 支付链接已创建:")
            print(f"   {payment_link}")
            print()
        else:
            print("❌ 支付链接创建失败")
            return False

        # 测试激活订阅
        print("🔄 测试激活订阅...\n")

        service.activate_subscription(
            user_id=test_user_id,
            tier=SubscriptionTier.PRO,
            provider_transaction_id="mock_transaction_id"
        )

        # 测试获取活跃订阅
        print("📋 测试获取活跃订阅...\n")

        active_sub = service.get_active_subscription(test_user_id)

        if active_sub:
            print(f"活跃订阅: {active_sub['tier'].upper()}")
            print(f"   计划: {active_sub['plan']['name']}")
            print(f"   价格: ${active_sub['plan']['price']}/{active_sub['plan']['interval']}")
            print()

        print("=" * 60)
        print("✅ Payment Service 测试完成")
        print("=" * 60 + "\n")

        return True


# ===== 测试脚本 =====

if __name__ == '__main__':
    import sys
    success = PaymentService().test_payment_flow()
    sys.exit(0 if success else 1)
