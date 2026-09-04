"""
AgentCART – Merchant Service (Dashboard)
"""
from __future__ import annotations
import uuid
import json
import secrets
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional, List
from app.models.models import (
    Store, Order, Product, OrderStatus, OrderItem,
    MerchantPolicy, AuditLog, StoreAgentConfig
)


# ─── Store ────────────────────────────────────────────────────────────────────

async def register_store(
    db: AsyncSession,
    name: str,
    slug: str,
    domain: str,
    owner_user_id: str,
    description: Optional[str] = None,
    category: Optional[str] = None,
) -> Store:
    new_store = Store(
        id=str(uuid.uuid4()),
        name=name,
        slug=slug,
        domain=domain,
        owner_user_id=owner_user_id,
        public_api_key=secrets.token_hex(32),
        secret_api_key=secrets.token_hex(32),
        description=description,
    )
    # Store category in description prefix if model doesn't have a category column
    if category and not description:
        new_store.description = f"[{category}]"
    elif category and description:
        new_store.description = f"[{category}] {description}"
    db.add(new_store)
    await db.flush()
    return new_store


async def get_store_by_slug(db: AsyncSession, slug: str) -> Optional[Store]:
    result = await db.execute(select(Store).where(Store.slug == slug))
    return result.scalar_one_or_none()


async def get_store_for_owner(db: AsyncSession, store_id: str, owner_user_id: str) -> Optional[Store]:
    """Get store only if the user owns it (ownership guard)."""
    result = await db.execute(
        select(Store).where(Store.id == store_id, Store.owner_user_id == owner_user_id)
    )
    return result.scalar_one_or_none()


async def get_my_store(db: AsyncSession, owner_user_id: str) -> Optional[Store]:
    """Get the first store owned by this user."""
    result = await db.execute(
        select(Store).where(Store.owner_user_id == owner_user_id, Store.is_active.is_(True))
    )
    return result.scalar_one_or_none()


async def update_store(db: AsyncSession, store: Store, name=None, description=None, logo_url=None) -> Store:
    if name is not None:
        store.name = name
    if description is not None:
        store.description = description
    if logo_url is not None:
        store.logo_url = logo_url
    db.add(store)
    await db.flush()
    return store


# ─── Agent Config ─────────────────────────────────────────────────────────────

async def get_agent_config(db: AsyncSession, store_id: str) -> Optional[StoreAgentConfig]:
    result = await db.execute(
        select(StoreAgentConfig).where(StoreAgentConfig.store_id == store_id)
    )
    return result.scalar_one_or_none()


async def upsert_agent_config(db: AsyncSession, store_id: str, **fields) -> StoreAgentConfig:
    config = await get_agent_config(db, store_id)
    if not config:
        config = StoreAgentConfig(id=str(uuid.uuid4()), store_id=store_id)
        db.add(config)
    no_discount_cats = fields.pop("no_discount_categories", None)
    if no_discount_cats is not None:
        config.no_discount_categories = json.dumps(no_discount_cats)
    for key, value in fields.items():
        if value is not None and hasattr(config, key):
            setattr(config, key, value)
    config.updated_at = datetime.utcnow()
    await db.flush()
    return config


# ─── Policies ─────────────────────────────────────────────────────────────────

async def list_policies(db: AsyncSession, store_id: str) -> List[MerchantPolicy]:
    result = await db.execute(
        select(MerchantPolicy).where(MerchantPolicy.store_id == store_id)
        .order_by(MerchantPolicy.valid_from.desc())
    )
    return list(result.scalars().all())


async def create_policy(db: AsyncSession, store_id: str, **fields) -> MerchantPolicy:
    policy = MerchantPolicy(id=str(uuid.uuid4()), store_id=store_id, **fields)
    db.add(policy)
    await db.flush()
    return policy


