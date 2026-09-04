"""
AgentCART – Checkout & Order API Router (Phase 5)

Implements the Policy Engine gate before order creation.
Users must explicitly confirm before an order is placed.
"""
from __future__ import annotations

import uuid
import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Header
import razorpay
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import Order, OrderItem, Cart, CartItem, Payment, OrderStatus, PaymentStatus
from app.core.config import get_settings
from app.schemas.cart import (
    CheckoutValidateRequest, CheckoutValidateResponse,
    CreateOrderRequest, OrderResponse, OrderItemResponse,
    PaymentInitResponse, VerifyPaymentRequest,
)
from app.services.cart_service import CartService
from app.policy.policy_engine import PolicyEngine

router = APIRouter()
settings = get_settings()


def _order_number() -> str:
    import random, string
    return "AC-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


@router.post("/checkout/validate", response_model=CheckoutValidateResponse)
async def validate_checkout(
    body: CheckoutValidateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 5: Policy Engine Gate.
    Validates cart against all merchant policies before order creation.
    Returns authoritative totals and any issues.
    """
    cart = await CartService.get_cart(db, body.cart_id)

    if not cart.items:
        raise HTTPException(status_code=422, detail="Cart is empty.")

    # 1. Validate inventory
    inventory_issues = await PolicyEngine.validate_inventory(db, cart)

    # 2. Calculate authoritative totals
    totals = await PolicyEngine.calculate_authoritative_total(
        db, cart, body.coupon_code
    )

    issues = inventory_issues

    return CheckoutValidateResponse(
        valid=len(issues) == 0,
        subtotal_paise=totals["subtotal_paise"],
        subtotal=totals["subtotal_paise"] / 100,
        discount_paise=totals["discount_paise"],
        discount_amount=totals["discount_paise"] / 100,
        total_paise=totals["total_paise"],
        total=totals["total_paise"] / 100,
        applied_coupon_code=totals["applied_coupon"],
        issues=issues,
    )


@router.post("/checkout/order", response_model=OrderResponse, status_code=201)
async def create_order(
    body: CreateOrderRequest,
    confirmed: bool = False,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Create an order from a validated cart.
    The `confirmed=true` query param is the explicit confirmation gate.
    Optionally attaches the logged-in user's ID to the order.
    """
    # Resolve user_id from auth token if present
    user_id = None
    if authorization and authorization.startswith("Bearer "):
        try:
            from app.services.auth_service import get_current_user
            user = await get_current_user(db, authorization.split(" ")[1])
            if user:
                user_id = user.id
        except Exception:
            pass

    # Confirmation gate (Phase 5 guardrail)
    confirmation_error = PolicyEngine.validate_confirmation(confirmed)
    if confirmation_error:
        raise HTTPException(status_code=422, detail=confirmation_error)

    cart = await CartService.get_cart(db, body.cart_id)

    if not cart.items:
        raise HTTPException(status_code=422, detail="Cart is empty.")

    # Final inventory validation
    issues = await PolicyEngine.validate_inventory(db, cart)
    if issues:
        raise HTTPException(status_code=422, detail={"issues": issues})

    # Authoritative totals — never trust frontend values
    totals = await PolicyEngine.calculate_authoritative_total(
        db, cart, body.coupon_code or cart.applied_coupon_code
    )

    # Create order
    order = Order(
        id=str(uuid.uuid4()),
        order_number=_order_number(),
        cart_id=cart.id,
        user_id=user_id or cart.user_id,
        status=OrderStatus.PENDING,
        subtotal_paise=totals["subtotal_paise"],
        discount_paise=totals["discount_paise"],
        total_paise=totals["total_paise"],
        applied_coupon_code=totals["applied_coupon"],
        shipping_address=body.shipping_address,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(order)
    await db.flush()

    # Create order items (snapshot of cart)
    order_items = []
    for ci in cart.items:
        oi = OrderItem(
            id=str(uuid.uuid4()),
            order_id=order.id,
            product_id=ci.product_id,
            product_name=ci.product.name if ci.product else "Unknown",
            quantity=ci.quantity,
            unit_price_paise=ci.unit_price_paise,
            subtotal_paise=ci.unit_price_paise * ci.quantity,
        )
        db.add(oi)
        order_items.append(oi)

    await db.flush()

    # Build response
    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        subtotal_paise=order.subtotal_paise,
        subtotal=order.subtotal_paise / 100,
        discount_paise=order.discount_paise,
        discount_amount=order.discount_paise / 100,
        total_paise=order.total_paise,
        total=order.total_paise / 100,
        applied_coupon_code=order.applied_coupon_code,
        razorpay_order_id=None,
        items=[
            OrderItemResponse(
                id=oi.id,
                product_id=oi.product_id,
                product_name=oi.product_name,
                quantity=oi.quantity,
                unit_price_paise=oi.unit_price_paise,
                unit_price=oi.unit_price_paise / 100,
                subtotal_paise=oi.subtotal_paise,
                subtotal=oi.subtotal_paise / 100,
            )
            for oi in order_items
        ],
        created_at=order.created_at,
    )


@router.post("/checkout/payment/{order_id}", response_model=PaymentInitResponse)
async def init_payment(order_id: str, db: AsyncSession = Depends(get_db)):
    """Create a Razorpay test-mode order for an existing local order."""
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Razorpay credentials are not configured.")

    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == OrderStatus.PAID:
        raise HTTPException(status_code=409, detail="Order is already paid")
    if order.total_paise < 100:
        raise HTTPException(status_code=400, detail="Razorpay minimum amount is 100 paise.")

    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    try:
        razorpay_order = await asyncio.to_thread(
            client.order.create,
            {"amount": order.total_paise, "currency": "INR", "receipt": order.order_number},
        )
    except Exception as exc:
        error_text = str(exc)
        if "401" in error_text or "authentication" in error_text.lower():
            raise HTTPException(status_code=401, detail="Razorpay authentication failed.") from exc
        raise HTTPException(status_code=500, detail="Could not create Razorpay order.") from exc

    order.razorpay_order_id = razorpay_order["id"]
    order.status = OrderStatus.PAYMENT_INITIATED
    db.add(Payment(
        order_id=order.id,
        razorpay_order_id=razorpay_order["id"],
        amount_paise=order.total_paise,
        status=PaymentStatus.CREATED,
    ))
    await db.flush()
    return PaymentInitResponse(
        order_id=order.id,
        razorpay_order_id=razorpay_order["id"],
        amount_paise=order.total_paise,
        amount=order.total_paise / 100,
        key_id=settings.razorpay_key_id,
    )


@router.post("/checkout/verify", response_model=OrderResponse)
async def verify_payment(body: VerifyPaymentRequest, db: AsyncSession = Depends(get_db)):
    """Verify Razorpay's signature before marking the order paid."""
    if not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Razorpay credentials are not configured.")

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == body.order_id)
    )
    order = result.scalar_one_or_none()
    if not order or order.razorpay_order_id != body.razorpay_order_id:
        raise HTTPException(status_code=404, detail="Payment order not found")

    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    try:
        await asyncio.to_thread(client.utility.verify_payment_signature, {
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_signature": body.razorpay_signature,
        })
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Payment signature verification failed") from exc

    payment_result = await db.execute(
        select(Payment).where(Payment.order_id == order.id, Payment.razorpay_order_id == body.razorpay_order_id)
    )
    payment = payment_result.scalar_one_or_none()
    if payment and payment.status == PaymentStatus.CAPTURED:
        return _order_response(order)
    if payment:
        payment.razorpay_payment_id = body.razorpay_payment_id
        payment.razorpay_signature = body.razorpay_signature
        payment.status = PaymentStatus.CAPTURED
    order.status = OrderStatus.PAID
    order.updated_at = datetime.utcnow()
    if order.applied_coupon_code:
        await PolicyEngine.increment_coupon_usage(db, order.applied_coupon_code)
    if order.cart_id:
        cart_result = await db.execute(select(Cart).where(Cart.id == order.cart_id))
        cart = cart_result.scalar_one_or_none()
        if cart:
            cart.is_active = False
    await db.flush()

    return _order_response(order)


