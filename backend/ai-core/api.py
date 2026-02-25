"""
AI Companion API - Phase 8: REST API
FastAPI 后端接口（整合所有服务）
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator
import json
import uvicorn

# 导入服务
from chat_service_fixed import ChatService

# 创建 FastAPI 应用
app = FastAPI(
    title="AI Companion API",
    description="AI Companion 2.1 - REST API",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== 数据模型 =====

class ChatRequest(BaseModel):
    user_id: str
    character_id: str
    message: str
    character: dict
    model: str = "gpt-3.5-turbo"
    stream: bool = True
    temperature: float = 0.7
    max_tokens: int = 1000

class ChatResponse(BaseModel):
    type: str
    role: Optional[str] = None
    content: str
    event_data: Optional[dict] = None
    item_data: Optional[dict] = None

# ===== 初始化服务 =====

chat_service = ChatService()


# ===== API 端点 =====

@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "services": {
            "chat": "ready",
            "memory": chat_service.memory_service is not None,
            "inventory": chat_service.inventory_service is not None,
            "hidden_events": chat_service.hidden_event_service is not None
        }
    }


@app.get("/api/v1/characters/{character_id}")
async def get_character(character_id: str):
    """获取角色信息"""
    # 模拟角色数据（实际应从数据库获取）
    mock_characters = {
        'char-1': {
            'id': 'char-1',
            'name': 'Luna',
            'gender': 'female',
            'appearance': 95,
            'luck': 90,
            'personality': {
                'traits': ['warm', 'curious', 'playful'],
                'speakingStyle': 'casual',
                'backStory': 'Luna is a friendly AI companion who loves learning about people.'
            },
            'stats': {
                'strength': 70,
                'intelligence': 85,
                'charisma': 90,
                'appearance': 95
            },
            'relationshipLevel': 0
        },
        'char-2': {
            'id': 'char-2',
            'name': 'Max',
            'gender': 'male',
            'appearance': 70,
            'luck': 50,
            'personality': {
                'traits': ['adventurous', 'daring', 'humorous'],
                'speakingStyle': 'direct',
                'backStory': 'Max is a brave explorer who never fears new challenges.'
            },
            'stats': {
                'strength': 80,
                'intelligence': 60,
                'charisma': 70,
                'appearance': 70
            },
            'relationshipLevel': 0
        }
    }

    if character_id not in mock_characters:
        raise HTTPException(status_code=404, detail="Character not found")

    return mock_characters[character_id]


@app.post("/api/v1/chat/stream")
async def stream_chat(request: ChatRequest):
    """流式聊天接口"""
    
    async def generate():
        try:
            if not chat_service._initialized:
                await chat_service.initialize()

            async for response in chat_service.chat(
                user_id=request.user_id,
                character_id=request.character_id,
                user_message=request.message,
                character=request.character,
                model=request.model,
                stream=request.stream,
                temperature=request.temperature,
                max_tokens=request.max_tokens
            ):
                # 发送 JSON 响应
                yield json.dumps({
                    "type": response.get('type'),
                    "role": response.get('role'),
                    "content": response.get('content'),
                    "event_data": response.get('event_data'),
                    "item_data": response.get('item_data')
                }) + "\n"

        except Exception as e:
            yield json.dumps({
                "type": "error",
                "error": str(e)
            }) + "\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )


@app.post("/api/v1/chat/complete")
async def complete_chat(request: ChatRequest):
    """完整聊天接口（非流式）"""
    try:
        if not chat_service._initialized:
            await chat_service.initialize()

        full_response = ""
        events = []
        item_drops = []

        async for response in chat_service.chat(
            user_id=request.user_id,
            character_id=request.character_id,
            user_message=request.message,
            character=request.character,
            model=request.model,
            stream=True,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        ):
            if response['type'] == 'chat':
                full_response += response['content']
            elif response['type'] == 'hidden-event':
                events.append(response['event_data'])
            elif response['type'] == 'item-drop':
                item_drops.append(response['item_data'])

        return {
            "content": full_response,
            "model": request.model,
            "events": events,
            "item_drops": item_drops
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/inventory/{user_id}")
async def get_inventory(user_id: str):
    """获取用户背包"""
    if not chat_service.inventory_service:
        raise HTTPException(status_code=500, detail="Inventory service not available")

    try:
        inventory = chat_service.inventory_service.get_inventory(user_id=user_id)

        # 转换为前端格式
        items = []
        for item in inventory:
            items.append({
                'item_id': item['item_id'],
                'name': item['name'],
                'type': item['type'],
                'rarity': item['rarity'],
                'stats': item['stats'],
                'effect_description': item['effect_description'],
                'icon_url': item.get('icon_url')
            })

        return {
            'items': items,
            'count': len(items)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/inventory/use")
async def use_item(user_id: str, item_id: str):
    """使用道具"""
    if not chat_service.inventory_service:
        raise HTTPException(status_code=500, detail="Inventory service not available")

    try:
        result = chat_service.inventory_service.use_item(item_id=item_id, user_id=user_id)

        if not result:
            raise HTTPException(status_code=404, detail="Item not found")

        return {
            'success': True,
            'item_name': result['item_name'],
            'effect': result['effect']
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== 启动服务 =====

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("🚀 AI Companion API 启动")
    print("=" * 60 + "\n")

    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
