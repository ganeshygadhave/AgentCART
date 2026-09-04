"""
AgentCART – SQLAlchemy ORM Models

All monetary values are stored as integers (paise / cents) to avoid
floating-point precision issues. Convert to rupees on output.
"""
import uuid
import enum
from datetime import datetime

from sqlalchemy import (
    String, Integer, Text, Boolean, Float, DateTime, ForeignKey,
    Enum as SAEnum, JSON, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


# ─── Enumerations ────────────────────────────────────────────────────────────

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PAYMENT_INITIATED = "payment_initiated"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    SHIPPED = "shipped"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"


class PaymentStatus(str, enum.Enum):
    CREATED = "created"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    FAILED = "failed"
    REFUNDED = "refunded"


class AuditEventType(str, enum.Enum):
    AGENT_TOOL_CALL = "agent_tool_call"
    POLICY_EVALUATION = "policy_evaluation"
    CART_MUTATION = "cart_mutation"
    ORDER_STATE_CHANGE = "order_state_change"
    PAYMENT_STATE_CHANGE = "payment_state_change"
    WEBHOOK_RECEIVED = "webhook_received"


# ─── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(20), default="email")
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    carts: Mapped[list["Cart"]] = relationship("Cart", back_populates="user")
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="user")
    conversations: Mapped[list["Conversation"]] = relationship("Conversation", back_populates="user")
    addresses: Mapped[list["Address"]] = relationship("Address", back_populates="user")
    owned_stores: Mapped[list["Store"]] = relationship("Store", back_populates="owner")


# ─── Product ──────────────────────────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    brand: Mapped[str] = mapped_column(String(100), nullable=True)
    # Price stored in paise (₹ × 100) for precision
    price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    original_price_paise: Mapped[int] = mapped_column(Integer, nullable=True)
    stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    image_url: Mapped[str] = mapped_column(String(500), nullable=True)
    tags: Mapped[str] = mapped_column(Text, nullable=True)  # JSON array as string
    rating: Mapped[float] = mapped_column(Float, nullable=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    store_id: Mapped[Optional[str]] = mapped_column(ForeignKey("stores.id"), nullable=True)

    cart_items: Mapped[list["CartItem"]] = relationship("CartItem", back_populates="product")
    order_items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="product")
    store: Mapped[Optional["Store"]] = relationship("Store", back_populates="products")

    @property
    def price(self) -> float:
        """Price in rupees."""
        return self.price_paise / 100

    @property
    def original_price(self) -> float | None:
        return self.original_price_paise / 100 if self.original_price_paise else None


# ─── Merchant Policy ──────────────────────────────────────────────────────────

class MerchantPolicy(Base):
    __tablename__ = "merchant_policies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True)
    discount_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "percentage" | "fixed"
    discount_value: Mapped[float] = mapped_column(Float, nullable=False)
    max_discount_paise: Mapped[int] = mapped_column(Integer, nullable=True)  # cap in paise
    min_order_paise: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_uses: Mapped[int] = mapped_column(Integer, nullable=True)  # None = unlimited
    current_uses: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    valid_from: Mapped[datetime] = mapped_column(DateTime, default=_now)
    valid_until: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    store_id: Mapped[Optional[str]] = mapped_column(ForeignKey("stores.id"), nullable=True)

    store: Mapped[Optional["Store"]] = relationship("Store", back_populates="policies")


# ─── Cart ─────────────────────────────────────────────────────────────────────

