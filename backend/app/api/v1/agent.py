"""
AgentCART – Agent API Router (Phase 4)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.agent.agent_service import AgentService
from app.schemas.agent import (
    NewConversationRequest,
    ConversationResponse,
    ChatRequest,
    ChatResponse,
    ToolCallLog,
)

router = APIRouter()


@router.post("/agent/conversation", response_model=ConversationResponse, status_code=201)
async def new_conversation(
    body: NewConversationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start a new agent conversation, optionally linked to a cart."""
    conv = await AgentService.create_conversation(
        db, cart_id=body.cart_id, user_id=body.user_id
    )
    return ConversationResponse(
        id=conv.id,
        cart_id=conv.cart_id,
        user_id=conv.user_id,
        created_at=conv.created_at,
    )


@router.post("/agent/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Send a message to AgentCART.
    The agent uses Gemini with tool-calling to search products, manage cart, etc.
    All tool calls are logged for the audit trail.
    """
    result = await AgentService.chat(
        db,
        conversation_id=body.conversation_id,
        user_message=body.message,
        cart_id=body.cart_id,
        context_product_id=body.context_product_id,
        user_id=body.user_id,
        store_id=body.store_id,
        mode=body.mode,
    )

    tool_calls = [
        ToolCallLog(
            tool_name=tc["tool_name"],
            arguments=tc["arguments"],
            result=tc["result"],
        )
        for tc in (result.get("tool_calls") or [])
    ]

    return ChatResponse(
        conversation_id=body.conversation_id,
        response=result["response"],
        tool_calls=tool_calls if tool_calls else None,
        cart_updated=result.get("cart_updated", False),
    )
