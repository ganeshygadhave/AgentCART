"""
AgentCART – AI Agent Tool Definitions (Phase 4)

Tools the LLM can call. Each tool is:
  1. Defined as a Pydantic schema for structured calls
  2. Implemented as an async function that talks to services
  3. NEVER allowed to fabricate prices, stock, or product details

Guardrails enforced in system prompt:
  - Agent MUST call search_products before recommending
  - Agent MUST call get_cart before quoting totals
  - Agent NEVER computes discounts — it calls calculate_total
"""
from __future__ import annotations

import json
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_, select

from app.services.product_service import ProductService
from app.models.models import Cart, CartItem, OrderItem, Product
from app.services.cart_service import CartService
from app.schemas.product import ProductResponse
from app.schemas.cart import CartResponse


# ─── Tool Implementations ─────────────────────────────────────────────────────

async def tool_search_products(
    db: AsyncSession,
    query: str,
    category: Optional[str] = None,
    max_price: Optional[float] = None,
    limit: int = 6,
) -> dict:
    """Search the product catalogue. Always call this before recommending products."""
    products = await ProductService.list_products(
        db,
        q=query,
        category=category,
        max_price=max_price,
        sort="rating",
        limit=limit,
    )
    items = [ProductResponse.from_orm_model(p) for p in products]
    return {
        "count": len(items),
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "brand": p.brand,
                "category": p.category,
                "price": p.price,
                "price_paise": p.price_paise,
                "original_price": p.original_price,
                "stock_quantity": p.stock_quantity,
                "rating": p.rating,
                "image_url": p.image_url,
                "description": (p.description or "")[:200],
            }
            for p in items
        ],
    }


async def tool_get_product_details(db: AsyncSession, product_id: str) -> dict:
    """Get full details of a specific product by ID."""
    product = await ProductService.get_product(db, product_id)
    if not product:
        return {"error": f"Product '{product_id}' not found."}
    p = ProductResponse.from_orm_model(product)
    return {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "brand": p.brand,
        "category": p.category,
        "description": p.description,
        "price": p.price,
        "price_paise": p.price_paise,
        "original_price": p.original_price,
        "stock_quantity": p.stock_quantity,
        "rating": p.rating,
        "review_count": p.review_count,
        "tags": p.tags,
        "image_url": p.image_url,
    }


async def tool_get_related_products(db: AsyncSession, cart_id: str, limit: int = 3) -> dict:
    """Recommend in-stock products commonly bought with the current cart."""
    cart = await CartService.get_cart(db, cart_id)
    cart_product_ids = [item.product_id for item in cart.items]
    if not cart_product_ids:
        return {"count": 0, "products": []}

    co_purchased = (
        select(OrderItem.product_id, func.count(OrderItem.product_id).label("purchase_count"))
        .where(
            OrderItem.order_id.in_(
                select(OrderItem.order_id).where(OrderItem.product_id.in_(cart_product_ids))
            ),
            ~OrderItem.product_id.in_(cart_product_ids),
        )
        .group_by(OrderItem.product_id)
        .order_by(func.count(OrderItem.product_id).desc())
        .limit(limit)
    )
    results = await db.execute(co_purchased)
    recommendations = [(product_id, count) for product_id, count in results.all()]

    if recommendations:
        recommended_ids = [product_id for product_id, _ in recommendations]
        products_result = await db.execute(
            select(Product).where(Product.id.in_(recommended_ids), Product.is_active.is_(True), Product.stock_quantity > 0)
        )
        products_by_id = {product.id: product for product in products_result.scalars().all()}
        products = [products_by_id[product_id] for product_id, _ in recommendations if product_id in products_by_id]
    else:
        cart_products = [item.product for item in cart.items if item.product]
        categories = {product.category for product in cart_products}
        complementary_terms = set()
        for product in cart_products:
            searchable = f"{product.name} {product.tags or ''}".lower()
            if "laptop" in searchable or "macbook" in searchable:
                complementary_terms.update({"mouse", "keyboard", "sleeve", "ssd", "bag"})
            if "headphone" in searchable or "earbud" in searchable or "audio" in searchable:
                complementary_terms.update({"case", "stand", "speaker", "audio"})
            if "phone" in searchable or "mobile" in searchable:
                complementary_terms.update({"case", "charger", "power", "cable"})

        related_filters = [
            condition
            for term in complementary_terms
            for condition in (Product.name.ilike(f"%{term}%"), Product.tags.ilike(f"%{term}%"))
        ]
        fallback = await db.execute(
            select(Product)
            .where(
                Product.is_active.is_(True),
                Product.stock_quantity > 0,
                ~Product.id.in_(cart_product_ids),
                or_(*related_filters) if related_filters else Product.category.in_(categories),
            )
            .order_by(Product.rating.desc().nullslast())
            .limit(limit * 3)
        )
        products = list(fallback.scalars().all())[:limit]

    return {
        "count": len(products),
        "basis": "frequently bought together" if recommendations else "similar catalogue items",
        "products": [
            {
                "id": product.id,
                "name": product.name,
                "brand": product.brand,
                "category": product.category,
                "price": product.price,
                "price_paise": product.price_paise,
                "original_price": product.original_price,
                "stock_quantity": product.stock_quantity,
                "rating": product.rating,
                "image_url": product.image_url,
                "description": (product.description or "")[:200],
            }
            for product in products
        ],
    }