async def update_policy(db: AsyncSession, policy_id: str, store_id: str, **fields) -> MerchantPolicy:
    result = await db.execute(
        select(MerchantPolicy).where(MerchantPolicy.id == policy_id, MerchantPolicy.store_id == store_id)
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise ValueError("Policy not found")
    for key, value in fields.items():
        if value is not None and hasattr(policy, key):
            setattr(policy, key, value)
    await db.flush()
    return policy


async def delete_policy(db: AsyncSession, policy_id: str, store_id: str) -> None:
    result = await db.execute(
        select(MerchantPolicy).where(MerchantPolicy.id == policy_id, MerchantPolicy.store_id == store_id)
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise ValueError("Policy not found")
    await db.delete(policy)
    await db.flush()


# ─── Orders ───────────────────────────────────────────────────────────────────

async def get_store_orders(
    db: AsyncSession, store_id: str,
    status_filter: Optional[str] = None,
    limit: int = 50, offset: int = 0
) -> List[Order]:
    query = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.user))
        .where(Order.store_id == store_id)
    )
    if status_filter:
        query = query.where(Order.status == OrderStatus(status_filter))
    query = query.order_by(Order.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_order_status(
    db: AsyncSession, order_id: str, store_id: str,
    status: str, tracking_link: Optional[str] = None,
    tracking_carrier: Optional[str] = None
) -> Order:
    result = await db.execute(select(Order).where(Order.id == order_id, Order.store_id == store_id))
    order = result.scalar_one_or_none()
    if not order:
        raise Exception("Order not found or access denied")
    order.status = OrderStatus(status)
    if tracking_link:
        order.tracking_link = tracking_link
    if tracking_carrier:
        order.tracking_carrier = tracking_carrier
    if status == OrderStatus.SHIPPED.value:
        order.shipped_at = datetime.utcnow()
    elif status == OrderStatus.DELIVERED.value:
        order.delivered_at = datetime.utcnow()
    await db.flush()
    return order


# ─── Analytics ────────────────────────────────────────────────────────────────

async def get_store_analytics(db: AsyncSession, store_id: str) -> dict:
    valid_statuses = [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED]

    result = await db.execute(
        select(
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.total_paise), 0).label("total_revenue")
        ).where(Order.store_id == store_id, Order.status.in_(valid_statuses))
    )
    row = result.first()
    order_count = row.order_count or 0
    total_revenue_paise = row.total_revenue or 0
    total_revenue = total_revenue_paise / 100
    avg_order_value = total_revenue / order_count if order_count > 0 else 0

    refund_result = await db.execute(
        select(func.count(Order.id)).where(Order.store_id == store_id, Order.status == OrderStatus.REFUNDED)
    )
    refund_count = refund_result.scalar() or 0

    failed_result = await db.execute(
        select(func.count(Order.id)).where(Order.store_id == store_id, Order.status == OrderStatus.FAILED)
    )
    failed_count = failed_result.scalar() or 0

    top_products_result = await db.execute(
        select(
            OrderItem.product_id, OrderItem.product_name,
            func.sum(OrderItem.subtotal_paise).label("revenue"),
            func.sum(OrderItem.quantity).label("units_sold")
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.store_id == store_id, Order.status.in_(valid_statuses))
        .group_by(OrderItem.product_id, OrderItem.product_name)
        .order_by(func.sum(OrderItem.subtotal_paise).desc())
        .limit(5)
    )
    top_products = [
        {"product_id": r.product_id, "product_name": r.product_name,
         "revenue_paise": int(r.revenue or 0), "units_sold": int(r.units_sold or 0)}
        for r in top_products_result.all()
    ]

    seven_days_ago = datetime.utcnow() - timedelta(days=6)
    daily_result = await db.execute(
        select(
            func.strftime("%Y-%m-%d", Order.created_at).label("date"),
            func.coalesce(func.sum(Order.total_paise), 0).label("revenue"),
            func.count(Order.id).label("order_count")
        )
        .where(Order.store_id == store_id, Order.status.in_(valid_statuses), Order.created_at >= seven_days_ago)
        .group_by(func.strftime("%Y-%m-%d", Order.created_at))
        .order_by(func.strftime("%Y-%m-%d", Order.created_at))
    )
    daily_map = {
        row.date: {"revenue_paise": int(row.revenue), "order_count": int(row.order_count)}
        for row in daily_result.all()
    }
    revenue_by_day = []
    for i in range(6, -1, -1):
        d = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        entry = daily_map.get(d, {"revenue_paise": 0, "order_count": 0})
        revenue_by_day.append({"date": d, **entry})

    return {
        "total_revenue": total_revenue, "order_count": order_count,
        "avg_order_value": avg_order_value, "refund_count": refund_count,
        "failed_payment_count": failed_count,
        "top_products": top_products, "revenue_by_day": revenue_by_day,
    }


async def get_low_stock_products(db: AsyncSession, store_id: str, threshold: int = 10) -> list:
    result = await db.execute(
        select(Product).where(
            Product.store_id == store_id,
            Product.stock_quantity < threshold,
            Product.is_active.is_(True)
        )
    )
    return list(result.scalars().all())


# ─── Audit Logs ───────────────────────────────────────────────────────────────

async def get_audit_logs(
    db: AsyncSession, store_id: str,
    event_type_filter: Optional[str] = None,
    limit: int = 50, offset: int = 0
) -> List[AuditLog]:
    query = select(AuditLog).where(AuditLog.store_id == store_id)
    if event_type_filter:
        from app.models.models import AuditEventType
        query = query.where(AuditLog.event_type == AuditEventType(event_type_filter))
    query = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())
