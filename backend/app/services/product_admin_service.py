"""
AgentCART – Product Admin Service (Dashboard CRUD)
"""
from __future__ import annotations
import uuid
import json
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Product


async def create_product(db: AsyncSession, store_id: str, **fields) -> Product:
    tags = fields.pop("tags", None)
    product = Product(
        id=str(uuid.uuid4()),
        store_id=store_id,
        tags=json.dumps(tags) if tags is not None else None,
        **fields
    )
    db.add(product)
    await db.flush()
    return product


async def update_product(db: AsyncSession, product_id: str, store_id: str, **fields) -> Product:
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.store_id == store_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise ValueError("Product not found")
    tags = fields.pop("tags", None)
    if tags is not None:
        product.tags = json.dumps(tags)
    for key, value in fields.items():
        if value is not None and hasattr(product, key):
            setattr(product, key, value)
    await db.flush()
    return product


async def delete_product(db: AsyncSession, product_id: str, store_id: str) -> None:
    """Soft-delete: set is_active = False."""
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.store_id == store_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise ValueError("Product not found")
    product.is_active = False
    await db.flush()


async def toggle_product_active(db: AsyncSession, product_id: str, store_id: str, is_active: bool) -> Product:
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.store_id == store_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise ValueError("Product not found")
    product.is_active = is_active
    await db.flush()
    return product


async def bulk_stock_update(db: AsyncSession, store_id: str, updates: List[dict]) -> List[Product]:
    updated = []
    for item in updates:
        result = await db.execute(
            select(Product).where(Product.id == item["product_id"], Product.store_id == store_id)
        )
        product = result.scalar_one_or_none()
        if product:
            product.stock_quantity = item["stock_quantity"]
            updated.append(product)
    await db.flush()
    return updated


async def list_store_products(db: AsyncSession, store_id: str, include_inactive: bool = True) -> List[Product]:
    query = select(Product).where(Product.store_id == store_id)
    if not include_inactive:
        query = query.where(Product.is_active.is_(True))
    query = query.order_by(Product.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())
