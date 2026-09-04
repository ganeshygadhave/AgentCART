"""
AgentCART – Users API Router
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.database import get_db
from app.services import user_service
from app.api.v1.auth import get_current_user_dep

router = APIRouter()

class AddressCreateRequest(BaseModel):
    label: str
    full_name: str
    phone: str
    street_address: str
    landmark: Optional[str] = None
    city: str
    state: str
    pincode: str
    is_default: bool = False

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

@router.patch("/users/me")
async def update_profile(
    body: UpdateProfileRequest,
    user = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Update basic profile details for the authenticated user."""
    if body.name is not None:
        user.name = body.name.strip()
    if body.email is not None:
        user.email = body.email.strip()
    if body.phone is not None:
        user.phone = body.phone.strip() or None
    await db.commit()
    await db.refresh(user)
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "message": "Profile updated successfully",
    }

@router.get("/users/addresses")
async def get_addresses(user = Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)):
    addresses = await user_service.get_user_addresses(db, user.id)
    return {"addresses": [{"id": a.id, "label": a.label, "full_name": a.full_name, "phone": a.phone, "street_address": a.street_address, "landmark": a.landmark, "city": a.city, "state": a.state, "pincode": a.pincode, "is_default": a.is_default} for a in addresses]}

@router.post("/users/addresses")
async def create_address(body: AddressCreateRequest, user = Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)):
    address = await user_service.add_user_address(db, user.id, body.label, body.full_name, body.phone, body.street_address, body.city, body.state, body.pincode, body.is_default, body.landmark)
    return {"id": address.id, "message": "Address added"}

@router.get("/users/orders")
async def get_orders(store_id: Optional[str] = None, user = Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)):
    orders = await user_service.get_user_orders(db, user.id, store_id)
    store_ids = list({o.store_id for o in orders if o.store_id})
    store_map = {}
    if store_ids:
        from app.models.models import Store
        from sqlalchemy import select
        result = await db.execute(select(Store).where(Store.id.in_(store_ids)))
        for store in result.scalars().all():
            store_map[store.id] = store.name

    return {"orders": [{
        "id": o.id,
        "order_number": o.order_number,
        "status": str(o.status.value),
        "created_at": str(o.created_at),
        "total": o.total_paise / 100,
        "subtotal": o.subtotal_paise / 100,
        "discount": o.discount_paise / 100,
        "applied_coupon": o.applied_coupon_code,
        "store_id": o.store_id,
        "store_name": store_map.get(o.store_id) if o.store_id else None,
        "shipping_address": o.shipping_address,
        "items": [{
            "product_name": item.product_name,
            "quantity": item.quantity,
            "unit_price": item.unit_price_paise / 100,
            "subtotal": item.subtotal_paise / 100,
        } for item in o.items],
    } for o in orders]}