def _order_response(order: Order) -> OrderResponse:
    """Build an order response without triggering async lazy loads."""
    return OrderResponse(
        id=order.id, order_number=order.order_number, status=order.status,
        subtotal_paise=order.subtotal_paise, subtotal=order.subtotal_paise / 100,
        discount_paise=order.discount_paise, discount_amount=order.discount_paise / 100,
        total_paise=order.total_paise, total=order.total_paise / 100,
        applied_coupon_code=order.applied_coupon_code, razorpay_order_id=order.razorpay_order_id,
        items=[OrderItemResponse(
            id=item.id, product_id=item.product_id, product_name=item.product_name,
            quantity=item.quantity, unit_price_paise=item.unit_price_paise,
            unit_price=item.unit_price_paise / 100, subtotal_paise=item.subtotal_paise,
            subtotal=item.subtotal_paise / 100,
        ) for item in order.items],
        created_at=order.created_at,
    )


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    """Get order by ID."""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        subtotal_paise=order.subtotal_paise,
        subtotal=order.subtotal_paise / 100,
        discount_paise=order.discount_paise,
        discount_amount=order.discount_paise / 100,
        total_paise=order.total_paise,
        total=order.total_paise / 100,
        applied_coupon_code=order.applied_coupon_code,
        razorpay_order_id=order.razorpay_order_id,
        items=[
            OrderItemResponse(
                id=oi.id,
                product_id=oi.product_id,
                product_name=oi.product_name,
                quantity=oi.quantity,
                unit_price_paise=oi.unit_price_paise,
                unit_price=oi.unit_price_paise / 100,
                subtotal_paise=oi.subtotal_paise,
                subtotal=oi.subtotal_paise / 100,
            )
            for oi in order.items
        ],
        created_at=order.created_at,
    )
