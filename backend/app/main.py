"""
AgentCART – FastAPI Application Entry Point
"""
# ── Python 3.14 compatibility patch ──────────────────────────────────────────
# pkg_resources was removed from Python 3.14 stdlib. The razorpay SDK uses it
# only to read its own version. This stub satisfies the import silently.
import sys as _sys
if "pkg_resources" not in _sys.modules:
    import types as _types
    _pkg = _types.ModuleType("pkg_resources")
    _pkg.require = lambda *a, **kw: None
    _pkg.get_distribution = lambda *a, **kw: _types.SimpleNamespace(version="0.0.0")
    _pkg.DistributionNotFound = Exception
    _pkg.VersionConflict = Exception
    _sys.modules["pkg_resources"] = _pkg
# ─────────────────────────────────────────────────────────────────────────────

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.database import create_all_tables

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup."""
    await create_all_tables()
    yield


app = FastAPI(
    title="AgentCART API",
    description="Agentic Commerce Platform — Server-Side Policy Engine & Conversational Checkout",
    version="1.0.0",
    lifespan=lifespan,
)

origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else [],
    allow_origin_regex=r".*" if origins == ["*"] else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
async def root():
    return {
        "name": settings.app_name,
        "status": "operational",
        "environment": settings.app_env,
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


# ─── Register API Routers ────────────────────────────────────────────────────
from app.api.v1 import products, cart, agent, checkout, auth, users, merchants

app.include_router(products.router, prefix="/api/v1", tags=["Products"])
app.include_router(cart.router, prefix="/api/v1", tags=["Cart"])
app.include_router(agent.router, prefix="/api/v1", tags=["Agent"])
app.include_router(checkout.router, prefix="/api/v1", tags=["Checkout"])
app.include_router(auth.router, prefix="/api/v1", tags=["Auth"])
app.include_router(users.router, prefix="/api/v1", tags=["Users"])
app.include_router(merchants.router, prefix="/api/v1", tags=["Merchants"])
