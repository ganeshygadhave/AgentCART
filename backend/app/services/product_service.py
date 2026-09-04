"""
AgentCART – Product Service (Phase 2)

All product queries go through this service.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional

from app.models.models import Product

# Words to ignore when splitting a multi-word query
_STOP_WORDS = {
    "me", "show", "find", "search", "get", "give", "list", "some", "a", "an",
    "the", "and", "or", "for", "of", "in", "on", "with", "under", "above",
    "below", "products", "items", "things", "something", "all", "best",
    "good", "great", "nice", "any", "i", "want", "need", "looking",
}


def _query_variants(q: str) -> list[str]:
    """
    Given a user query, return a list of search terms to try (in order of specificity).
    Handles plural -> singular stripping and multi-word splitting.
    """
    q = q.strip().lower()
    variants = [q]

    # Add singular form: strip trailing 's' if word > 4 chars (laptops -> laptop)
    if q.endswith("s") and len(q) > 4 and not q.endswith("ss"):
        variants.append(q[:-1])

    # Split into individual meaningful words
    words = [w for w in q.split() if w not in _STOP_WORDS and len(w) > 2]
    for word in words:
        if word not in variants:
            variants.append(word)
        # Also try singular of each word
        if word.endswith("s") and len(word) > 4 and not word.endswith("ss"):
            singular = word[:-1]
            if singular not in variants:
                variants.append(singular)

    return variants


class ProductService:

    @staticmethod
    async def list_products(
        db: AsyncSession,
        q: Optional[str] = None,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        in_stock: Optional[bool] = None,
        sort: str = "featured",
        limit: int = 50,
        offset: int = 0,
    ) -> list[Product]:

        # ─── Multi-term search: try the full query first, then word-by-word ──
        if q:
            variants = _query_variants(q)
            seen_ids: set[str] = set()
            results: list[Product] = []

            for term in variants:
                if len(results) >= limit:
                    break
                search = f"%{term}%"
                stmt = select(Product).where(
                    Product.is_active == True,
                    or_(
                        func.lower(Product.name).like(search),
                        func.lower(Product.description).like(search),
                        func.lower(Product.brand).like(search),
                        func.lower(Product.category).like(search),
                        func.lower(Product.tags).like(search),
                    )
                )

                if category:
                    stmt = stmt.where(func.lower(Product.category) == category.lower())
                if brand:
                    stmt = stmt.where(func.lower(Product.brand) == brand.lower())
                if min_price is not None:
                    stmt = stmt.where(Product.price_paise >= int(min_price * 100))
                if max_price is not None:
                    stmt = stmt.where(Product.price_paise <= int(max_price * 100))
                if in_stock is True:
                    stmt = stmt.where(Product.stock_quantity > 0)

                if sort == "price_asc":
                    stmt = stmt.order_by(Product.price_paise.asc())
                elif sort == "price_desc":
                    stmt = stmt.order_by(Product.price_paise.desc())
                elif sort == "rating":
                    stmt = stmt.order_by(Product.rating.desc().nullslast())
                elif sort == "newest":
                    stmt = stmt.order_by(Product.created_at.desc())
                else:
                    stmt = stmt.order_by(Product.review_count.desc().nullslast())

                stmt = stmt.limit(limit)
                result = await db.execute(stmt)
                for p in result.scalars().all():
                    if p.id not in seen_ids:
                        seen_ids.add(p.id)
                        results.append(p)

            return results[:limit]

        # ─── No query: apply remaining filters only ───────────────────────────
        stmt = select(Product).where(Product.is_active == True)

        if category:
            stmt = stmt.where(func.lower(Product.category) == category.lower())
        if brand:
            stmt = stmt.where(func.lower(Product.brand) == brand.lower())
        if min_price is not None:
            stmt = stmt.where(Product.price_paise >= int(min_price * 100))
        if max_price is not None:
            stmt = stmt.where(Product.price_paise <= int(max_price * 100))
        if in_stock is True:
            stmt = stmt.where(Product.stock_quantity > 0)

        if sort == "price_asc":
            stmt = stmt.order_by(Product.price_paise.asc())
        elif sort == "price_desc":
            stmt = stmt.order_by(Product.price_paise.desc())
        elif sort == "rating":
            stmt = stmt.order_by(Product.rating.desc().nullslast())
        elif sort == "newest":
            stmt = stmt.order_by(Product.created_at.desc())
        else:
            stmt = stmt.order_by(Product.review_count.desc().nullslast())

        stmt = stmt.limit(limit).offset(offset)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_product(db: AsyncSession, product_id: str) -> Optional[Product]:
        result = await db.execute(
            select(Product)
            .options(selectinload(Product.store))
            .where(Product.id == product_id, Product.is_active == True)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_product_by_sku(db: AsyncSession, sku: str) -> Optional[Product]:
        result = await db.execute(
            select(Product).where(Product.sku == sku, Product.is_active == True)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_categories(db: AsyncSession) -> list[str]:
        result = await db.execute(
            select(Product.category)
            .where(Product.is_active == True)
            .distinct()
            .order_by(Product.category)
        )
        return [row[0] for row in result.all()]

    @staticmethod
    async def check_stock(db: AsyncSession, product_id: str, quantity: int) -> tuple[bool, int]:
        """Returns (is_available, current_stock)."""
        product = await ProductService.get_product(db, product_id)
        if not product:
            return False, 0
        return product.stock_quantity >= quantity, product.stock_quantity

    @staticmethod
    async def decrement_stock(db: AsyncSession, product_id: str, quantity: int) -> bool:
        """Atomically decrement stock. Returns True if successful."""
        product = await ProductService.get_product(db, product_id)
        if not product or product.stock_quantity < quantity:
            return False
        product.stock_quantity -= quantity
        db.add(product)
        return True
