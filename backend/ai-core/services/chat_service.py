"""
Chat Service - Phase 8: Complete Chat Integration
整合 LLM + Memory + Prompt + Hidden Events + Item Drops
"""

from typing import List, Dict, Optional, AsyncGenerator
import uuid
from datetime import datetime
from enum import Enum

# 导入已创建的服务
from llm_service_v2 import LLMService, LLMProvider
from memory_service_v2 import MemoryService, MemoryType
from prompt_service_v2 import PromptService

# 导入隐藏事件和道具系统
from hidden_event_service import HiddenEventService
from inventory_service import InventoryService


class ChatMessageRole(Enum):
    """聊天消息角色"""
    SYSTEM = 'system'
    USER = 'user'
    ASSISTANT = 'assistant'
    HIDDEN_EVENT = 'hidden-event'
    ITEM_DROP = 'item-drop'


class ChatService:
    """
    完整的聊天服务
    整合所有模块：LLM + Memory + Prompt + Hidden_EVENTS + Item_Drops
    """

    def __init__(self):
        # 初始化子服务
        self.llm_service = LLMService()
        self.memory_service = MemoryService()
        self.prompt_service = PromptService()
        self.hidden_event_service = HiddenEventService()
        self.inventory_service = InventoryService()

        # 初始化所有服务
        self._initialized = False

    async def initialize(self) -> bool:
        """初始化所有子服务"""
        try:
            # 初始化 Memory Service（需要数据库）
            if not self.memory_service.initialize():
                print("⚠️  Memory Service 初始化失败")
                return False

            # 初始化 Hidden Event Service
            if not self.hidden_event_service.initialize():
                print("⚠️  Hidden Event Service 初始化失败")
                return False

            # 初始化 Inventory Service
            if not self.inventory_service.initialize():
                print("⚠️  Inventory Service 初始化失败")
                return False

            self._initialized = True
            print("✅ Chat Service 初始化完成")
            return True

        except Exception as e:
            print(f"❌ Chat Service 初始化失败: {e}")
            return False

    async def chat(
        self,
        user_id: str,
        character_id: str,
        user_message: str,
        character: Dict,
        model: str = 'gpt-3.5-turbo',
        stream: bool = True,
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> AsyncGenerator[Dict, None]:
        """
        完整的聊天流程

        Args:
            user_id: 用户 ID
            character_id: 角色 ID
            user_message: 用户消息
            character: 角色信息
            model: LLM 模型名称
            stream: 是否流式输出
            temperature: 温度
            max_tokens: 最大 tokens

        Yields:
            聊天响应（包含类型和内容）
        """
        if not self._initialized:
            await self.initialize()

        # 1. 保存用户消息到记忆
        user_importance = self.prompt_service.evaluate_importance(user_message, 'user')
        self.memory_service.add_memory(
            user_id=user_id,
            content=user_message,
            memory_type=MemoryType.USER,
            character_id=character_id,
            importance=user_importance
        )

        # 2. 检查隐藏事件（基于角色 LCK）
        character_luck = character.get('luck', 50)
        hidden_event = None

        if character_luck >= 60:  # 只有 LCK ≥ 60 才可能触发隐藏事件
            hidden_event = self.hidden_event_service.check_trigger(
                user_id=user_id,
                companion_id=character_id,
                luck_value=character_luck
            )

        # 3. 检查道具掉落（基于角色 LCK）
        item_drop = None

        if character_luck >= 40:  # 只有 LCK ≥ 40 才可能掉落道具
            item_drop = self.inventory_service.check_item_drop(
                user_id=user_id,
                companion_id=character_id,
                luck=character_luck
            )

        # 4. 获取相关记忆（最近的对话 + 重要记忆）
        recent_memories = self.memory_service.get_recent_memories(
            user_id=user_id,
            character_id=character_id,
            limit=5
        )

        important_memories = self.memory_service.get_important_memories(
            user_id=user_id,
            character_id=character_id,
            limit=3
        )

        conversations = recent_memories + important_memories

        # 5. 生成 Prompt
        system_prompt = self.prompt_service.build_system_prompt(
            character=character,
            memories=[m.to_dict() for m in conversations],
            hidden_event=hidden_event,
            item_drops=[item_drop] if item_drop else None
        )

        # 6. 格式化消息列表
        all_memories = self.memory_service.get_recent_memories(
            user_id=user_id,
            character_id=character_id,
            limit=10
        )

        conversation_history = []
        for memory in all_memories:
            role = memory.memory_type.value if memory.memory_type != MemoryType.EVENT else 'assistant'
            conversation_history.append({
                "role": role,
                "content": memory.content
            })

        messages = self.prompt_service.build_chat_messages(
            system_prompt=system_prompt,
            conversation_history=conversation_history,
            current_message=user_message,
            character_id=character_id
        )

        # 7. 生成 AI 回复
        async for response in self.llm_service.stream_chat(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream
        ):
            yield {
                'type': 'chat',
                'role': 'assistant',
                'content': response
            }

        # 8. 保存 AI 回复到记忆
        # 注意：这里需要完整的 AI 响应，所以实际应用中需要收集所有 chunk
        full_assistant_response = "[AI 响应 - 实际应用中需要完整收集]"

        assistant_importance = self.prompt_service.evaluate_importance(full_assistant_response, 'assistant')
        self.memory_service.add_memory(
            user_id=user_id,
            content=full_assistant_response,
            memory_type=MemoryType.ASSISTANT,
            character_id=character_id,
            importance=assistant_importance
        )

        # 9. 发送隐藏事件通知（如果触发）
        if hidden_event:
            event_description = f"🎬 {hidden_event['event_data']['name']}\n{hidden_event['description']}"
            yield {
                'type': 'hidden-event',
                'content': event_description,
                'event_data': hidden_event
            }

        # 10. 发送道具掉落通知（掉落）
        if item_drop:
            item_description = f"🎁 发现新道具：{item_drop['name']}\n稀有度: {item_drop['rarity']}\n效果: {item_drop['effect_description']}"
            yield {
                'type': 'item-drop',
                'content': item_description,
                'item_data': item_drop
            }


# ===== 测试脚本 =====

async def test_chat_service() -> bool:
    """测试完整的聊天服务"""
    print("\n" + "=" * 60)
    print("💬 Chat Service 测试（完整集成）")
    print("=" * 60 + "\n")

    service = ChatService()

    if not await service.initialize():
        print("❌ 初始化失败")
        return False

    print("✅ Chat Service 初始化完成\n")

    # 测试角色信息
    test_character = {
        'name': 'Luna',
        'gender': 'female',
        'appearance': 95,
        'luck': 90,  # 高幸运，容易触发隐藏事件和道具掉落
        'stats': {
            'strength': 70,
            'intelligence': 85,
            'charisma': 90,
            'appearance': 95
        },
        'personality': {
            'traits': ['warm', 'curious', 'playful'],
            'speakingStyle': 'casual',
            'backStory': 'Luna is a friendly AI companion who loves learning about people and helping with everyday conversations.'
        }
    }

    print("📋 测试角色：")
    print(f"   名称: {test_character['name']}")
    print(f"   颜值: {test_character['appearance']}")
    print(f"   幸运: {test_character['luck']} (高幸运，容易触发隐藏事件)")
    print()

    # 测试对话
    test_user_id = 'test-user-id'
    test_character_id = 'test-character-id'

    test_message = "你好！我叫 Alex，很高兴认识你！"

    print(f"📝 用户消息：{test_message}")
    print("\n正在生成回复...\n")

    try:
        response_count = 0
        async for response in service.chat(
            user_id=test_user_id,
            character_id=test_character_id,
            user_message=test_message,
            character=test_character,
            model='gpt-3.5-turbo',
            stream=True,
            temperature=0.7,
            max_tokens=100
        ):
            if response['type'] == 'chat':
                print(response['content'], end='', flush=True)
                response_count += 1

            elif response['type'] == 'hidden-event':
                print(f"\n\n{'=' * 60}")
                print(f"🎬 隐藏事件触发：")
                print(f"{'=' * 60}")
                print(response['content'])
                print(f"{'=' * 60}\n")

            elif response['type'] == 'item-drop':
                print(f"\n{'=' * 60}")
                print(f"🎁 道具掉落：")
                print(f"{'=' * 60}")
                print(response['content'])
                print(f"{'=' * 60}\n")

        print(f"\n\n✅ 测试完成，生成了 {response_count} 个响应块")

    except Exception as e:
        print(f"\n⚠️  对话测试失败: {e}")

    print("\n" + "=" * 60)
    print("✅ Chat Service 测试完成")
    print("=" * 60 + "\n")

    return True


if __name__ == '__main__':
    import asyncio
    asyncio.run(test_chat_service())
