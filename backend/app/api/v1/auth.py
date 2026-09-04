"""
AgentCART – Auth API Router
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.database import get_db
from app.services import auth_service

router = APIRouter()

class EmailLoginRequest(BaseModel):
    email: str
    password: str

class EmailSignupRequest(BaseModel):
    email: str
    name: str
    password: str

class GoogleAuthRequest(BaseModel):
    email: str
    name: str
    google_token: Optional[str] = "mock"
    password: Optional[str] = None

class OtpSendRequest(BaseModel):
    phone: str

class OtpVerifyRequest(BaseModel):
    phone: str
    otp: str

async def get_current_user_dep(authorization: str = Header(None), db: AsyncSession = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid authorization header")
    token = authorization.split(" ")[1]
    user = await auth_service.get_current_user(db, token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user

async def build_user_payload(db: AsyncSession, user):
    addresses = []
    for a in getattr(user, 'addresses', []):
        addresses.append({
            "id": a.id, "label": a.label, "full_name": a.full_name, "phone": a.phone,
            "street_address": a.street_address, "city": a.city, "state": a.state,
            "pincode": a.pincode, "is_default": a.is_default
        })
    from app.services.merchant_service import get_my_store
    store = await get_my_store(db, user.id)
    owned_store = None
    if store:
        owned_store = {"id": store.id, "slug": store.slug, "name": store.name}
    return {
        "id": user.id, "email": user.email, "name": user.name,
        "phone": user.phone, "addresses": addresses, "owned_store": owned_store
    }


@router.post("/auth/login")
async def email_login(body: EmailLoginRequest, db: AsyncSession = Depends(get_db)):
    user, error = await auth_service.authenticate_email_user(db, body.email, body.password)
    if error or not user:
        raise HTTPException(status_code=400, detail=error or "Invalid email or password")
    token = auth_service.create_access_token(user.id, user.email)
    user_payload = await build_user_payload(db, user)
    return {"access_token": token, "token_type": "bearer", "user": user_payload}

@router.post("/auth/signup")
async def email_signup(body: EmailSignupRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.register_email_user(db, body.email, body.name, body.password)
    token = auth_service.create_access_token(user.id, user.email)
    user_payload = await build_user_payload(db, user)
    return {"access_token": token, "token_type": "bearer", "user": user_payload}

@router.post("/auth/google")
async def auth_google(body: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    if body.password:
        user, error = await auth_service.authenticate_email_user(db, body.email, body.password)
        if error:
            user = await auth_service.get_or_create_google_user(db, body.email, body.name, body.password)
    else:
        user = await auth_service.get_or_create_google_user(db, body.email, body.name)
    
    token = auth_service.create_access_token(user.id, user.email)
    user_payload = await build_user_payload(db, user)
    return {"access_token": token, "token_type": "bearer", "user": user_payload}

@router.post("/auth/otp/send")
async def send_otp_route(body: OtpSendRequest):
    otp = auth_service.send_otp(body.phone)
    return {"message": "OTP sent", "otp_hint": otp}

@router.post("/auth/otp/verify")
async def verify_otp_route(body: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    is_valid = auth_service.verify_otp(body.phone, body.otp)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    user = await auth_service.get_or_create_phone_user(db, body.phone)
    token = auth_service.create_access_token(user.id)
    user_payload = await build_user_payload(db, user)
    return {"access_token": token, "token_type": "bearer", "user": user_payload}

@router.get("/auth/me")
async def get_me(user = Depends(get_current_user_dep), db: AsyncSession = Depends(get_db)):
    return await build_user_payload(db, user)
