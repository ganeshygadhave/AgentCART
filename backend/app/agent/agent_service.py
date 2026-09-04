"""
AgentCART – AI Agent Service (Phase 4)

Orchestrates Gemini AI with structured tool-calling.
The agent's system prompt enforces strict guardrails:
  - No fabricated product data
  - Server-side price authority
  - Explicit confirmation required for cart mutations
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Optional

import httpx
from google import genai
from google.genai import types as genai_types
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.models import Conversation, Message
from app.agent.tools import TOOL_DEFINITIONS, dispatch_tool

settings = get_settings()

SYSTEM_PROMPT = """You are AgentCART, an AI shopping assistant.

RULES (never violate):
1. Always call search_products before mentioning any product. Never invent product names or prices.
2. Never compute prices yourself — call calculate_total for all totals.
3. Only call add_to_cart when user explicitly says "add" or "buy". Never proactively add items.
4. After add_to_cart succeeds, call get_related_products and show results as add-on suggestions.
5. Never initiate payment immediately — wait for explicit checkout/pay intent from user.
6. Before payment, always call get_user_addresses first. Let user pick or add an address.
7. Coupon discounts: call calculate_total with coupon_code to verify. Never promise discounts.
8. For order history, call get_user_orders.
9. Merchant tools (update_order_status, get_store_analytics, get_low_stock): only use in merchant mode.

