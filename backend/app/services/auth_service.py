"""
AgentCART – Auth Service
Handles customer Google OAuth verification, Email+Password auth, and Phone OTP flows.
"""
from __future__ import annotations
import uuid, random, string, hashlib
from datetime import datetime, timedelta
from typing import Optional
import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.models import User
from app.core.config import get_settings

settings = get_settings()

# ─── In-memory OTP store (replace with Redis in prod) ─────────────────────────
_otp_store: dict[str, tuple[str, datetime]] = {}  # phone -> (otp, expiry)


def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt."""
    return hashlib.sha256(f"agentcart_salt_{password}".encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    return hash_password(plain_password) == hashed_password


def create_access_token(user_id: str, email: Optional[str] = None) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except Exception:
        return None


async def register_email_user(db: AsyncSession, email: str, name: str, password: Optional[str] = None) -> User:
    """Register a new user with email, name, and password."""
    result = await db.execute(
        select(User).options(selectinload(User.addresses)).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    pwd_hash = hash_password(password) if password else None

    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            name=name,
            hashed_password=pwd_hash,
            auth_provider="email",
            is_active=True,
            created_at=datetime.utcnow(),
        )
        db.add(user)
        await db.flush()
    else:
        if name and not user.name:
            user.name = name
        if password:
            user.hashed_password = pwd_hash
        await db.flush()
    return user


async def authenticate_email_user(db: AsyncSession, email: str, password: str) -> tuple[Optional[User], Optional[str]]:
    """Authenticate existing user with email and password."""
    result = await db.execute(
        select(User).options(selectinload(User.addresses)).where(User.email == email)
    )
    user = result.scalar_one_or_none()

    if not user:
        return None, "User not found. Please create an account first."

    if user.hashed_password is not None:
        if not verify_password(password, user.hashed_password):
            return None, "Incorrect password. Please try again."
    else:
        # First time login for legacy seed user: set their password
        user.hashed_password = hash_password(password)
        await db.flush()

    return user, None


async def get_or_create_google_user(db: AsyncSession, email: str, name: str, password: Optional[str] = None) -> User:
    """Find or create a user by email with optional password."""
    return await register_email_user(db, email=email, name=name, password=password)


def send_otp(phone: str) -> str:
    """Generate and store a 6-digit OTP for the given phone number."""
    otp = "".join(random.choices(string.digits, k=6))
    expiry = datetime.utcnow() + timedelta(minutes=10)
    _otp_store[phone] = (otp, expiry)
    print(f"[DEV] OTP for {phone}: {otp}")
    return otp


def verify_otp(phone: str, otp: str) -> bool:
    """Verify the OTP for a phone number."""
    entry = _otp_store.get(phone)
    if not entry:
        return False
    stored_otp, expiry = entry
    if datetime.utcnow() > expiry:
        del _otp_store[phone]
        return False
    if stored_otp != otp:
        return False
    del _otp_store[phone]
    return True


async def get_or_create_phone_user(db: AsyncSession, phone: str) -> User:
    """Find or create a user by phone number."""
    result = await db.execute(
        select(User).options(selectinload(User.addresses)).where(User.phone == phone)
    )
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email=None,
            name=f"User {phone[-4:]}",
            phone=phone,
            hashed_password=None,
            auth_provider="phone_otp",
            is_active=True,
            created_at=datetime.utcnow(),
        )
        db.add(user)
        await db.flush()
    return user


async def get_current_user(db: AsyncSession, token: str) -> Optional[User]:
    """Decode JWT and return the current user with addresses eagerly loaded."""
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    result = await db.execute(
        select(User)
        .options(selectinload(User.addresses))
        .where(User.id == user_id)
    )
    return result.scalar_one_or_none()
