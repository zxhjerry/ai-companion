"""
Prompt Service - Phase 8: Role Prompt Generation
角色 Prompt 生成 + 上下文注入
"""

from typing import List, Dict, Optional
from datetime import datetime

# ===== Prompt 模板 =====

BASE_SYSTEM_PROMPT = """你是一个友好的 AI 伴侣，名为 {name}。
你的性格特点：{traits}。
你的说话风格：{speaking_style}。
你的人生背景：{back_story}。

对话时需要注意：
- 保持 {name} 的说话风格
- 使用符合角色的语气和表达方式
- 适当地使用表情符号（不要过度）
- 好奇且友好，但不要过于热情
- 重要的事情会记住并提醒
- 可以分享角色的人生经历

{context_notes}
"""

MEMORY_CONTEXT_PROMPT = """
## 重要记忆提示
{memories}

这些记忆对你的角色很重要，请在对话中适当地提及或呼应。
"""

HIDDEN_EVENT_TRIGGER_PROMPT = """
## 隐藏剧情触发
{event_description}

这是一个隐藏的剧情分支，请在对话中自然地展开这个故事线。
不要直接告诉用户这是隐藏事件，而是让剧情自然地发生。
"""

ITEM_GET_PROMPT = """
## 道具获得提示
{item_name}（稀有度：{rarity}）
效果：{item_effect}

你刚刚获得了这个道具，请在对话中巧妙地提及这个道具，或者给予相关的建议。
"""

# ===== 核心服务 =====


class PromptService:
    """
    Prompt 服务
    功能：生成角色 Prompt、注入上下文、格式化消息
    """

    def __init__(self):
        self.default_model = 'gpt-3.5-turbo'

    def build_system_prompt(
        self,
        character: Dict,  # 角色信息
        memories: Optional[List[Dict]] = None,  # 可选：重要记忆
        hidden_event: Optional[Dict] = None,  # 可选：隐藏事件
        item_drops: Optional[List[Dict]] = None  # 可选：道具掉落
    ) -> str:
        """
        生成完整的系统 Prompt

        Args:
            character: 角色信息 (含有 name, traits, speaking_style, back_story)
            memories: 可选的重要记忆
            hidden_event: 可选的隐藏事件
            item_drops: 可选的道具掉落

        Returns:
            系统 Prompt
        """
        # 提取角色信息
        name = character.get('name', 'AI 伴侣')
        personality = character.get('personality', {})
        
        traits = personality.get('traits', ['friendly', 'curious', 'empathetic'])
        speaking_style = personality.get('speakingStyle', 'casual')
        back_story = personality.get('backStory', '')

        # 构建基础 Prompt
        system_prompt = BASE_SYSTEM_PROMPT.format(
            name=name,
            traits=', '.join(traits),
            speaking_style=speaking_style,
            back_story=back_story,
            context_notes=self._build_context_notes(memories, hidden_event, item_drops)
        )

        return system_prompt

    def _build_context_notes(
        self,
        memories: Optional[List[Dict]],
        hidden_event: Optional[Dict],
        item_drops: Optional[List[Dict]]
    ) -> str:
        """构建上下文"""

        notes = []

        # 重要记忆
        if memories and len(memories) > 0:
            memory_text = f"""
重要记忆提示
{self._format_memories(memories)}

这些记忆对你的角色很重要，请在对话中适当地提及或呼应。
""".strip()
            notes.append(memory_text)

        # 隐藏事件
        if hidden_event:
            event_text = HIDDEN_EVENT_TRIGGER_PROMPT.format(
                event_description=hidden_event.get('description', '隐藏事件已触发')
            )
            notes.append(event_text)

        # 道具获得
        if item_drops and len(item_drops) > 0:
            for item in item_drops:
                item_text = ITEM_GET_PROMPT.format(
                    item_name=item.get('name', '新道具'),
                    rarity=item.get('rarity', 'unknown'),
                    item_effect=item.get('effect_description', '特殊效果')
                )
                notes.append(item_text)

        return '\n'.join(notes) if notes else '注意记保持角色一致性和连贯性。'

    def _format_memories(self, memories: List[Dict]) -> str:
        """格式化记忆"""
        memory_parts = []

        for i, memory in enumerate(memories[:5], 1):  # 最多 5 条记忆
            content = memory.get('content', '')
            timestamp_str = memory.get('timestamp', '')
            
            memory_parts.append(f"{i}. {content}")

        return '\n'.join(memory_parts) if memory_parts else "暂无重要记忆。"

    def build_chat_messages(
        self,
        system_prompt: str,
        conversation_history: List[Dict],
        current_message: str,
        character_id: str
    ) -> List[Dict]:
        """
        构建聊天的消息列表

        Args:
            system_prompt: 系统 Prompt
            conversation_history: 对话历史
            current_message: 当前消息（用户输入）
            character_id: 角色 ID

        Returns:
            格式化的消息列表
        """
        messages = [
            {"role": "system", "content": system_prompt}
        ]

        # 添加对话历史
        for msg in conversation_history[-10:]:  # 最多添加最近 10 条历史记录
            messages.append({
                "role": msg.get("role"),
                "content": msg.get("content", "")
            })

        # 添加当前消息
        messages.append({
            "role": "user",
            "content": current_message
        })

        return messages

    def evaluate_importance(self, message: str, character_role: str = 'user') -> float:
        """
        评估消息的重要性

        Args:
            message: 消息内容
            character_role: 发送者角色（user/assistant）

        Returns:
            重要性分数 0.0-1.0
        """
        # 简单的启发式评估
        importance = 0.3  # 基础分数

        # 关键词检查
        important_keywords = [
            '喜欢', '爱', '重要', '记得',
            '忘不了', '难忘', '最重要',
            '永远', '永远会', '不会忘',
            '秘密', '经历', '人生'
        ]

        for keyword in important_keywords:
            if keyword in message:
                importance += 0.15

        # 消息长度
        if len(message) > 50:
            importance += 0.1
        if len(message) > 100:
            importance += 0.1

        # 角色差异
        if character_role == 'assistant':
            importance += 0.05  # AI 的回复稍微更有价值

        # 限制范围
        return min(1.0, max(0.0, importance))

    def format_character_info(
        self,
        character: Dict,
        include_hidden: bool = False
    ) -> str:
        """
        格式化角色信息（用于调试或展示）

        Args:
            character: 角色信息
            include_hidden: 是否包含隐藏属性

        Returns:
            格式化的字符串
        """
        info_parts = []

        # 基本信息
        info_parts.append(f"名称: {character.get('name', 'Unknown')}")
        info_parts.append(f"性别: {character.get('gender', 'unknown')}")

        # 显示属性
        appearance = character.get('appearance', 50)
        info_parts.append(f"✨ 颜值 (APP): {appearance}/100")

        if include_hidden:
            luck = character.get('luck', 50)
            info_parts.append(f"⭐ 幸运 (LCK): {luck}/100 (隐藏)")

        # 五维数值
        stats = character.get('stats', {})
        if stats:
            info_parts.append("\n五维数值:")
            info_parts.append(f"  ⚔️ 力量: {stats.get('strength', 50)}")
            info_parts.append(f"  🧠 智力: {stats.get('intelligence', 50)}")
            info_parts.append(f"  ✨ 魅力: {stats.get('charisma', 50)}")
            info_parts.append(f"  🌟 颜值: {stats.get('appearance', 50)}")

        # 性格
        personality = character.get('personality', {})
        if personality:
            info_parts.append(f"\n性格: {', '.join(personality.get('traits', []))}")
            info_parts.append(f"说话风格: {personality.get('speakingStyle', 'casual')}")

        return '\n'.join(info_parts)