async def tool_add_to_cart(
    db: AsyncSession, cart_id: str, product_id: str, quantity: int = 1
) -> dict:
    """Add a product to the user's cart. Returns updated cart summary."""
    try:
        cart = await CartService.add_item(db, cart_id, product_id, quantity)
        discount_paise = await CartService.compute_discount(db, cart)
        cart_resp = CartResponse.from_orm_model(cart, discount_paise)
        related = await tool_get_related_products(db, cart_id)
        return {
            "success": True,
            "cart_updated": True,
            "message": f"Added {quantity} item(s) to cart.",
            "cart_item_count": cart_resp.item_count,
            "cart_total": cart_resp.total,
            "related_products": related,
        }
    except Exception as e:
        return {"success": False, "cart_updated": False, "error": str(e)}


async def tool_remove_from_cart(
    db: AsyncSession, cart_id: str, item_id: str
) -> dict:
    """Remove an item from the cart by item ID."""
    try:
        cart = await CartService.remove_item(db, cart_id, item_id)
        discount_paise = await CartService.compute_discount(db, cart)
        cart_resp = CartResponse.from_orm_model(cart, discount_paise)
        return {
            "success": True,
            "cart_updated": True,
            "message": "Item removed from cart.",
            "cart_item_count": cart_resp.item_count,
            "cart_total": cart_resp.total,
        }
    except Exception as e:
        return {"success": False, "cart_updated": False, "error": str(e)}


async def tool_get_cart(db: AsyncSession, cart_id: str) -> dict:
    """Get the current cart contents and authoritative totals."""
    try:
        cart = await CartService.get_cart(db, cart_id)
        discount_paise = await CartService.compute_discount(db, cart)
        cart_resp = CartResponse.from_orm_model(cart, discount_paise)
        return {
            "cart_id": cart_resp.id,
            "item_count": cart_resp.item_count,
            "items": [
                {
                    "item_id": item.id,
                    "product_name": item.product.name if item.product else "Unknown",
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "subtotal": item.subtotal,
                }
                for item in cart_resp.items
            ],
            "subtotal": cart_resp.subtotal,
            "discount_amount": cart_resp.discount_amount,
            "total": cart_resp.total,
            "applied_coupon": cart_resp.applied_coupon_code,
        }
    except Exception as e:
        return {"error": str(e)}


async def tool_calculate_total(
    db: AsyncSession, cart_id: str, coupon_code: Optional[str] = None
) -> dict:
    """
    Calculate authoritative cart total with optional coupon validation.
    ALWAYS use this instead of computing totals yourself.
    """
    try:
        cart = await CartService.get_cart(db, cart_id)
        from app.policy.policy_engine import PolicyEngine
        result = await PolicyEngine.calculate_authoritative_total(db, cart, coupon_code)
        return {
            "subtotal": result["subtotal_paise"] / 100,
            "discount_amount": result["discount_paise"] / 100,
            "total": result["total_paise"] / 100,
            "applied_coupon": result["applied_coupon"],
            "coupon_valid": result["applied_coupon"] is not None if coupon_code else None,
        }
    except Exception as e:
        return {"error": str(e)}

