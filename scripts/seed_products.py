"""
AgentCART – Seed Products Script
Run with: python scripts/seed_products.py

Populates the database with a realistic product catalogue across
multiple categories for demo purposes.
"""
import asyncio
import sys
import os

# Allow running from project root
_backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, _backend_dir)
os.chdir(_backend_dir)  # Ensure .env and agentcart.db are found in backend/

from app.db.database import AsyncSessionLocal, create_all_tables
from app.models.models import Product, MerchantPolicy, Store
import uuid
import secrets


PRODUCTS = [
    # ─── Electronics ─────────────────────────────────────────────────────────
    {
        "sku": "ELEC-001",
        "name": "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
        "description": "Industry-leading noise cancellation with 30-hour battery life, crystal-clear hands-free calling, and precise voice pickup. Multipoint connection lets you pair with two devices simultaneously.",
        "category": "Electronics",
        "brand": "Sony",
        "price_paise": 2999900,
        "original_price_paise": 3499900,
        "stock_quantity": 42,
        "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600",
        "tags": '["headphones", "wireless", "noise-cancelling", "premium", "audio"]',
        "rating": 4.8,
        "review_count": 2341,
    },
    {
        "sku": "ELEC-002",
        "name": "Apple AirPods Pro (2nd Generation)",
        "description": "Active Noise Cancellation, Transparency mode, and Adaptive Audio. Up to 6 hours of listening time with ANC enabled. MagSafe Charging Case provides up to 30 hours total.",
        "category": "Electronics",
        "brand": "Apple",
        "price_paise": 2499900,
        "original_price_paise": 2699900,
        "stock_quantity": 78,
        "image_url": "https://images.unsplash.com/photo-1603351154351-5e2d0600bb77?w=600",
        "tags": '["earbuds", "wireless", "apple", "noise-cancelling", "premium"]',
        "rating": 4.7,
        "review_count": 5821,
    },
    {
        "sku": "ELEC-003",
        "name": "Logitech MX Master 3S Wireless Mouse",
        "description": "Ultra-fast MagSpeed electromagnetic scrolling, 8K DPI sensor, quiet clicks, and ergonomic design. Works on glass and virtually any surface.",
        "category": "Electronics",
        "brand": "Logitech",
        "price_paise": 899900,
        "original_price_paise": 1099900,
        "stock_quantity": 134,
        "image_url": "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600",
        "tags": '["mouse", "wireless", "productivity", "ergonomic"]',
        "rating": 4.9,
        "review_count": 8932,
    },
    {
        "sku": "ELEC-004",
        "name": "Samsung 65\" QLED 4K Smart TV QN65Q80C",
        "description": "Quantum HDR+ with direct full array backlight delivers exceptional contrast. Neural Quantum Processor 4K upscales all your content. Anti-Reflection technology minimizes glare.",
        "category": "Electronics",
        "brand": "Samsung",
        "price_paise": 11499900,
        "original_price_paise": 13999900,
        "stock_quantity": 12,
        "image_url": "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600",
        "tags": '["tv", "4k", "qled", "smart-tv", "samsung"]',
        "rating": 4.6,
        "review_count": 1203,
    },
    {
        "sku": "ELEC-005",
        "name": "Anker 747 Power Bank 26,800mAh",
        "description": "140W total output. Charges a MacBook Pro from 0 to 50% in 45 minutes. Dual USB-C and dual USB-A ports. PowerIQ 4.0 ensures safe and fast charging for any device.",
        "category": "Electronics",
        "brand": "Anker",
        "price_paise": 799900,
        "original_price_paise": 899900,
        "stock_quantity": 256,
        "image_url": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600",
        "tags": '["power-bank", "charging", "portable", "anker"]',
        "rating": 4.7,
        "review_count": 4510,
    },
    # ─── Computing ───────────────────────────────────────────────────────────
    {
        "sku": "COMP-001",
        "name": "Apple MacBook Air 15\" M3 (2024)",
        "description": "15.3-inch Liquid Retina display, M3 chip with 8-core CPU and 10-core GPU, 16GB unified memory, 512GB SSD. Up to 18 hours of battery life. Midnight color.",
        "category": "Computing",
        "brand": "Apple",
        "price_paise": 13499900,
        "original_price_paise": 14499900,
        "stock_quantity": 23,
        "image_url": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600",
        "tags": '["laptop", "apple", "macbook", "m3", "premium"]',
        "rating": 4.9,
        "review_count": 3421,
    },
    {
        "sku": "COMP-002",
        "name": "Samsung 970 EVO Plus 2TB NVMe SSD",
        "description": "Read/write speeds up to 3,500/3,300 MB/s. Optimized for heavy workloads with Samsung's latest V-NAND technology and Intelligent TurboWrite.",
        "category": "Computing",
        "brand": "Samsung",
        "price_paise": 1299900,
        "original_price_paise": 1599900,
        "stock_quantity": 89,
        "image_url": "https://images.unsplash.com/photo-1602526213133-0f3e49b6e0a6?w=600",
        "tags": '["ssd", "storage", "nvme", "samsung", "fast"]',
        "rating": 4.8,
        "review_count": 7234,
    },
    # ─── Home & Kitchen ───────────────────────────────────────────────────────
    {
        "sku": "HOME-001",
        "name": "Philips Hue Starter Kit (4 Bulbs + Bridge)",
        "description": "Transform your home with 16 million colors and whites. Works with Alexa, Google Assistant, and Apple HomeKit. Create scenes and automate your lighting.",
        "category": "Home & Kitchen",
        "brand": "Philips",
        "price_paise": 1299900,
        "original_price_paise": 1499900,
        "stock_quantity": 67,
        "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600",
        "tags": '["smart-home", "lighting", "philips-hue", "automation"]',
        "rating": 4.6,
        "review_count": 2891,
    },
    {
        "sku": "HOME-002",
        "name": "Dyson V15 Detect Cordless Vacuum",
        "description": "Laser detects invisible dust on hard floors. Acoustically-confirmed piezo sensor counts and measures dust particles. Up to 60 minutes of fade-free power.",
        "category": "Home & Kitchen",
        "brand": "Dyson",
        "price_paise": 5499900,
        "original_price_paise": 6499900,
        "stock_quantity": 18,
        "image_url": "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600",
        "tags": '["vacuum", "dyson", "cordless", "smart", "home-appliance"]',
        "rating": 4.7,
        "review_count": 1567,
    },
    {
        "sku": "HOME-003",
        "name": "Nespresso Vertuo Pop Coffee Machine",
        "description": "Brew 5 cup sizes from espresso to alto XL with one-touch operation. Centrifusion technology extracts the perfect cup. Includes 12 coffee pods.",
        "category": "Home & Kitchen",
        "brand": "Nespresso",
        "price_paise": 799900,
        "original_price_paise": 999900,
        "stock_quantity": 104,
        "image_url": "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=600",
        "tags": '["coffee", "nespresso", "kitchen", "appliance"]',
        "rating": 4.5,
        "review_count": 3210,
    },
    # ─── Fashion ─────────────────────────────────────────────────────────────
    {
        "sku": "FASH-001",
        "name": "Levi's 511 Slim Fit Jeans (Dark Wash)",
        "description": "Classic slim fit that sits below the waist with a slim leg from hip to ankle. Made with 98% cotton, 2% elastane for comfort and flexibility. Dark Stonewash.",
        "category": "Fashion",
        "brand": "Levi's",
        "price_paise": 499900,
        "original_price_paise": 699900,
        "stock_quantity": 340,
        "image_url": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600",
        "tags": '["jeans", "denim", "levis", "slim-fit", "fashion"]',
        "rating": 4.4,
        "review_count": 12043,
    },
    {
        "sku": "FASH-002",
        "name": "Nike Air Force 1 '07 White Sneakers",
        "description": "The Nike Air Force 1 '07 carries the legacy of the original with fresh, clean leather. Perforations on the toe add breathability. Foam midsole for lightweight cushioning.",
        "category": "Fashion",
        "brand": "Nike",
        "price_paise": 799900,
        "original_price_paise": 899900,
        "stock_quantity": 185,
        "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600",
        "tags": '["sneakers", "nike", "white", "air-force-1", "shoes"]',
        "rating": 4.7,
        "review_count": 18923,
    },
    # ─── Books ────────────────────────────────────────────────────────────────
    {
        "sku": "BOOK-001",
        "name": "Atomic Habits by James Clear",
        "description": "A proven framework for improving every day. Learn how tiny changes in behavior lead to remarkable results with James Clear's comprehensive guide on habit formation.",
        "category": "Books",
        "brand": "Penguin Random House",
        "price_paise": 59900,
        "original_price_paise": 79900,
        "stock_quantity": 892,
        "image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600",
        "tags": '["book", "self-help", "habits", "productivity", "bestseller"]',
        "rating": 4.9,
        "review_count": 45231,
    },
    {
        "sku": "BOOK-002",
        "name": "The Psychology of Money by Morgan Housel",
        "description": "Timeless lessons on wealth, greed, and happiness. 19 short stories exploring the strange ways people think about money and what you can do to make better financial decisions.",
        "category": "Books",
        "brand": "Harriman House",
        "price_paise": 54900,
        "original_price_paise": 69900,
        "stock_quantity": 654,
        "image_url": "https://images.unsplash.com/photo-1592496431122-2349e0fbc666?w=600",
        "tags": '["book", "finance", "money", "psychology", "investing"]',
        "rating": 4.8,
        "review_count": 32401,
    },
    # ─── Sports & Fitness ─────────────────────────────────────────────────────
    {
        "sku": "SPRT-001",
        "name": "Garmin Forerunner 265 GPS Running Watch",
        "description": "AMOLED color display, advanced running dynamics, training readiness, race widget, and up to 15 days of battery life in smartwatch mode.",
        "category": "Sports & Fitness",
        "brand": "Garmin",
        "price_paise": 3599900,
        "original_price_paise": 3999900,
        "stock_quantity": 31,
        "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600",
        "tags": '["smartwatch", "garmin", "running", "gps", "fitness"]',
        "rating": 4.8,
        "review_count": 2134,
    },
    {
        "sku": "SPRT-002",
        "name": "Manduka PRO Yoga Mat 6mm (Black)",
        "description": "Made from sustainably sourced, dense 6mm cushion for unmatched support and stability. Closed-cell surface prevents moisture from entering. Lifetime guarantee.",
        "category": "Sports & Fitness",
        "brand": "Manduka",
        "price_paise": 1499900,
        "original_price_paise": 1699900,
        "stock_quantity": 73,
        "image_url": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600",
        "tags": '["yoga", "mat", "fitness", "exercise", "premium"]',
        "rating": 4.7,
        "review_count": 5687,
    },
]

