"""
AgentCART – Agent Chat Pydantic Schemas
"""
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class NewConversationRequest(BaseModel):
    cart_id: Optional[str] = None
    user_id: Optional[str] = None


class ConversationResponse(BaseModel):
    id: str
    cart_id: Optional[str] = None
    user_id: Optional[str] = None
    created_at: datetime


class ChatRequest(BaseModel):
    conversation_id: str
    cart_id: Optional[str] = None
    message: str
    context_product_id: Optional[str] = None
    user_id: Optional[str] = None
    store_id: Optional[str] = None
    mode: str = "customer"


class ToolCallLog(BaseModel):
    tool_name: str
    arguments: dict[str, Any]
    result: Any


class ChatResponse(BaseModel):
    conversation_id: str
    response: str
    tool_calls: Optional[list[ToolCallLog]] = None
    cart_updated: bool = False


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    tool_calls: Optional[Any] = None
    created_at: datetime

    model_config = {"from_attributes": True}