async def tool_get_user_addresses(db: AsyncSession, user_id: str) -> dict:
    """Get customer's saved shipping addresses."""
    from app.services.user_service import get_user_addresses
    addresses = await get_user_addresses(db, user_id)
    return {
        "count": len(addresses),
        "addresses": [
            {
                "id": a.id,
                "label": a.label,
                "full_name": a.full_name,
                "phone": a.phone,
                "street_address": a.street_address,
                "city": a.city,
                "state": a.state,
                "pincode": a.pincode,
                "is_default": a.is_default,
            }
            for a in addresses
        ],
    }

async def tool_add_user_address(db: AsyncSession, user_id: str, label: str, full_name: str,
    phone: str, street_address: str, city: str, state: str, pincode: str) -> dict:
    """Add a new shipping address to the customer's global profile."""
    from app.services.user_service import add_user_address
    address = await add_user_address(db, user_id, label, full_name, phone, street_address, city, state, pincode)
    return {"success": True, "address_id": address.id, "message": f"Address '{label}' saved to your profile."}

async def tool_get_user_orders(db: AsyncSession, user_id: str, store_id: Optional[str] = None) -> dict:
    """Get customer's order history. If store_id provided, filters to that store only."""
    from app.services.user_service import get_user_orders
    orders = await get_user_orders(db, user_id, store_id)
    return {
        "count": len(orders),
        "orders": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "status": o.status.value if hasattr(o.status, 'value') else str(o.status),
                "total": o.total_paise / 100,
                "item_count": len(o.items),
                "tracking_link": o.tracking_link,
                "tracking_carrier": o.tracking_carrier,
                "shipped_at": str(o.shipped_at) if o.shipped_at else None,
                "delivered_at": str(o.delivered_at) if o.delivered_at else None,
                "created_at": str(o.created_at),
            }
            for o in orders
        ],
    }

async def tool_update_order_status(db: AsyncSession, store_id: str, order_id: str,
    status: str, tracking_link: Optional[str] = None, tracking_carrier: Optional[str] = None) -> dict:
    """[MERCHANT ONLY] Update order fulfillment status and optionally set tracking link."""
    from app.services.merchant_service import update_order_status
    try:
        order = await update_order_status(db, order_id, store_id, status, tracking_link, tracking_carrier)
        return {
            "success": True,
            "order_id": order.id,
            "new_status": status,
            "tracking_link": tracking_link,
            "message": f"Order {order.order_number} updated to '{status}'.",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

async def tool_get_store_analytics(db: AsyncSession, store_id: str) -> dict:
    """[MERCHANT ONLY] Get revenue analytics for the store."""
    from app.services.merchant_service import get_store_analytics
    return await get_store_analytics(db, store_id)

async def tool_get_low_stock(db: AsyncSession, store_id: str, threshold: int = 10) -> dict:
    """[MERCHANT ONLY] Get products with stock below threshold."""
    from app.services.merchant_service import get_low_stock_products
    products = await get_low_stock_products(db, store_id, threshold)
    return {
        "count": len(products),
        "threshold": threshold,
        "products": [{"id": p.id, "name": p.name, "sku": p.sku, "stock_quantity": p.stock_quantity} for p in products],
    }


async def tool_get_agent_analytics(db: AsyncSession, store_id: str) -> dict:
    """[MERCHANT ONLY] Get AI agent performance analytics by mining conversation/message data."""
    from sqlalchemy import select as sa_select
    from app.models.models import Conversation, Message, Order, OrderStatus, Cart

    carts_result = await db.execute(
        sa_select(Cart.id).where(Cart.store_id == store_id)
    )
    store_cart_ids = [row[0] for row in carts_result.all()]

    if not store_cart_ids:
        return {
            "total_conversations": 0, "converted_conversations": 0,
            "conversion_rate": 0.0, "top_searched_queries": [],
            "top_recommended_products": []
        }

    conv_result = await db.execute(
        sa_select(func.count(Conversation.id)).where(Conversation.cart_id.in_(store_cart_ids))
    )
    total_convs = conv_result.scalar() or 0

    paid_carts_result = await db.execute(
        sa_select(Order.cart_id).where(
            Order.store_id == store_id,
            Order.status.in_([OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED]),
            Order.cart_id.isnot(None)
        )
    )
    paid_cart_ids = {row[0] for row in paid_carts_result.all()}

    converted_convs = 0
    if paid_cart_ids:
        converted_result = await db.execute(
            sa_select(func.count(Conversation.id)).where(Conversation.cart_id.in_(paid_cart_ids))
        )
        converted_convs = converted_result.scalar() or 0

    conversion_rate = round((converted_convs / total_convs * 100), 1) if total_convs > 0 else 0.0

    msgs_result = await db.execute(
        sa_select(Message.tool_calls)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.cart_id.in_(store_cart_ids), Message.tool_calls.isnot(None))
        .limit(500)
    )
    query_counts: dict = {}
    product_counts: dict = {}
    for (tool_calls,) in msgs_result.all():
        if not tool_calls or not isinstance(tool_calls, list):
            continue
        for tc in tool_calls:
            if tc.get("tool_name") == "search_products":
                q = tc.get("arguments", {}).get("query", "").strip().lower()
                if q:
                    query_counts[q] = query_counts.get(q, 0) + 1
            if tc.get("tool_name") in ("search_products", "get_product_details"):
                for prod in tc.get("result", {}).get("products", []):
                    pid = prod.get("id", "")
                    if pid:
                        if pid not in product_counts:
                            product_counts[pid] = {"name": prod.get("name", ""), "count": 0}
                        product_counts[pid]["count"] += 1

    top_queries = sorted(
        [{"query": q, "count": c} for q, c in query_counts.items()],
        key=lambda x: x["count"], reverse=True
    )[:8]
    top_products = sorted(
        [{"product_id": pid, "name": v["name"], "count": v["count"]} for pid, v in product_counts.items()],
        key=lambda x: x["count"], reverse=True
    )[:8]

    return {
        "total_conversations": total_convs, "converted_conversations": converted_convs,
        "conversion_rate": conversion_rate,
        "top_searched_queries": top_queries, "top_recommended_products": top_products
    }


