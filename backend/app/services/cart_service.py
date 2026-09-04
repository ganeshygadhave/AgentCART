"""
AgentCART – Cart Service (Phase 3)

Single source of truth for all cart operations.
The LLM agent calls tools that call this service.
All price calculations are done server-side only.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.models import Cart, CartItem, Product
from app.services.product_service import ProductService


class CartService:

    @staticmethod
    async def _load_cart(db: AsyncSession, cart_id: str) -> Optional[Cart]:
        """
        Load a cart with all items and their products eagerly.
        Commits pending work first so the identity-map is fresh.
        """
        await db.commit()        # Flush + commit so re-query sees latest writes
        db.expire_all()          # Evict stale objects from the identity map (sync)
        result = await db.execute(
            select(Cart)
            .options(
                selectinload(Cart.items).selectinload(CartItem.product)
            )
            .where(Cart.id == cart_id, Cart.is_active == True)
        )
        return result.scalar_one_or_none()

    # ─── Public API ───────────────────────────────────────────────────────────

    @staticmethod
    async def create_cart(
        db: AsyncSession,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Cart:
        cart = Cart(
            id=str(uuid.uuid4()),
            user_id=user_id,
            session_id=session_id or str(uuid.uuid4()),
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(cart)
        await db.commit()
        # Fresh cart has no items — set directly to avoid ORM lazy-load
        cart.__dict__.setdefault('items', [])
        return cart

    @staticmethod
    async def get_cart(db: AsyncSession, cart_id: str) -> Cart:
        cart = await CartService._load_cart(db, cart_id)
        if not cart:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
        return cart

    @staticmethod
    async def add_item(
        db: AsyncSession,
        cart_id: str,
        product_id: str,
        quantity: int = 1,
    ) -> Cart:
        # Load cart (commits any pending work)
        cart = await CartService._load_cart(db, cart_id)
        if not cart:
            raise HTTPException(status_code=404, detail="Cart not found")

        # Validate product & stock
        product = await ProductService.get_product(db, product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")
        if product.stock_quantity < quantity:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Insufficient stock. Only {product.stock_quantity} units available.",
            )

        # Check if item already in cart
        existing = next((i for i in cart.items if i.product_id == product_id), None)
        if existing:
            new_qty = existing.quantity + quantity
            if new_qty > product.stock_quantity:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Cannot add {quantity} more. Only {product.stock_quantity - existing.quantity} units available.",
                )
            existing.quantity = new_qty
            db.add(existing)
        else:
            item = CartItem(
                id=str(uuid.uuid4()),
                cart_id=cart_id,
                product_id=product_id,
                quantity=quantity,
                unit_price_paise=product.price_paise,  # Price locked at add time
                added_at=datetime.utcnow(),
            )
            db.add(item)

        cart.updated_at = datetime.utcnow()
        db.add(cart)

        # Re-fetch with fresh data (commit inside _load_cart)
        return await CartService._load_cart(db, cart_id)

    @staticmethod
    async def update_item(
        db: AsyncSession,
        cart_id: str,
        item_id: str,
        quantity: int,
    ) -> Cart:
        cart = await CartService._load_cart(db, cart_id)
        if not cart:
            raise HTTPException(status_code=404, detail="Cart not found")

        item = next((i for i in cart.items if i.id == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail="Cart item not found")

        ok, stock = await ProductService.check_stock(db, item.product_id, quantity)
        if not ok:
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient stock. Only {stock} units available.",
            )

        item.quantity = quantity
        cart.updated_at = datetime.utcnow()
        db.add(item)
        db.add(cart)

        return await CartService._load_cart(db, cart_id)

    @staticmethod
    async def remove_item(db: AsyncSession, cart_id: str, item_id: str) -> Cart:
        cart = await CartService._load_cart(db, cart_id)
        if not cart:
            raise HTTPException(status_code=404, detail="Cart not found")

        item = next((i for i in cart.items if i.id == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail="Cart item not found")

        await db.delete(item)
        cart.updated_at = datetime.utcnow()
        db.add(cart)

        return await CartService._load_cart(db, cart_id)

    @staticmethod
    async def apply_coupon(db: AsyncSession, cart_id: str, code: str) -> tuple[Cart, int]:
        """Apply a coupon and return (cart, discount_paise)."""
        cart = await CartService._load_cart(db, cart_id)
        if not cart:
            raise HTTPException(status_code=404, detail="Cart not found")

        from app.policy.policy_engine import PolicyEngine
        subtotal_paise = sum(i.unit_price_paise * i.quantity for i in cart.items)
        categories = {item.product.category for item in cart.items if item.product}
        discount_paise, error = await PolicyEngine.validate_discount(db, code, subtotal_paise, categories)

        if error:
            raise HTTPException(status_code=422, detail=error)

        cart.applied_coupon_code = code
        cart.updated_at = datetime.utcnow()
        db.add(cart)

        return await CartService._load_cart(db, cart_id), discount_paise

    @staticmethod
    async def remove_coupon(db: AsyncSession, cart_id: str) -> Cart:
        cart = await CartService._load_cart(db, cart_id)
        if not cart:
            raise HTTPException(status_code=404, detail="Cart not found")
        cart.applied_coupon_code = None
        cart.updated_at = datetime.utcnow()
        db.add(cart)
        return await CartService._load_cart(db, cart_id)

    @staticmethod
    async def clear_items(db: AsyncSession, cart_id: str) -> Cart:
        cart = await CartService._load_cart(db, cart_id)
        if not cart:
            raise HTTPException(status_code=404, detail="Cart not found")
        for item in list(cart.items):
            await db.delete(item)
        cart.updated_at = datetime.utcnow()
        db.add(cart)
        return await CartService._load_cart(db, cart_id)

    @staticmethod
    async def compute_discount(db: AsyncSession, cart: Cart) -> int:
        """Compute applied coupon discount in paise. Always authoritative."""
        if not cart.applied_coupon_code:
            return 0
        from app.policy.policy_engine import PolicyEngine
        subtotal_paise = sum(i.unit_price_paise * i.quantity for i in (cart.items or []))
        categories = {item.product.category for item in (cart.items or []) if item.product}
        discount_paise, _ = await PolicyEngine.validate_discount(
            db, cart.applied_coupon_code, subtotal_paise, categories
        )
        return discount_paise