# ===== 测试脚本 =====

def test_prompt_service() -> bool:
    """测试 Prompt 服务"""
    print("\n" + "=" * 60)
    print("💬 Prompt Service 测试")
    print("=" * 60 + "\n")

    service = PromptService()

    # 测试角色信息
    test_character = {
        'name': 'Luna',
        'gender': 'female',
        'appearance': 95,
        'luck': 90,
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

    print("📋 测试角色信息...\n")

    character_info = service.format_character_info(test_character, include_hidden=True)
    print(character_info)

    print("\n" + "=" * 60)
    print("\n📝 测试系统 Prompt 生成...\n")

    system_prompt = service.build_system_prompt(test_character)
    print("生成的系统 Prompt:")
    print(system_prompt)

    print("\n" + "=" * 60)
    print("\n📝 测试消息重要性评估...\n")

    test_messages = [
        ("你好！", 'user'),
        ("我真的很喜欢你，你永远是我的好朋友。", 'user'),
        ("Luna，你记得上次的对话吗？这是我们最重要的记忆。", 'user'),
        ("我也是！我会永远记得你说的每一句话。", 'assistant'),
    ]

    for message, role in test_messages:
        importance = service.evaluate_importance(message, role)
        print(f"[{role}] {message}")
        print(f"     重要性: {importance:.2f}")

    print("\n" + "=" * 60)
    print("✅ Prompt Service 测试完成")
    print("=" * 60 + "\n")

    return True


if __name__ == '__main__':
    import sys
    success = test_prompt_service()
    sys.exit(0 if success else 1)
