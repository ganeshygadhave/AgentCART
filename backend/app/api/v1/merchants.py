"""
AgentCART – Merchants / Dashboard API Router
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import json

from app.db.database import get_db
from app.services import merchant_service
from app.services import product_admin_service
from app.api.v1.auth import get_current_user_dep
from app.schemas.merchant import (
    StoreUpdate, StoreAgentConfigUpdate, MerchantPolicyCreate,
    MerchantPolicyUpdate, ProductAdminCreate, ProductAdminUpdate,
    BulkStockUpdateRequest, OrderFulfillmentUpdate
)
from app.schemas.product import ProductResponse

router = APIRouter()


def _ownership_error():
    raise HTTPException(status_code=403, detail="Access denied: you do not own this store")


class RegisterStoreRequest(StoreUpdate):
    name: str
    slug: str
    domain: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None


# ─── Store ────────────────────────────────────────────────────────────────────

@router.post("/merchants/register")
async def register_store_route(
    body: RegisterStoreRequest,
    user=Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    existing = await merchant_service.get_store_by_slug(db, body.slug)
    if existing:
        raise HTTPException(status_code=400, detail="Store slug already exists")
    store = await merchant_service.register_store(
        db, body.name, body.slug, body.domain or "", user.id,
        description=body.description, category=body.category
    )
    return {"id": store.id, "name": store.name, "slug": store.slug, "public_api_key": store.public_api_key}


@router.get("/merchants/my-store")
async def get_my_store(
    user=Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_my_store(db, user.id)
    if not store:
        raise HTTPException(status_code=404, detail="No store found")
    return {
        "id": store.id, "name": store.name, "slug": store.slug,
        "domain": store.domain, "description": store.description,
        "logo_url": store.logo_url, "public_api_key": store.public_api_key,
        "is_active": store.is_active, "created_at": store.created_at
    }


@router.patch("/merchants/my-store")
async def update_my_store(
    body: StoreUpdate,
    user=Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_my_store(db, user.id)
    if not store:
        raise HTTPException(status_code=404, detail="No store found")
    store = await merchant_service.update_store(
        db, store, name=body.name, description=body.description, logo_url=body.logo_url
    )
    return {"id": store.id, "name": store.name, "description": store.description, "logo_url": store.logo_url}


# ─── Agent Config ─────────────────────────────────────────────────────────────

@router.get("/merchants/{store_id}/agent-config")
async def get_agent_config(
    store_id: str,
    user=Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    config = await merchant_service.get_agent_config(db, store_id)
    if not config:
        return {
            "id": None, "store_id": store_id, "persona_name": "AgentCART Assistant",
            "store_context": None, "greeting_message": None,
            "max_discount_pct": 0.0, "min_cart_for_discount_paise": 0,
            "no_discount_categories": [], "updated_at": None
        }
    cats = []
    if config.no_discount_categories:
        try:
            cats = json.loads(config.no_discount_categories)
        except Exception:
            cats = []
    return {
        "id": config.id, "store_id": config.store_id,
        "persona_name": config.persona_name, "store_context": config.store_context,
        "greeting_message": config.greeting_message,
        "max_discount_pct": config.max_discount_pct,
        "min_cart_for_discount_paise": config.min_cart_for_discount_paise,
        "no_discount_categories": cats, "updated_at": config.updated_at
    }


@router.put("/merchants/{store_id}/agent-config")
async def update_agent_config(
    store_id: str,
    body: StoreAgentConfigUpdate,
    user=Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    fields = body.model_dump(exclude_none=True)
    config = await merchant_service.upsert_agent_config(db, store_id, **fields)
    cats = []
    if config.no_discount_categories:
        try:
            cats = json.loads(config.no_discount_categories)
        except Exception:
            cats = []
    return {
        "id": config.id, "store_id": config.store_id,
        "persona_name": config.persona_name, "store_context": config.store_context,
        "greeting_message": config.greeting_message,
        "max_discount_pct": config.max_discount_pct,
        "min_cart_for_discount_paise": config.min_cart_for_discount_paise,
        "no_discount_categories": cats, "updated_at": config.updated_at
    }


# ─── Agent Analytics ──────────────────────────────────────────────────────────

@router.get("/merchants/{store_id}/agent-analytics")
async def get_agent_analytics(
    store_id: str,
    user=Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    from app.agent.tools import tool_get_agent_analytics
    return await tool_get_agent_analytics(db, store_id)


# ─── Policies / Coupons ───────────────────────────────────────────────────────

@router.get("/merchants/{store_id}/policies")
async def list_policies(
    store_id: str,
    user=Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    policies = await merchant_service.list_policies(db, store_id)
    return {"policies": [
        {
            "id": p.id, "code": p.code, "description": p.description,
            "discount_type": p.discount_type, "discount_value": p.discount_value,
            "max_discount_paise": p.max_discount_paise, "min_order_paise": p.min_order_paise,
            "max_uses": p.max_uses, "current_uses": p.current_uses,
            "is_active": p.is_active, "valid_from": p.valid_from, "valid_until": p.valid_until
        } for p in policies
    ]}


@router.post("/merchants/{store_id}/policies")
async def create_policy(
    store_id: str, body: MerchantPolicyCreate,
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    fields = body.model_dump(exclude_none=True)
    fields["code"] = fields["code"].upper()
    policy = await merchant_service.create_policy(db, store_id, **fields)
    return {"id": policy.id, "code": policy.code, "discount_type": policy.discount_type}


@router.patch("/merchants/{store_id}/policies/{policy_id}")
async def update_policy(
    store_id: str, policy_id: str, body: MerchantPolicyUpdate,
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    try:
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        policy = await merchant_service.update_policy(db, policy_id, store_id, **fields)
        return {"id": policy.id, "code": policy.code, "is_active": policy.is_active}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/merchants/{store_id}/policies/{policy_id}")
async def delete_policy(
    store_id: str, policy_id: str,
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    try:
        await merchant_service.delete_policy(db, policy_id, store_id)
        return {"deleted": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─── Products (Admin CRUD) ────────────────────────────────────────────────────

@router.get("/merchants/{store_id}/products")
async def list_admin_products(
    store_id: str,
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    products = await product_admin_service.list_store_products(db, store_id, include_inactive=True)
    return {"products": [ProductResponse.from_orm_model(p) for p in products]}


@router.post("/merchants/{store_id}/products")
async def create_product(
    store_id: str, body: ProductAdminCreate,
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    product = await product_admin_service.create_product(db, store_id, **body.model_dump())
    return ProductResponse.from_orm_model(product)


@router.patch("/merchants/{store_id}/products/{product_id}")
async def update_product(
    store_id: str, product_id: str, body: ProductAdminUpdate,
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    try:
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        product = await product_admin_service.update_product(db, product_id, store_id, **fields)
        return ProductResponse.from_orm_model(product)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/merchants/{store_id}/products/{product_id}")
async def delete_product(
    store_id: str, product_id: str,
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    try:
        await product_admin_service.delete_product(db, product_id, store_id)
        return {"deleted": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/merchants/{store_id}/products/{product_id}/toggle-active")
async def toggle_product(
    store_id: str, product_id: str,
    is_active: bool = Query(...),
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    try:
        product = await product_admin_service.toggle_product_active(db, product_id, store_id, is_active)
        return {"id": product.id, "is_active": product.is_active}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/merchants/{store_id}/products/bulk-stock")
async def bulk_stock_update(
    store_id: str, body: BulkStockUpdateRequest,
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    updates = [item.model_dump() for item in body.updates]
    products = await product_admin_service.bulk_stock_update(db, store_id, updates)
    return {"updated_count": len(products)}


# ─── Orders ───────────────────────────────────────────────────────────────────

@router.get("/merchants/{store_id}/orders")
async def get_store_orders(
    store_id: str,
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    orders = await merchant_service.get_store_orders(db, store_id, status, limit, offset)
    result = []
    for o in orders:
        items = [
            {"id": i.id, "product_id": i.product_id, "product_name": i.product_name,
             "quantity": i.quantity, "unit_price_paise": i.unit_price_paise, "subtotal_paise": i.subtotal_paise}
            for i in o.items
        ]
        result.append({
            "id": o.id, "order_number": o.order_number,
            "status": o.status.value if hasattr(o.status, 'value') else str(o.status),
            "subtotal_paise": o.subtotal_paise, "discount_paise": o.discount_paise,
            "total_paise": o.total_paise, "applied_coupon_code": o.applied_coupon_code,
            "tracking_link": o.tracking_link, "tracking_carrier": o.tracking_carrier,
            "shipped_at": o.shipped_at, "delivered_at": o.delivered_at,
            "created_at": o.created_at, "updated_at": o.updated_at,
            "items": items,
            "user_name": o.user.name if o.user else None,
            "user_email": o.user.email if o.user else None,
        })
    return {"orders": result, "total": len(result)}


@router.patch("/merchants/orders/{order_id}/status")
async def update_order_status(
    order_id: str, body: OrderFulfillmentUpdate,
    store_id: str = Query(...),
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    try:
        order = await merchant_service.update_order_status(
            db, order_id, store_id, body.status, body.tracking_link, body.tracking_carrier
        )
        return {"id": order.id, "status": order.status.value, "tracking_link": order.tracking_link}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/merchants/{store_id}/analytics")
async def get_analytics(
    store_id: str,
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    return await merchant_service.get_store_analytics(db, store_id)


@router.get("/merchants/{store_id}/low-stock")
async def get_low_stock(
    store_id: str,
    threshold: int = Query(10, ge=1),
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    products = await merchant_service.get_low_stock_products(db, store_id, threshold)
    return {"products": [
        {"id": p.id, "name": p.name, "sku": p.sku, "stock_quantity": p.stock_quantity, "is_active": p.is_active}
        for p in products
    ]}


# ─── Audit Logs ───────────────────────────────────────────────────────────────

@router.get("/merchants/{store_id}/audit-logs")
async def get_audit_logs(
    store_id: str,
    event_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)
):
    store = await merchant_service.get_store_for_owner(db, store_id, user.id)
    if not store:
        _ownership_error()
    logs = await merchant_service.get_audit_logs(db, store_id, event_type, limit, offset)
    return {"logs": [
        {
            "id": log.id,
            "event_type": log.event_type.value if hasattr(log.event_type, 'value') else str(log.event_type),
            "actor": log.actor, "entity_type": log.entity_type,
            "entity_id": log.entity_id, "payload": log.payload,
            "outcome": log.outcome, "notes": log.notes,
            "created_at": log.created_at, "store_id": log.store_id
        } for log in logs
    ]}
