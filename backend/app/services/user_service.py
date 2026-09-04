"""
AgentCART – User Service
"""
from __future__ import annotations
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from typing import Optional
from app.models.models import Address, Order

async def get_user_addresses(db: AsyncSession, user_id: str) -> list[Address]:
    result = await db.execute(
        select(Address).where(Address.user_id == user_id).order_by(Address.is_default.desc(), Address.created_at.desc())
    )
    return list(result.scalars().all())

async def add_user_address(db: AsyncSession, user_id: str, label: str, full_name: str, phone: str, street_address: str, city: str, state: str, pincode: str, is_default: bool = False, landmark: Optional[str] = None) -> Address:
    if is_default:
        await db.execute(
            update(Address).where(Address.user_id == user_id).values(is_default=False)
        )
    
    new_address = Address(
        id=str(uuid.uuid4()),
        user_id=user_id,
        label=label,
        full_name=full_name,
        phone=phone,
        street_address=street_address,
        landmark=landmark,
        city=city,
        state=state,
        pincode=pincode,
        is_default=is_default
    )
    db.add(new_address)
    await db.flush()
    return new_address

async def get_user_orders(db: AsyncSession, user_id: str, store_id: Optional[str] = None) -> list[Order]:
    stmt = select(Order).options(selectinload(Order.items), selectinload(Order.payments)).where(Order.user_id == user_id)
    if store_id:
        stmt = stmt.where(Order.store_id == store_id)
    stmt = stmt.order_by(Order.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())
