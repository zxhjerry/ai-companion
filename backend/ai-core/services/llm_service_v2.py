"""
LLM Service - Phase 8: Multi-Model AI Integration
支持 OpenAI (GPT-4), Anthropic (Claude), GLM4 (智谱AI)
"""

import os
import asyncio
from typing import AsyncGenerator, List, Dict, Optional
from enum import Enum
import json

# ===== 模型提供商枚举 =====

class LLMProvider(Enum):
    """LLM 服务商"""
    OPENAI = 'openai'
    ANTHROPIC = 'anthropic'
    GLM4 = 'glm4'
    GLM_VISION = 'glm-vision'
    ZAI = 'zai'
    OTHER = 'other'


# ===== 模型配置 =====

AVAILABLE_MODELS = {
    LLMProvider.OPENAI: [
        'gpt-4-turbo',
        'gpt-4',
        'gpt-4-32k',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
    ],
    LLMProvider.ANTHROPIC: [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-2.1',
        'claude-instant-1.2',
    ],
    LLMProvider.GLM4: [
        'glm-4',
        'glm-4-0520',
        'glm-4-air',
        'glm-4-flash',
        'glm-4-long',
    ],
    LLMProvider.GLM_VISION: [
        'glm-4v',
        'glm-4v-plus',
    ],
    LLMProvider.ZAI: [
        'nvidia/z-ai/glm4.7',
    ],
}


# ===== 核心 LLM 服务 =====

class LLMService:
    """
    多模型 LLM 服务
    支持：OpenAI (GPT-4), Anthropic (Claude), GLM4 (智谱AI)
    """

    def __init__(self):
        # API Keys（从环境变量获取）
        self.openai_key = os.getenv('OPENAI_API_KEY')
        self.anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        self.glm4_key = os.getenv('GLM4_API_KEY')
        self.zai_key = os.getenv('ZAI_API_KEY')

        # 创建客户端
        self._openai_client = None
        self._anthropic_client = None
        self._setup_clients()

    def _setup_clients(self):
        """初始化客户端连接"""
        if self.openai_key:
            try:
                from openai import AsyncOpenAI
                self._openai_client = AsyncOpenAI(api_key=self.openai_key)
                print("✅ OpenAI Client 初始化成功")
            except ImportError:
                print("⚠️  OpenAI SDK 未安装，跳过")

        if self.anthropic_key:
            try:
                import anthropic
                self._anthropic_client = anthropic.AsyncAnthropic(api_key=self.anthropic_key)
                print("✅ Anthropic Client 初始化成功")
            except ImportError:
                print("⚠️  Anthropic SDK 未安装，跳过")

        if self.glm4_key:
            print("✅ GLM4 API Key 已配置")
        else:
            print("⚠️  GLM4 API Key 未设置")

        if self.zai_key:
            print("✅ ZAI API Key 已配置")
        else:
            print("⚠️  ZAI API Key 未设置")

    async def stream_chat(
        self,
        model: str,
        messages: List[Dict],
        temperature: float = 0.7,
        max_tokens: int = 1000,
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """
        流式聊天对话

        Args:
            model: 模型名称（如 'gpt-4', 'claude-3-opus-20240229', 'glm-4'）
            messages: 消息列表（格式：[{'role': 'system', 'content': '...'}, ...]）
            temperature: 温度（0.0-1.0，越高越随机）
            max_tokens: 最大生成 tokens
            stream: 是否流式输出

        Yields:
            生成的文本片段
        """
        # 判断模型提供商
        provider = self._detect_provider(model)

        if provider == LLMProvider.OPENAI:
            async for chunk in self._stream_openai(model, messages, temperature, max_tokens):
                yield chunk

        elif provider == LLMProvider.ANTHROPIC:
            async for chunk in self._stream_anthropic(model, messages, temperature, max_tokens):
                yield chunk

        elif provider == LLMProvider.GLM4 or provider == LLMProvider.ZAI:
            # GLM4 需要不同的 API 调用
            async for chunk in self._stream_glm4(model, messages, temperature, max_tokens):
                yield chunk

        else:
            raise ValueError(f"Unsupported model: {model}")

    async def complete_chat(
        self,
        model: str,
        messages: List[Dict],
        temperature: float = 0.7,
        max_tokens: int = 1000,
        stream: bool = False
    ) -> str:
        """
        完整对话（非流式）

        Args:
            model: 模型名称
            messages: 消息列表
            temperature: 温度
            max_tokens: 最大 tokens

        Returns:
            完整的生成文本
        """
        if stream:
            # 如果要求流式，则调用流式方法
            full_response = ""
            async for chunk in self.stream_chat(model, messages, temperature, max_tokens):
                full_response += chunk
            return full_response

        # 否则使用直接调用
        provider = self._detect_provider(model)

        if provider == LLMProvider.OPENAI:
            return await self._complete_openai(model, messages, temperature, max_tokens)
        elif provider == LLMProvider.ANTHROPIC:
            return await self._complete_anthropic(model, messages, temperature, max_tokens)
        elif provider == LLMProvider.GLM4:
            return await self._complete_glm4(model, messages, temperature, max_tokens)
        else:
            raise ValueError(f"Unsupported model: {model}")

    def _detect_provider(self, model: str) -> LLMProvider:
        """检测模型提供商"""
        if model.startswith('gpt-'):
            return LLMProvider.OPENAI
        elif model.startswith('claude-'):
            return LLMProvider.ANTHROPIC
        elif 'glm-4' in model or model.startswith('glm'):
            return LLMProvider.GLM4
        elif 'z-ai' in model:
            return LLMProvider.ZAI
        else:
            return LLMProvider.OTHER

    # ===== OpenAI 实现 =====

    async def _stream_openai(
        self,
        model: str,
        messages: List[Dict],
        temperature: float,
        max_tokens: int
    ) -> AsyncGenerator[str, None]:
        if not self._openai_client:
            raise ValueError("OpenAI client not initialized")

        stream = await self._openai_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def _complete_openai(
        self,
        model: str,
        messages: List[Dict],
        temperature: float,
        max_tokens: int
    ) -> str:
        if not self._openai_client:
            raise ValueError("OpenAI client not initialized")

        response = await self._openai_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False
        )

        return response.choices[0].message.content

    # ===== Anthropic 实现 =====

    async def _stream_anthropic(
        self,
        model: str,
        messages: List[Dict],
        temperature: float,
        max_tokens: int
    ) -> AsyncGenerator[str, None]:
        if not self._anthropic_client:
            raise ValueError("Anthropic client not initialized")

        stream = await self._anthropic_client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=messages,
            stream=True
        )

        async for event in stream:
            if event.type == 'content_block_delta':
                if event.delta.text:
                    yield event.delta.text

    async def _complete_anthropic(
        self,
        model: str,
        messages: List[Dict],
        temperature: float,
        max_tokens: int
    ) -> str:
        if not self._anthropic_client:
            raise ValueError("Anthropic client not initialized")

        response = await self._anthropic_client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=messages,
            stream=False
        )

        return response.content[0].text

    # ===== GLM4 / ZAI 实现（占位符） =====

    async def _stream_glm4(
        self,
        model: str,
        messages: List[Dict],
        temperature: float,
        max_tokens: int
    ) -> AsyncGenerator[str, None]:
        """
        GLM4 / ZAI 流式实现
        注意：这需要实际的 API 调用
        """
        # GLM4 API 需要通过 HTTP 请求
        # 这里使用模拟实现
        import httpx

        if not self.glm4_key and not self.zai_key:
            # 如果没有 API Key，使用模拟响应
            yield f"[{model} - 这是一个模拟响应] "
            yield "GLM4 需要配置 API Key 才能正常工作。"
            return

        # TODO: 实现 GLM4 API 调用
        # 这需要根据实际的 API 文档实现
        yield "[GLM4 响应待实现]"

    async def _complete_glm4(
        self,
        model: str,
        messages: List[Dict],
        temperature: float,
        max_tokens: int
    ) -> str:
        """GLM4 完整对话实现"""
        if not self.glm4_key:
            return f"[{model}] 需要配置 GLM4 API Key"

        # TODO: 实现 GLM4 API 调用
        return "[GLM4 响应待实现]"


