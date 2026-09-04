"""
AgentCART – Cart API Router (Phase 3)
"""
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.db.database import get_db
from app.services.cart_service import CartService
from app.agent.tools import tool_get_related_products
from app.models.models import MerchantPolicy
from app.policy.policy_engine import PolicyEngine
from app.schemas.cart import (
    CartResponse, AddItemRequest, UpdateItemRequest, ApplyCouponRequest
)

router = APIRouter()


def _cart_response(cart, discount_paise: int = 0) -> CartResponse:
    return CartResponse.from_orm_model(cart, discount_paise)


@router.post("/cart", response_model=CartResponse, status_code=201)
async def create_cart(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    db: AsyncSession = Depends(get_db),
):
    """Create a new cart (guest or user)."""
    cart = await CartService.create_cart(db, session_id=x_session_id)
    return _cart_response(cart)


@router.get("/cart/{cart_id}", response_model=CartResponse)
async def get_cart(cart_id: str, db: AsyncSession = Depends(get_db)):
    """Get cart by ID with all items and authoritative totals."""
    cart = await CartService.get_cart(db, cart_id)
    discount_paise = await CartService.compute_discount(db, cart)
    return _cart_response(cart, discount_paise)


@router.get("/cart/{cart_id}/related-products")
async def get_related_products(cart_id: str, db: AsyncSession = Depends(get_db)):
    """Return catalogue-backed products commonly paired with this cart."""
    return await tool_get_related_products(db, cart_id)


@router.get("/cart/{cart_id}/available-discounts")
async def get_available_discounts(cart_id: str, db: AsyncSession = Depends(get_db)):
    """Return only currently valid discounts that save money on this cart."""
    cart = await CartService.get_cart(db, cart_id)
    subtotal_paise = sum(item.unit_price_paise * item.quantity for item in (cart.items or []))
    result = await db.execute(select(MerchantPolicy).where(MerchantPolicy.is_active.is_(True)))
    discounts = []
    for policy in result.scalars().all():
        categories = {item.product.category for item in (cart.items or []) if item.product}
        discount_paise, error = await PolicyEngine.validate_discount(db, policy.code, subtotal_paise, categories)
        if not error and discount_paise > 0:
            discounts.append({"code": policy.code, "discount_paise": discount_paise, "discount": round(discount_paise / 100, 2)})
    return {"discounts": discounts}


@router.post("/cart/{cart_id}/items", response_model=CartResponse)
async def add_item(
    cart_id: str,
    body: AddItemRequest,
    db: AsyncSession = Depends(get_db),
):
    """Add a product to the cart. Stock is validated server-side."""
    cart = await CartService.add_item(db, cart_id, body.product_id, body.quantity)
    discount_paise = await CartService.compute_discount(db, cart)
    return _cart_response(cart, discount_paise)


@router.patch("/cart/{cart_id}/items/{item_id}", response_model=CartResponse)
async def update_item(
    cart_id: str,
    item_id: str,
    body: UpdateItemRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update item quantity. Stock validated server-side."""
    cart = await CartService.update_item(db, cart_id, item_id, body.quantity)
    discount_paise = await CartService.compute_discount(db, cart)
    return _cart_response(cart, discount_paise)


@router.delete("/cart/{cart_id}/items/{item_id}", response_model=CartResponse)
async def remove_item(
    cart_id: str,
    item_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Remove an item from the cart."""
    cart = await CartService.remove_item(db, cart_id, item_id)
    discount_paise = await CartService.compute_discount(db, cart)
    return _cart_response(cart, discount_paise)


@router.post("/cart/{cart_id}/coupon", response_model=CartResponse)
async def apply_coupon(
    cart_id: str,
    body: ApplyCouponRequest,
    db: AsyncSession = Depends(get_db),
):
    """Apply a coupon code. Validates against merchant policy engine."""
    cart, discount_paise = await CartService.apply_coupon(db, cart_id, body.code)
    return _cart_response(cart, discount_paise)


@router.delete("/cart/{cart_id}/coupon", response_model=CartResponse)
async def remove_coupon(cart_id: str, db: AsyncSession = Depends(get_db)):
    """Remove applied coupon from cart."""
    cart = await CartService.remove_coupon(db, cart_id)
    return _cart_response(cart, 0)


@router.delete("/cart/{cart_id}/items", response_model=CartResponse)
async def clear_cart(cart_id: str, db: AsyncSession = Depends(get_db)):
    """Remove all items from the cart."""
    cart = await CartService.clear_items(db, cart_id)
    return _cart_response(cart, 0)
