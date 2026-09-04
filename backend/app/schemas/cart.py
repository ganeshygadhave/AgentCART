"""
AgentCART – Cart & Checkout Pydantic Schemas
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.schemas.product import ProductResponse


# ─── Cart ─────────────────────────────────────────────────────────────────────

class CartItemResponse(BaseModel):
    id: str
    product_id: str
    product: Optional[ProductResponse] = None
    quantity: int
    unit_price_paise: int
    unit_price: float
    subtotal_paise: int
    subtotal: float
    added_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, item) -> "CartItemResponse":
        return cls(
            id=item.id,
            product_id=item.product_id,
            product=(
                ProductResponse.from_orm_model(item.product)
                if item.product else None
            ),
            quantity=item.quantity,
            unit_price_paise=item.unit_price_paise,
            unit_price=round(item.unit_price_paise / 100, 2),
            subtotal_paise=item.unit_price_paise * item.quantity,
            subtotal=round((item.unit_price_paise * item.quantity) / 100, 2),
            added_at=item.added_at,
        )


class CartResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    items: list[CartItemResponse] = []
    item_count: int = 0
    subtotal_paise: int = 0
    subtotal: float = 0.0
    discount_paise: int = 0
    discount_amount: float = 0.0
    total_paise: int = 0
    total: float = 0.0
    applied_coupon_code: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, cart, discount_paise: int = 0) -> "CartResponse":
        items = [CartItemResponse.from_orm_model(i) for i in (cart.items or [])]
        subtotal_paise = sum(i.subtotal_paise for i in items)
        total_paise = max(0, subtotal_paise - discount_paise)
        item_count = sum(i.quantity for i in items)
        return cls(
            id=cart.id,
            user_id=cart.user_id,
            session_id=cart.session_id,
            items=items,
            item_count=item_count,
            subtotal_paise=subtotal_paise,
            subtotal=round(subtotal_paise / 100, 2),
            discount_paise=discount_paise,
            discount_amount=round(discount_paise / 100, 2),
            total_paise=total_paise,
            total=round(total_paise / 100, 2),
            applied_coupon_code=cart.applied_coupon_code,
            is_active=cart.is_active,
            created_at=cart.created_at,
            updated_at=cart.updated_at,
        )


class AddItemRequest(BaseModel):
    product_id: str
    quantity: int = Field(1, ge=1, le=99)


class UpdateItemRequest(BaseModel):
    quantity: int = Field(..., ge=1, le=99)


class ApplyCouponRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)


# ─── Order / Checkout ─────────────────────────────────────────────────────────

class CheckoutValidateRequest(BaseModel):
    cart_id: str
    coupon_code: Optional[str] = None


class CheckoutValidateResponse(BaseModel):
    valid: bool
    subtotal_paise: int
    subtotal: float
    discount_paise: int
    discount_amount: float
    total_paise: int
    total: float
    applied_coupon_code: Optional[str] = None
    issues: list[str] = []


class CreateOrderRequest(BaseModel):
    cart_id: str
    coupon_code: Optional[str] = None
    shipping_address: Optional[dict] = None


class OrderItemResponse(BaseModel):
    id: str
    product_id: str
    product_name: str
    quantity: int
    unit_price_paise: int
    unit_price: float
    subtotal_paise: int
    subtotal: float

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: str
    order_number: str
    status: str
    subtotal_paise: int
    subtotal: float
    discount_paise: int
    discount_amount: float
    total_paise: int
    total: float
    applied_coupon_code: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    items: list[OrderItemResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Payment ──────────────────────────────────────────────────────────────────

class PaymentInitResponse(BaseModel):
    order_id: str
    razorpay_order_id: str
    amount_paise: int
    amount: float
    currency: str = "INR"
    key_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    order_id: str
