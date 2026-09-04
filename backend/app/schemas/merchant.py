"""
AgentCART – Merchant / Dashboard Pydantic Schemas
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None


class StoreAgentConfigUpdate(BaseModel):
    persona_name: Optional[str] = None
    store_context: Optional[str] = None
    greeting_message: Optional[str] = None
    max_discount_pct: Optional[float] = Field(None, ge=0, le=30)
    min_cart_for_discount_paise: Optional[int] = Field(None, ge=0)
    no_discount_categories: Optional[List[str]] = None


class MerchantPolicyCreate(BaseModel):
    code: str
    description: Optional[str] = None
    discount_type: str  # "percentage" | "fixed"
    discount_value: float
    max_discount_paise: Optional[int] = None
    min_order_paise: int = 0
    max_uses: Optional[int] = None
    valid_until: Optional[datetime] = None


class MerchantPolicyUpdate(BaseModel):
    description: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    max_discount_paise: Optional[int] = None
    min_order_paise: Optional[int] = None
    max_uses: Optional[int] = None
    valid_until: Optional[datetime] = None
    is_active: Optional[bool] = None


class ProductAdminCreate(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    category: str
    brand: Optional[str] = None
    price_paise: int = Field(..., ge=1)
    original_price_paise: Optional[int] = None
    stock_quantity: int = Field(..., ge=0)
    image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: bool = True


class ProductAdminUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    price_paise: Optional[int] = Field(None, ge=1)
    original_price_paise: Optional[int] = None
    stock_quantity: Optional[int] = Field(None, ge=0)
    image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


class BulkStockUpdateItem(BaseModel):
    product_id: str
    stock_quantity: int = Field(..., ge=0)


class BulkStockUpdateRequest(BaseModel):
    updates: List[BulkStockUpdateItem]


class OrderFulfillmentUpdate(BaseModel):
    status: str
    tracking_link: Optional[str] = None
    tracking_carrier: Optional[str] = None