# ─── Tool Registry ─────────────────────────────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "name": "search_products",
        "description": (
            "Search the AgentCART product catalogue. "
            "Always call this before recommending any products. "
            "Never make up product names or prices."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "category": {"type": "string", "description": "Optional category filter"},
                "max_price": {"type": "number", "description": "Optional max price in rupees"},
                "limit": {"type": "integer", "description": "Max results (1-10)", "default": 6},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_product_details",
        "description": "Get full details of a specific product by its ID.",
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {"type": "string", "description": "Product ID"},
            },
            "required": ["product_id"],
        },
    },
    {
        "name": "get_related_products",
        "description": (
            "Recommend up to three in-stock products frequently bought with items in the cart. "
            "Call this after a successful add_to_cart before asking the customer to proceed to payment."
        ),
        "parameters": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "description": "Maximum recommendations (1-3)"}},
            "required": [],
        },
    },
    {
        "name": "add_to_cart",
        "description": (
            "Add a product to the user's cart. "
            "Only call this when the user explicitly asks to add an item."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {"type": "string", "description": "Product ID to add"},
                "quantity": {"type": "integer", "description": "Quantity to add", "default": 1},
            },
            "required": ["product_id"],
        },
    },
    {
        "name": "remove_from_cart",
        "description": "Remove an item from the cart using its cart item ID.",
        "parameters": {
            "type": "object",
            "properties": {
                "item_id": {"type": "string", "description": "Cart item ID to remove"},
            },
            "required": ["item_id"],
        },
    },
    {
        "name": "get_cart",
        "description": (
            "Get the current cart contents and authoritative totals. "
            "Always call this before quoting prices or totals to the user."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "calculate_total",
        "description": (
            "Calculate the authoritative cart total, optionally with a coupon code. "
            "Never compute totals yourself — always use this tool."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "coupon_code": {"type": "string", "description": "Optional coupon code to test"},
            },
            "required": [],
        },
    },
    {
        "name": "get_user_addresses",
        "description": "Get the customer's saved global delivery addresses. Call this when customer wants to checkout to present address options.",
        "parameters": {"type": "object", "properties": {"user_id": {"type": "string", "description": "Customer user ID"}}, "required": ["user_id"]},
    },
    {
        "name": "add_user_address",
        "description": "Add a new delivery address to the customer's global profile.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"}, "label": {"type": "string"}, "full_name": {"type": "string"},
                "phone": {"type": "string"}, "street_address": {"type": "string"},
                "city": {"type": "string"}, "state": {"type": "string"}, "pincode": {"type": "string"},
            },
            "required": ["user_id", "label", "full_name", "phone", "street_address", "city", "state", "pincode"],
        },
    },
    {
        "name": "get_user_orders",
        "description": "Get the customer's order history. Optionally filter by store_id to show store-specific orders.",
        "parameters": {
            "type": "object",
            "properties": {"user_id": {"type": "string"}, "store_id": {"type": "string", "description": "Optional: filter to specific store"}},
            "required": ["user_id"],
        },
    },
    {
        "name": "update_order_status",
        "description": "[MERCHANT ONLY] Update the fulfillment status of an order and optionally attach a tracking link.",
        "parameters": {
            "type": "object",
            "properties": {
                "store_id": {"type": "string"}, "order_id": {"type": "string"},
                "status": {"type": "string", "description": "One of: shipped, in_transit, delivered"},
                "tracking_link": {"type": "string"}, "tracking_carrier": {"type": "string"},
            },
            "required": ["store_id", "order_id", "status"],
        },
    },
    {
        "name": "get_store_analytics",
        "description": "[MERCHANT ONLY] Get revenue and order analytics for the store.",
        "parameters": {"type": "object", "properties": {"store_id": {"type": "string"}}, "required": ["store_id"]},
    },
    {
        "name": "get_low_stock",
        "description": "[MERCHANT ONLY] Get products with stock below a threshold.",
        "parameters": {
            "type": "object",
            "properties": {"store_id": {"type": "string"}, "threshold": {"type": "integer", "description": "Default 10"}},
            "required": ["store_id"],
        },
    },
    {
        "name": "get_agent_analytics",
        "description": "[MERCHANT ONLY] Get AI agent performance analytics: conversion rate, top searched queries, most recommended products.",
        "parameters": {
            "type": "object",
            "properties": {"store_id": {"type": "string", "description": "Store ID"}},
            "required": ["store_id"],
        },
    },
]