POLICIES = [
    {
        "code": "WELCOME10",
        "description": "10% off your first order — max discount ₹500",
        "discount_type": "percentage",
        "discount_value": 10.0,
        "max_discount_paise": 50000,
        "min_order_paise": 50000,
        "max_uses": None,
    },
    {
        "code": "SAVE200",
        "description": "Flat ₹200 off on orders above ₹1,000",
        "discount_type": "fixed",
        "discount_value": 200.0,
        "max_discount_paise": None,
        "min_order_paise": 100000,
        "max_uses": None,
    },
    {
        "code": "FLASH15",
        "description": "12% flash sale discount on Computing products — max 12%",
        "discount_type": "percentage",
        "discount_value": 12.0,
        "max_discount_paise": 150000,
        "min_order_paise": 200000,
        "max_uses": 500,
    },
    {
        "code": "PREMIUM5",
        "description": "5% off eligible Electronics products",
        "discount_type": "percentage",
        "discount_value": 5.0,
        "max_discount_paise": 300000,
        "min_order_paise": 0,
        "max_uses": None,
    },
]


async def seed():
    await create_all_tables()
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select, func
        
        # Seed Store
        result = await session.execute(select(Store).where(Store.slug == 'agentcart'))
        store = result.scalar_one_or_none()
        if store:
            print("[OK] Store already exists. Skipping store seed.")
        else:
            store = Store(
                id=str(uuid.uuid4()),
                name="AgentCART Demo Store",
                slug="agentcart",
                domain="localhost",
                public_api_key=secrets.token_hex(32),
                secret_api_key=secrets.token_hex(32)
            )
            session.add(store)
            await session.flush()
            print("[OK] Seeded default store.")

        # Check if already seeded
        result = await session.execute(select(func.count()).select_from(Product))
        count = result.scalar()
        if count and count > 0:
            print(f"[OK] Database already has {count} products. Skipping product seed.")
        else:
            products = [Product(**p, store_id=store.id) for p in PRODUCTS]
            session.add_all(products)
            print(f"[OK] Seeded {len(products)} products.")

        result = await session.execute(select(func.count()).select_from(MerchantPolicy))
        policy_count = result.scalar()
        if policy_count and policy_count > 0:
            print(f"[OK] Database already has {policy_count} policies. Skipping policy seed.")
        else:
            policies = [MerchantPolicy(**p, store_id=store.id) for p in POLICIES]
            session.add_all(policies)
            print(f"[OK] Seeded {len(policies)} merchant policies.")

        await session.commit()
        print("\n[OK] AgentCART database seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
