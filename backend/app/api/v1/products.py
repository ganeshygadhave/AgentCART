"""
AgentCART – Products API Router (Phase 2)
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.database import get_db
from app.services.product_service import ProductService
from app.schemas.product import ProductResponse
from app.models.models import Store

router = APIRouter()


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    q: Optional[str] = Query(None, description="Full-text search"),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    in_stock: Optional[bool] = Query(None),
    sort: str = Query("featured", pattern="^(featured|price_asc|price_desc|rating|newest)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List products with optional filters and sorting."""
    products = await ProductService.list_products(
        db,
        q=q,
        category=category,
        brand=brand,
        min_price=min_price,
        max_price=max_price,
        in_stock=in_stock,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return [ProductResponse.from_orm_model(p) for p in products]


@router.get("/products/categories", response_model=list[str])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Get all unique product categories."""
    return await ProductService.get_categories(db)


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single product by ID."""
    product = await ProductService.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductResponse.from_orm_model(product)


@router.get("/stores/{slug}")
async def get_store_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """Get store info and its products by store slug."""
    from sqlalchemy import select
    result = await db.execute(
        select(Store).where(Store.slug == slug, Store.is_active.is_(True))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    from sqlalchemy import select as sa_select
    from app.models.models import Product
    prod_result = await db.execute(
        sa_select(Product).where(Product.store_id == store.id, Product.is_active.is_(True)).order_by(Product.created_at.desc())
    )
    products = prod_result.scalars().all()
    
    return {
        "id": store.id,
        "name": store.name,
        "slug": store.slug,
        "domain": store.domain,
        "products": [ProductResponse.from_orm_model(p) for p in products]
    }