async def dispatch_tool(
    db: AsyncSession,
    tool_name: str,
    arguments: dict,
    cart_id: Optional[str] = None,
    user_id: Optional[str] = None,
    store_id: Optional[str] = None,
    mode: str = "customer",
) -> tuple[Any, bool]:
    """
    Dispatch a tool call to the correct implementation.
    Returns (result, cart_was_updated).
    """
    cart_updated = False

    if tool_name == "search_products":
        result = await tool_search_products(db, **arguments)
    elif tool_name == "get_product_details":
        result = await tool_get_product_details(db, **arguments)
    elif tool_name == "get_related_products":
        if not cart_id:
            return {"error": "No cart_id provided."}, False
        result = await tool_get_related_products(db, cart_id, **arguments)
    elif tool_name == "add_to_cart":
        if not cart_id:
            return {"error": "No cart_id provided."}, False
        result = await tool_add_to_cart(db, cart_id, **arguments)
        cart_updated = result.get("cart_updated", False)
    elif tool_name == "remove_from_cart":
        if not cart_id:
            return {"error": "No cart_id provided."}, False
        result = await tool_remove_from_cart(db, cart_id, **arguments)
        cart_updated = result.get("cart_updated", False)
    elif tool_name == "get_cart":
        if not cart_id:
            return {"error": "No cart_id provided."}, False
        result = await tool_get_cart(db, cart_id)
    elif tool_name == "calculate_total":
        if not cart_id:
            return {"error": "No cart_id provided."}, False
        result = await tool_calculate_total(db, cart_id, **arguments)
    elif tool_name == "get_user_addresses":
        result = await tool_get_user_addresses(db, **arguments)
    elif tool_name == "add_user_address":
        result = await tool_add_user_address(db, **arguments)
    elif tool_name == "get_user_orders":
        result = await tool_get_user_orders(db, **arguments)
    elif tool_name == "update_order_status":
        result = await tool_update_order_status(db, **arguments)
    elif tool_name == "get_store_analytics":
        result = await tool_get_store_analytics(db, **arguments)
    elif tool_name == "get_low_stock":
        result = await tool_get_low_stock(db, **arguments)
    elif tool_name == "get_agent_analytics":
        result = await tool_get_agent_analytics(db, **arguments)
    else:
        result = {"error": f"Unknown tool: {tool_name}"}

    return result, cart_updated
