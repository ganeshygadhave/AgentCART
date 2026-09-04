"""
AgentCART – Product Pydantic Schemas
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import json


class ProductBase(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    category: str
    brand: Optional[str] = None
    price_paise: int
    original_price_paise: Optional[int] = None
    stock_quantity: int
    image_url: Optional[str] = None
    tags: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = 0


class ProductCreate(ProductBase):
    pass


class ProductResponse(BaseModel):
    id: str
    sku: str
    name: str
    description: Optional[str] = None
    category: str
    brand: Optional[str] = None
    # Expose prices in both paise and rupees
    price_paise: int
    price: float
    original_price_paise: Optional[int] = None
    original_price: Optional[float] = None
    stock_quantity: int
    image_url: Optional[str] = None
    tags: Optional[list[str]] = None
    rating: Optional[float] = None
    review_count: Optional[int] = 0
    is_active: bool
    created_at: datetime
    store_id: Optional[str] = None
    store_name: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, product) -> "ProductResponse":
        """Convert ORM model to response schema."""
        tags_list: list[str] = []
        if product.tags:
            try:
                tags_list = json.loads(product.tags)
            except (json.JSONDecodeError, TypeError):
                tags_list = []

        return cls(
            id=product.id,
            sku=product.sku,
            name=product.name,
            description=product.description,
            category=product.category,
            brand=product.brand,
            price_paise=product.price_paise,
            price=round(product.price_paise / 100, 2),
            original_price_paise=product.original_price_paise,
            original_price=(
                round(product.original_price_paise / 100, 2)
                if product.original_price_paise else None
            ),
            stock_quantity=product.stock_quantity,
            image_url=product.image_url,
            tags=tags_list,
            rating=product.rating,
            review_count=product.review_count,
            is_active=product.is_active,
            created_at=product.created_at,
            store_id=product.store_id,
            store_name=_safe_store_name(product),
        )


def _safe_store_name(product) -> str | None:
    """Return store name only if already loaded (avoids lazy-load in async context)."""
    try:
        store = product.__dict__.get('store')
        if store is not None:
            return store.name
        return None
    except Exception:
        return None


class ProductListParams(BaseModel):
    q: Optional[str] = Field(None, description="Search query")
    category: Optional[str] = Field(None, description="Filter by category")
    brand: Optional[str] = Field(None, description="Filter by brand")
    min_price: Optional[float] = Field(None, description="Min price in rupees")
    max_price: Optional[float] = Field(None, description="Max price in rupees")
    in_stock: Optional[bool] = Field(None, description="Only in-stock items")
    sort: Optional[str] = Field(
        "featured",
        description="Sort order: featured | price_asc | price_desc | rating | newest",
    )
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)
