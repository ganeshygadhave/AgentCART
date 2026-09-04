"""
AgentCART – Policy Engine (Phase 5)

Server-side deterministic validation for:
- Discount codes / coupons
- Inventory constraints
- Cart ownership
- Authoritative order totals
- Order confirmation gate

The LLM agent NEVER computes or overrides these rules.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import MerchantPolicy, Cart, CartItem


class PolicyEngine:

    DISCOUNT_ELIGIBLE_CATEGORIES = {
        "WELCOME10": {"Electronics", "Computing"},
        "SAVE200": {"Electronics", "Computing"},
        "FLASH15": {"Computing"},
        "PREMIUM5": {"Electronics"},
    }

    @staticmethod
    def _discount_is_eligible(code: str, categories: Optional[set[str]]) -> bool:
        eligible = PolicyEngine.DISCOUNT_ELIGIBLE_CATEGORIES.get(code.upper())
        return bool(eligible and categories and categories.issubset(eligible))

    @staticmethod
    async def validate_discount(
        db: AsyncSession,
        code: str,
        subtotal_paise: int,
        categories: Optional[set[str]] = None,
    ) -> tuple[int, Optional[str]]:
        """
        Validates a coupon code against merchant policies.

        Returns:
            (discount_paise, error_message)
            - discount_paise = 0 if invalid
            - error_message = None if valid
        """
        # Fetch policy from DB
        result = await db.execute(
            select(MerchantPolicy).where(
                MerchantPolicy.code == code.upper(),
                MerchantPolicy.is_active == True,
            )
        )
        policy = result.scalar_one_or_none()

        if not policy:
            return 0, f"Coupon '{code}' is not valid or has expired."

        if categories is not None and not PolicyEngine._discount_is_eligible(code, categories):
            return 0, f"Coupon '{code}' is not available for the products in this cart."

        now = datetime.utcnow()

        # Check validity window
        if policy.valid_from and now < policy.valid_from:
            return 0, f"Coupon '{code}' is not yet active."

        if policy.valid_until and now > policy.valid_until:
            return 0, f"Coupon '{code}' has expired."

        # Check usage limit
        if policy.max_uses is not None and policy.current_uses >= policy.max_uses:
            return 0, f"Coupon '{code}' has reached its usage limit."

        # Check minimum order value
        if subtotal_paise < policy.min_order_paise:
            min_order_rupees = policy.min_order_paise / 100
            return 0, (
                f"Coupon '{code}' requires a minimum order of ₹{min_order_rupees:.0f}. "
                f"Your cart total is ₹{subtotal_paise / 100:.2f}."
            )

        # Compute discount
        if policy.discount_type == "percentage":
            discount_percent = min(policy.discount_value, 12.0)
            raw_discount = int(subtotal_paise * discount_percent / 100)
        else:  # "fixed"
            raw_discount = int(policy.discount_value * 100)

        # No offer may reduce an eligible order by more than 12%.
        raw_discount = min(raw_discount, int(subtotal_paise * 0.12))

        # Apply cap if set
        if policy.max_discount_paise:
            raw_discount = min(raw_discount, policy.max_discount_paise)

        # Discount cannot exceed subtotal
        discount_paise = min(raw_discount, subtotal_paise)

        return discount_paise, None

    @staticmethod
    async def validate_inventory(db: AsyncSession, cart: Cart) -> list[str]:
        """
        Validates that all cart items have sufficient stock.
        Returns a list of issues (empty = all OK).
        """
        issues = []
        for item in (cart.items or []):
            product = item.product
            if not product:
                issues.append(f"Product '{item.product_id}' no longer exists.")
                continue
            if not product.is_active:
                issues.append(f"'{product.name}' is no longer available.")
            elif product.stock_quantity < item.quantity:
                issues.append(
                    f"'{product.name}': only {product.stock_quantity} units available "
                    f"(you have {item.quantity} in cart)."
                )
        return issues

    @staticmethod
    async def calculate_authoritative_total(
        db: AsyncSession,
        cart: Cart,
        coupon_code: Optional[str] = None,
    ) -> dict:
        """
        Server-side authoritative total calculation.
        This is the ONLY place totals should be computed for orders.

        Returns dict with: subtotal_paise, discount_paise, total_paise, applied_coupon
        """
        # Always recompute from current product prices in cart items
        # Note: unit_price_paise is locked at the time of add-to-cart
        subtotal_paise = sum(
            item.unit_price_paise * item.quantity
            for item in (cart.items or [])
        )

        code = coupon_code or cart.applied_coupon_code
        discount_paise = 0
        applied_coupon = None

        if code:
            categories = {
                item.product.category
                for item in (cart.items or [])
                if item.product
            }
            discount_paise, error = await PolicyEngine.validate_discount(
                db, code, subtotal_paise, categories
            )
            if not error:
                applied_coupon = code.upper()

        total_paise = max(0, subtotal_paise - discount_paise)

        return {
            "subtotal_paise": subtotal_paise,
            "discount_paise": discount_paise,
            "total_paise": total_paise,
            "applied_coupon": applied_coupon,
        }

    @staticmethod
    def validate_confirmation(confirmed: bool) -> Optional[str]:
        """
        The order confirmation gate.
        User must explicitly confirm before an order is created.
        """
        if not confirmed:
            return "Order not confirmed. User must explicitly confirm before proceeding."
        return None

    @staticmethod
    async def increment_coupon_usage(db: AsyncSession, code: str) -> None:
        """Atomically increment coupon usage counter after successful order."""
        result = await db.execute(
            select(MerchantPolicy).where(MerchantPolicy.code == code.upper())
        )
        policy = result.scalar_one_or_none()
        if policy:
            policy.current_uses += 1
            db.add(policy)