class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=True)
    session_id: Mapped[str] = mapped_column(String(36), nullable=True)  # Guest cart
    applied_coupon_code: Mapped[str] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
    store_id: Mapped[Optional[str]] = mapped_column(ForeignKey("stores.id"), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="carts")
    items: Mapped[list["CartItem"]] = relationship(
        "CartItem", back_populates="cart", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["Conversation"]] = relationship("Conversation", back_populates="cart")


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("cart_id", "product_id", name="uq_cart_product"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    cart_id: Mapped[str] = mapped_column(ForeignKey("carts.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Snapshot of price at time of adding to cart (in paise)
    unit_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    cart: Mapped["Cart"] = relationship("Cart", back_populates="items")
    product: Mapped["Product"] = relationship("Product", back_populates="cart_items")

    @property
    def subtotal_paise(self) -> int:
        return self.unit_price_paise * self.quantity


# ─── Conversation (AI Agent) ──────────────────────────────────────────────────

class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=True)
    cart_id: Mapped[str] = mapped_column(ForeignKey("carts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    user: Mapped["User"] = relationship("User", back_populates="conversations")
    cart: Mapped["Cart"] = relationship("Cart", back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan",
        order_by="Message.created_at"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" | "assistant" | "tool"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tool_calls: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")


# ─── Order ────────────────────────────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    order_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=True)
    cart_id: Mapped[str] = mapped_column(ForeignKey("carts.id"), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(SAEnum(OrderStatus), default=OrderStatus.PENDING)
    subtotal_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_paise: Mapped[int] = mapped_column(Integer, default=0)
    total_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    applied_coupon_code: Mapped[str] = mapped_column(String(50), nullable=True)
    shipping_address: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    razorpay_order_id: Mapped[str] = mapped_column(String(100), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
    store_id: Mapped[Optional[str]] = mapped_column(ForeignKey("stores.id"), nullable=True)
    shipping_address_id: Mapped[Optional[str]] = mapped_column(ForeignKey("addresses.id"), nullable=True)
    tracking_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    tracking_carrier: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    shipped_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    product_name: Mapped[str] = mapped_column(String(500), nullable=False)  # Snapshot
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    subtotal_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="items")
    product: Mapped["Product"] = relationship("Product", back_populates="order_items")


# ─── Payment ──────────────────────────────────────────────────────────────────

class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"))
    razorpay_payment_id: Mapped[str] = mapped_column(String(100), nullable=True, unique=True)
    razorpay_order_id: Mapped[str] = mapped_column(String(100), nullable=True)
    razorpay_signature: Mapped[str] = mapped_column(String(500), nullable=True)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(SAEnum(PaymentStatus), default=PaymentStatus.CREATED)
    method: Mapped[str] = mapped_column(String(50), nullable=True)
    error_code: Mapped[str] = mapped_column(String(100), nullable=True)
    error_description: Mapped[str] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(100), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    order: Mapped["Order"] = relationship("Order", back_populates="payments")


# ─── Audit Log ────────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    event_type: Mapped[AuditEventType] = mapped_column(SAEnum(AuditEventType), nullable=False)
    actor: Mapped[str] = mapped_column(String(100), nullable=True)  # "agent" | "user:<id>" | "webhook"
    entity_type: Mapped[str] = mapped_column(String(50), nullable=True)  # "cart" | "order" | "payment"
    entity_id: Mapped[str] = mapped_column(String(36), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    outcome: Mapped[str] = mapped_column(String(20), nullable=True)  # "success" | "failure"
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    store_id: Mapped[Optional[str]] = mapped_column(ForeignKey("stores.id"), nullable=True)


# ─── Store ────────────────────────────────────────────────────────────────────
class Store(Base):
    __tablename__ = "stores"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)  # e.g. "agentcart"
    domain: Mapped[str] = mapped_column(String(255), nullable=True)  # e.g. "nozicloth.com"
    public_api_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, default=_uuid)
    secret_api_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, default=_uuid)
    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    products: Mapped[list["Product"]] = relationship("Product", back_populates="store")
    policies: Mapped[list["MerchantPolicy"]] = relationship("MerchantPolicy", back_populates="store")
    owner: Mapped[Optional["User"]] = relationship("User", back_populates="owned_stores")
    agent_config: Mapped[Optional["StoreAgentConfig"]] = relationship("StoreAgentConfig", back_populates="store", uselist=False)

# ─── Address ──────────────────────────────────────────────────────────────────
class Address(Base):
    __tablename__ = "addresses"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(50), nullable=False, default="Home")  # e.g. Home, Work
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    street_address: Mapped[str] = mapped_column(Text, nullable=False)
    landmark: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    pincode: Mapped[str] = mapped_column(String(20), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    user: Mapped["User"] = relationship("User", back_populates="addresses")


# ─── Store Agent Config ───────────────────────────────────────────────────────
class StoreAgentConfig(Base):
    __tablename__ = "store_agent_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), unique=True, nullable=False)
    persona_name: Mapped[str] = mapped_column(String(100), default="AgentCART Assistant")
    store_context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    greeting_message: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # AI Discount Guardrails
    max_discount_pct: Mapped[float] = mapped_column(Float, default=0.0)  # 0-30
    min_cart_for_discount_paise: Mapped[int] = mapped_column(Integer, default=0)
    no_discount_categories: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    store: Mapped["Store"] = relationship("Store", back_populates="agent_config")