# ===== 测试脚本 =====

async def test_llm_service() -> bool:
    """测试 LLM 服务"""
    print("\n" + "=" * 60)
    print("🤖 LLM Service 测试")
    print("=" * 60 + "\n")

    service = LLMService()

    # 测试用例：基础对话
    test_messages = [
        {"role": "system", "content": "你是一个友好的 AI 伴侣。"},
        {"role": "user", "content": "你好！你是谁？"}
    ]

    print("📝 测试消息：")
    for msg in test_messages:
        print(f"   [{msg['role']}]: {msg['content']}")
    print()

    # 尝试测试不同模型
    test_models = [
        ('gpt-3.5-turbo', 'OpenAI'),
        ('claude-3-haiku-20240307', 'Anthropic'),
        ('glm-4', 'GLM4'),
    ]

    for model, provider_name in test_models:
        print(f"\n{'=' * 60}")
        print(f"测试 {provider_name}: {model}")
        print(f"{'=' * 60}\n")

        try:
            response = await service.complete_chat(
                model=model,
                messages=test_messages,
                temperature=0.7,
                max_tokens=100
            )

            print(f"✅ {provider_name} 响应:")
            print(f"   {response}")

        except Exception as e:
            print(f"⚠️  {provider_name} 测试失败: {str(e)[:100]}")

    print("\n" + "=" * 60)
    print("✅ LLM Service 测试完成")
    print("=" * 60 + "\n")

    return True


if __name__ == '__main__':
    import asyncio
    asyncio.run(test_llm_service())