FORMAT:
- Keep your text responses very brief (1-2 sentences).
- DO NOT manually list out product names, prices, or details in your text response. The UI will automatically display rich product cards for any products you find.
- Just say "Here are the products I found:" or something similar.
- Never use markdown tables.
"""


_gemini_client: Optional[genai.Client] = None

def _get_client() -> Optional[genai.Client]:
    global _gemini_client
    if settings.google_api_key and _gemini_client is None:
        _gemini_client = genai.Client(api_key=settings.google_api_key)
    return _gemini_client


class AgentService:

    @staticmethod
    async def create_conversation(
        db: AsyncSession,
        cart_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Conversation:
        conv = Conversation(
            id=str(uuid.uuid4()),
            user_id=user_id,
            cart_id=cart_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(conv)
        await db.flush()
        return conv

    @staticmethod
    async def get_conversation(
        db: AsyncSession, conversation_id: str
    ) -> Optional[Conversation]:
        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def chat(
        db: AsyncSession,
        conversation_id: str,
        user_message: str,
        cart_id: Optional[str] = None,
        context_product_id: Optional[str] = None,
        user_id: Optional[str] = None,
        store_id: Optional[str] = None,
        mode: str = "customer",
    ) -> dict:
        """
        Process a user message through the Gemini agent with tool calling.

        Returns:
            {
                "response": str,
                "tool_calls": list,
                "cart_updated": bool,
            }
        """
        # Ensure client initialized if API key present
        _get_client()

        # Load conversation history
        conv = await AgentService.get_conversation(db, conversation_id)
        if not conv:
            return {
                "response": "Conversation not found. Please start a new chat.",
                "tool_calls": [],
                "cart_updated": False,
            }

        # Build history for Gemini
        history = []
        for msg in (conv.messages or []):
            if msg.role in ("user", "model"):
                history.append({
                    "role": msg.role,
                    "parts": [{"text": msg.content}],
                })

        # Add context product if provided
        context_suffix = ""
        if context_product_id:
            context_suffix = f"\n\n[User is viewing product ID: {context_product_id}. Call get_product_details('{context_product_id}') to get its details before responding.]"

        # Save user message
        user_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role="user",
            content=user_message,
            created_at=datetime.utcnow(),
        )
        db.add(user_msg)

        if not settings.google_api_key and not settings.groq_api_key:
            mock_response = (
                "I'm AgentCART, your AI shopping assistant. "
            "To enable AI responses, please set your GROQ_API_KEY or GOOGLE_API_KEY in the backend .env file. "
                "In the meantime, you can browse the catalogue and use the cart directly!"
            )
            assistant_msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conversation_id,
                role="assistant",
                content=mock_response,
                created_at=datetime.utcnow(),
            )
            db.add(assistant_msg)
            await db.flush()
            return {
                "response": mock_response,
                "tool_calls": [],
                "cart_updated": False,
            }

        # ─── google-genai Tool-Calling Loop ───────────────────────────────────
        try:
            if settings.groq_api_key:
                final_text, tool_call_logs, cart_updated = await _run_groq_agent(
                    db, conv, user_message, context_suffix, cart_id, user_id, store_id, mode
                )
                raise _GroqCompleted

            client = _get_client()
            tools = _build_genai_tools()

            # Build message history
            contents = []
            for msg in (conv.messages or []):
                if msg.role == "user":
                    contents.append(genai_types.Content(role="user", parts=[genai_types.Part(text=msg.content)]))
                elif msg.role == "assistant":
                    contents.append(genai_types.Content(role="model", parts=[genai_types.Part(text=msg.content)]))

            full_message = user_message + context_suffix
            contents.append(genai_types.Content(role="user", parts=[genai_types.Part(text=full_message)]))

            final_text = ""
            tool_call_logs = []
            cart_updated = False

            # Multi-turn tool-calling loop
            max_turns = 5
            for turn in range(max_turns):
                response = await client.aio.models.generate_content(
                    model=settings.gemini_model,
                    contents=contents,
                    config=genai_types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        tools=tools,
                    ),
                )

                candidate = response.candidates[0]
                # Check for function calls
                fn_calls = [
                    p for p in candidate.content.parts
                    if p.function_call is not None
                ]

                if fn_calls:
                    # Add model response to contents
                    contents.append(candidate.content)

                    # Dispatch all tool calls in this turn
                    tool_response_parts = []
                    for part in fn_calls:
                        fc = part.function_call
                        tool_name = fc.name
                        arguments = dict(fc.args) if fc.args else {}

                        tool_result, was_updated = await dispatch_tool(
                            db, tool_name, arguments, cart_id, user_id, store_id, mode
                        )
                        if was_updated:
                            cart_updated = True

                        tool_call_logs.append({
                            "tool_name": tool_name,
                            "arguments": arguments,
                            "result": tool_result,
                        })

                        tool_response_parts.append(
                            genai_types.Part(
                                function_response=genai_types.FunctionResponse(
                                    name=tool_name,
                                    response={"result": json.dumps(tool_result, default=str)},
                                )
                            )
                        )

                    contents.append(
                        genai_types.Content(role="user", parts=tool_response_parts)
                    )
                else:
                    # Text response — done
                    final_text = response.text or ""
                    break

            if not final_text:
                final_text = "I've processed your request. Is there anything else I can help you with?"

        except _GroqCompleted:
            pass
        except Exception as e:
            if "429" in str(e) or "rate limit" in str(e).lower():
                final_text = "AgentCART is temporarily busy. Please try again in a moment."
            else:
                final_text = f"I encountered an issue: {str(e)[:200]}. Please try again."
            tool_call_logs = []
            cart_updated = False

        # Save assistant response
        assistant_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role="assistant",
            content=final_text,
            tool_calls=tool_call_logs if tool_call_logs else None,
            created_at=datetime.utcnow(),
        )
        db.add(assistant_msg)

        conv.updated_at = datetime.utcnow()
        db.add(conv)
        await db.flush()

        return {
            "response": final_text,
            "tool_calls": tool_call_logs,
            "cart_updated": cart_updated,
        }


def _build_genai_tools():
    """Convert tool definitions to google-genai FunctionDeclaration list."""
    from google.genai import types as t
    declarations = []
    for tool in TOOL_DEFINITIONS:
        props = {}
        required = tool["parameters"].get("required", [])
        for name, schema in tool["parameters"].get("properties", {}).items():
            type_map = {
                "string": "STRING",
                "number": "NUMBER",
                "integer": "INTEGER",
                "boolean": "BOOLEAN",
            }
            props[name] = t.Schema(
                type=type_map.get(schema.get("type", "string"), "STRING"),
                description=schema.get("description", ""),
            )

        declarations.append(
            t.FunctionDeclaration(
                name=tool["name"],
                description=tool["description"],
                parameters=t.Schema(
                    type="OBJECT",
                    properties=props,
                    required=required,
                ),
            )
        )
    return [t.Tool(function_declarations=declarations)]


class _GroqCompleted(Exception):
    """Exit the legacy Gemini loop after a Groq response is complete."""


async def _run_groq_agent(db, conv, user_message, context_suffix, cart_id, user_id=None, store_id=None, mode="customer"):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in (conv.messages or [])[-10:]:
        if msg.role in ("user", "assistant"):
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_message + context_suffix})

    tools = [{"type": "function", "function": tool} for tool in TOOL_DEFINITIONS]
    valid_tool_names = {t["name"] for t in TOOL_DEFINITIONS}
    tool_call_logs = []
    cart_updated = False

    primary_model = settings.groq_model or "llama-3.3-70b-versatile"
    fallback_model = settings.groq_fallback_model or "llama-3.1-8b-instant"

    async def call_groq(http_client, model, payload_messages, with_tools=True):
        payload = {
            "model": model,
            "messages": payload_messages,
            "max_tokens": 1024,
            "temperature": 0.3,
        }
        if with_tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
            payload["parallel_tool_calls"] = False  # prevent duplicate tool calls
        return await http_client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    async with httpx.AsyncClient(timeout=60.0) as http_client:
        for turn in range(6):
            # Try primary, then fallback on 429
            response = await call_groq(http_client, primary_model, messages)
            if response.status_code == 429:
                response = await call_groq(http_client, fallback_model, messages)

            # On 400 (tool validation error), retry without tools
            if response.status_code == 400:
                response = await call_groq(http_client, primary_model, messages, with_tools=False)

            if response.is_error:
                raise RuntimeError(
                    f"Groq API {response.status_code}: {response.text[:300]}"
                )

            assistant_message = response.json()["choices"][0]["message"]

            # Strip any thinking/commentary out of tool_calls name fields
            raw_tool_calls = assistant_message.get("tool_calls") or []
            # Clean tool names in place before appending to messages
            for tc in raw_tool_calls:
                raw_name = tc.get("function", {}).get("name", "")
                if raw_name not in valid_tool_names:
                    for v in valid_tool_names:
                        if v in raw_name:
                            tc["function"]["name"] = v
                            break

            messages.append(assistant_message)

            if not raw_tool_calls:
                # Final text response
                content = assistant_message.get("content") or ""
                return content or "I've processed your request. Is there anything else I can help you with?", tool_call_logs, cart_updated

            # Dispatch tools
            for tool_call in raw_tool_calls:
                function = tool_call.get("function", {})
                clean_tool_name = function.get("name", "")

                try:
                    arguments = json.loads(function.get("arguments") or "{}")
                except Exception:
                    arguments = {}

                if clean_tool_name not in valid_tool_names:
                    tool_result = {"error": f"Unknown tool: {clean_tool_name}"}
                    was_updated = False
                else:
                    tool_result, was_updated = await dispatch_tool(
                        db, clean_tool_name, arguments, cart_id, user_id, store_id, mode
                    )

                cart_updated = cart_updated or was_updated
                tool_call_logs.append({
                    "tool_name": clean_tool_name,
                    "arguments": arguments,
                    "result": tool_result,
                })
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "name": clean_tool_name,
                    "content": json.dumps(tool_result, default=str),
                })

    return "I've processed your request. Is there anything else I can help you with?", tool_call_logs, cart_updated
