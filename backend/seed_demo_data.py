"""
AgentCART — Seed Script for 3 Merchants (with Stores & Products) and 3 Customers (with Addresses & Passwords)
"""
import asyncio
import uuid
import hashlib
from datetime import datetime
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.models import User, Store, Product, Address

def _uuid():
    return str(uuid.uuid4())

def hash_password(password: str) -> str:
    return hashlib.sha256(f"agentcart_salt_{password}".encode()).hexdigest()

DEFAULT_PASSWORD_HASH = hash_password("Pass@1234")

async def seed_data():
    async with AsyncSessionLocal() as db:
        print("[SEED] Seeding Demo Merchants, Stores, Products, Customers & Addresses...")

        # ─── 1. MERCHANTS & STORES ──────────────────────────────────────────────
        merchants_data = [
            {
                "owner": {"name": "Vikram Sharma", "email": "vikram@techgear.com", "auth_provider": "email"},
                "store": {"name": "TechGear Store", "slug": "techgear", "domain": "techgear.com"},
                "products": [
                    {
                        "sku": "TG-SONY-XM5",
                        "name": "Sony WH-1000XM5 Wireless Headphones",
                        "description": "Industry-leading noise canceling with two processors and 8 microphones.",
                        "category": "Electronics",
                        "brand": "Sony",
                        "price_paise": 2999900,
                        "original_price_paise": 3499000,
                        "stock_quantity": 25,
                        "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop",
                        "tags": '["audio", "headphones", "wireless", "sony"]',
                        "rating": 4.8,
                    },
                    {
                        "sku": "TG-MAC-M3",
                        "name": "Apple MacBook Air 15\" M3 Chip",
                        "description": "Strikingly thin and fast laptop with liquid retina display.",
                        "category": "Computing",
                        "brand": "Apple",
                        "price_paise": 11490000,
                        "original_price_paise": 12490000,
                        "stock_quantity": 12,
                        "image_url": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop",
                        "tags": '["laptop", "apple", "macbook", "m3"]',
                        "rating": 4.9,
                    },
                    {
                        "sku": "TG-KEY-K2",
                        "name": "Keychron K2 Wireless Mechanical Keyboard",
                        "description": "75% compact layout wireless mechanical keyboard with Gateron switches.",
                        "category": "Computing",
                        "brand": "Keychron",
                        "price_paise": 749900,
                        "original_price_paise": 899900,
                        "stock_quantity": 40,
                        "image_url": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop",
                        "tags": '["keyboard", "mechanical", "keychron"]',
                        "rating": 4.7,
                    },
                    {
                        "sku": "TG-DELL-4K",
                        "name": "Dell UltraSharp 27\" 4K USB-C Hub Monitor",
                        "description": "Brilliant 4K color display with integrated 90W USB-C charging.",
                        "category": "Electronics",
                        "brand": "Dell",
                        "price_paise": 4200000,
                        "original_price_paise": 4800000,
                        "stock_quantity": 15,
                        "image_url": "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop",
                        "tags": '["monitor", "4k", "dell", "display"]',
                        "rating": 4.6,
                    },
                ]
            },
            {
                "owner": {"name": "Priya Mehta", "email": "priya@nozicloth.com", "auth_provider": "email"},
                "store": {"name": "Nozi Clothings", "slug": "nozicloth", "domain": "nozicloth.com"},
                "products": [
                    {
                        "sku": "NZ-HD-001",
                        "name": "Premium Organic Cotton Oversized Hoodie",
                        "description": "Heavyweight 400 GSM fleece hoodie made from 100% organic Indian cotton.",
                        "category": "Fashion",
                        "brand": "Nozi",
                        "price_paise": 249900,
                        "original_price_paise": 329900,
                        "stock_quantity": 50,
                        "image_url": "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=500&auto=format&fit=crop",
                        "tags": '["hoodie", "streetwear", "cotton", "fashion"]',
                        "rating": 4.8,
                    },
                    {
                        "sku": "NZ-SH-002",
                        "name": "Slim-Fit Pure Linen Casual Shirt",
                        "description": "Breathable French linen shirt tailored for effortless casual sophistication.",
                        "category": "Fashion",
                        "brand": "Nozi",
                        "price_paise": 189900,
                        "original_price_paise": 249900,
                        "stock_quantity": 35,
                        "image_url": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&auto=format&fit=crop",
                        "tags": '["shirt", "linen", "casual", "menswear"]',
                        "rating": 4.5,
                    },
                    {
                        "sku": "NZ-JK-003",
                        "name": "Vintage Wash Raw Denim Jacket",
                        "description": "Classic trucker silhouette denim jacket with custom brass button detailing.",
                        "category": "Fashion",
                        "brand": "Nozi",
                        "price_paise": 399900,
                        "original_price_paise": 499900,
                        "stock_quantity": 20,
                        "image_url": "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=500&auto=format&fit=crop",
                        "tags": '["denim", "jacket", "vintage", "outerwear"]',
                        "rating": 4.7,
                    },
                    {
                        "sku": "NZ-SN-004",
                        "name": "Minimalist White Italian Leather Sneakers",
                        "description": "Handcrafted low-top sneakers with supple Nappa leather uppers.",
                        "category": "Fashion",
                        "brand": "Nozi",
                        "price_paise": 429900,
                        "original_price_paise": 599900,
                        "stock_quantity": 30,
                        "image_url": "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&auto=format&fit=crop",
                        "tags": '["sneakers", "footwear", "leather", "white"]',
                        "rating": 4.9,
                    },
                ]
            },
            {
                "owner": {"name": "Rajesh Verma", "email": "rajesh@urbanliving.io", "auth_provider": "email"},
                "store": {"name": "Urban Living", "slug": "urbanliving", "domain": "urbanliving.io"},
                "products": [
                    {
                        "sku": "UL-CF-101",
                        "name": "Smart Barista 15-Bar Espresso Machine",
                        "description": "Italian pump espresso maker with built-in steam wand and micro-foam frother.",
                        "category": "Home & Kitchen",
                        "brand": "Urban Barista",
                        "price_paise": 1850000,
                        "original_price_paise": 2200000,
                        "stock_quantity": 18,
                        "image_url": "https://images.unsplash.com/photo-1517668808822-9e428824603b?w=500&auto=format&fit=crop",
                        "tags": '["coffee", "espresso", "barista", "kitchen"]',
                        "rating": 4.8,
                    },
                    {
                        "sku": "UL-CH-202",
                        "name": "Ergonomic Mesh Office Chair with Lumbar Support",
                        "description": "Fully adjustable headrest, 3D armrests, and high-density breathable mesh back.",
                        "category": "Home & Kitchen",
                        "brand": "Urban Ergonomics",
                        "price_paise": 1299900,
                        "original_price_paise": 1699900,
                        "stock_quantity": 25,
                        "image_url": "https://images.unsplash.com/photo-1580481072645-022f9a6d83d0?w=500&auto=format&fit=crop",
                        "tags": '["chair", "office", "ergonomic", "furniture"]',
                        "rating": 4.6,
                    },
                    {
                        "sku": "UL-DF-303",
                        "name": "Ultrasonic Ceramic Essential Oil Aroma Diffuser",
                        "description": "Whisper-quiet ceramic diffuser with ambient warm LED lighting and auto-shutoff.",
                        "category": "Home & Kitchen",
                        "brand": "Urban Essence",
                        "price_paise": 149900,
                        "original_price_paise": 199900,
                        "stock_quantity": 60,
                        "image_url": "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500&auto=format&fit=crop",
                        "tags": '["diffuser", "decor", "wellness", "home"]',
                        "rating": 4.7,
                    },
                    {
                        "sku": "UL-TS-404",
                        "name": "Handcrafted Solid Teakwood 4-Seater Dining Set",
                        "description": "Sustainably harvested natural teakwood table with plush upholstered chairs.",
                        "category": "Home & Kitchen",
                        "brand": "Urban Craft",
                        "price_paise": 3400000,
                        "original_price_paise": 4200000,
                        "stock_quantity": 8,
                        "image_url": "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=500&auto=format&fit=crop",
                        "tags": '["dining", "furniture", "teakwood", "table"]',
                        "rating": 4.9,
                    },
                ]
            }
        ]

        for m_info in merchants_data:
            # Check or create merchant user
            email = m_info["owner"]["email"]
            u_res = await db.execute(select(User).where(User.email == email))
            owner_user = u_res.scalar_one_or_none()
            if not owner_user:
                owner_user = User(
                    id=_uuid(),
                    email=email,
                    name=m_info["owner"]["name"],
                    hashed_password=DEFAULT_PASSWORD_HASH,
                    auth_provider=m_info["owner"]["auth_provider"],
                    is_active=True,
                )
                db.add(owner_user)
                await db.flush()
            else:
                owner_user.hashed_password = DEFAULT_PASSWORD_HASH

            # Check or create Store
            slug = m_info["store"]["slug"]
            s_res = await db.execute(select(Store).where(Store.slug == slug))
            store = s_res.scalar_one_or_none()
            if not store:
                store = Store(
                    id=_uuid(),
                    name=m_info["store"]["name"],
                    slug=slug,
                    domain=m_info["store"]["domain"],
                    owner_user_id=owner_user.id,
                    public_api_key=_uuid().replace("-", ""),
                    secret_api_key=_uuid().replace("-", ""),
                    is_active=True,
                )
                db.add(store)
                await db.flush()
            else:
                store.owner_user_id = owner_user.id

            # Add products
            for p_info in m_info["products"]:
                p_res = await db.execute(select(Product).where(Product.sku == p_info["sku"]))
                product = p_res.scalar_one_or_none()
                if not product:
                    product = Product(
                        id=_uuid(),
                        sku=p_info["sku"],
                        name=p_info["name"],
                        description=p_info["description"],
                        category=p_info["category"],
                        brand=p_info["brand"],
                        price_paise=p_info["price_paise"],
                        original_price_paise=p_info["original_price_paise"],
                        stock_quantity=p_info["stock_quantity"],
                        image_url=p_info["image_url"],
                        tags=p_info["tags"],
                        rating=p_info["rating"],
                        store_id=store.id,
                        is_active=True
                    )
                    db.add(product)
                else:
                    product.store_id = store.id

        # ─── 2. CUSTOMERS & ADDRESSES ──────────────────────────────────────────
        customers_data = [
            {
                "user": {
                    "name": "Aarav Patel",
                    "email": "aarav.patel@gmail.com",
                    "phone": None,
                    "auth_provider": "email",
                },
                "address": {
                    "label": "Home",
                    "full_name": "Aarav Patel",
                    "phone": "+919812345678",
                    "street_address": "Flat 402, Sunshine Apartments, MG Road, Indiranagar",
                    "landmark": "Near Indiranagar Metro Station",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560038",
                    "is_default": True,
                }
            },
            {
                "user": {
                    "name": "Ananya Roy",
                    "email": None,
                    "phone": "+919876543210",
                    "auth_provider": "phone_otp",
                },
                "address": {
                    "label": "Office",
                    "full_name": "Ananya Roy",
                    "phone": "+919876543210",
                    "street_address": "Tower B, 7th Floor, Cyber City, DLF Phase 2",
                    "landmark": "Opposite Cyber Hub, DLF Phase 2",
                    "city": "Gurugram",
                    "state": "Haryana",
                    "pincode": "122002",
                    "is_default": True,
                }
            },
            {
                "user": {
                    "name": "Rohan Malhotra",
                    "email": "rohan.m@yahoo.com",
                    "phone": None,
                    "auth_provider": "email",
                },
                "address": {
                    "label": "Apartment",
                    "full_name": "Rohan Malhotra",
                    "phone": "+919711223344",
                    "street_address": "12B Horizon Towers, Turner Road, Bandra West",
                    "landmark": "Near Bandra Kurla Complex",
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "pincode": "400050",
                    "is_default": True,
                }
            }
        ]

        for c_info in customers_data:
            u_data = c_info["user"]
            if u_data["email"]:
                u_res = await db.execute(select(User).where(User.email == u_data["email"]))
            else:
                u_res = await db.execute(select(User).where(User.phone == u_data["phone"]))

            cust_user = u_res.scalar_one_or_none()
            if not cust_user:
                cust_user = User(
                    id=_uuid(),
                    email=u_data["email"],
                    name=u_data["name"],
                    phone=u_data["phone"],
                    hashed_password=DEFAULT_PASSWORD_HASH if u_data["email"] else None,
                    auth_provider=u_data["auth_provider"],
                    is_active=True,
                )
                db.add(cust_user)
                await db.flush()
            else:
                if u_data["email"]:
                    cust_user.hashed_password = DEFAULT_PASSWORD_HASH

            # Add address
            a_data = c_info["address"]
            a_res = await db.execute(select(Address).where(Address.user_id == cust_user.id))
            existing_addr = a_res.scalar_one_or_none()
            if not existing_addr:
                addr = Address(
                    id=_uuid(),
                    user_id=cust_user.id,
                    label=a_data["label"],
                    full_name=a_data["full_name"],
                    phone=a_data["phone"],
                    street_address=a_data["street_address"],
                    landmark=a_data.get("landmark"),
                    city=a_data["city"],
                    state=a_data["state"],
                    pincode=a_data["pincode"],
                    is_default=a_data["is_default"],
                )
                db.add(addr)

        await db.commit()
        print("[SUCCESS] Demo Merchants, Stores, Products, Customers & Passwords successfully seeded!")

if __name__ == "__main__":
    asyncio.run(seed_data())
