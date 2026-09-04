# AgentCART

> **Agentic Commerce Platform** — A conversational AI shopping assistant with server-side policy enforcement and Razorpay test-mode payment integration.

**Track:** AI Growth & Agentic Commerce  
**Stack:** React · FastAPI · Gemini Flash · Groq 70B · Razorpay Test Mode · SQLite/PostgreSQL

🌐 **Live Demo:** [Frontend (Vercel)](https://agentcart.vercel.app) · [Backend API](https://agentcart-1-4kxs.onrender.com/docs)  
📂 **Repo:** [github.com/ganeshygadhave/AgentCART](https://github.com/ganeshygadhave/AgentCART)

---

## What It Solves

Most "AI shopping" demos let the LLM guess prices, hallucinate discounts, and add items to cart without user consent. AgentCART solves this by treating the LLM as an **untrusted orchestrator** — every money action is computed server-side, gated by a deterministic Policy Engine, and logged to an audit trail.

The agent can never:
- Quote a price it computed itself (must call `calculate_total`)
- Add items to cart without explicit user intent
- Apply a discount greater than 12% or use an expired coupon
- Initiate payment without confirmed user consent

---

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for full system diagrams.

```
Browser (React + Vite)
    │
    ▼ REST / Axios
FastAPI Backend (async Python)
    ├── AgentService  ──→  Gemini Flash  (Groq 70B fallback on 429)
    │       └── 14 Agent Tools  (search, cart, orders, analytics...)
    ├── PolicyEngine  ──→  Server-side price authority & guardrails
    └── Razorpay SDK  ──→  order.create → verify_payment_signature
    │
    ▼ SQLAlchemy (async)
SQLite (dev) / PostgreSQL (prod)
    └── 12 tables: users, products, carts, orders, payments,
        audit_logs, conversations, messages, stores, addresses...
```

---

## Features

### Customer-Facing
- **Conversational checkout** — natural language add-to-cart, coupon application, address management
- **AI Product Discovery** — `search_products` tool with category + price filters, never fabricated results
- **Co-purchase Recommendations** — `get_related_products` mines real order history, falls back to semantic category matching
- **Coupon Validation** — `WELCOME10`, `SAVE200`, `FLASH15`, `PREMIUM5` — all server-validated, rate-limited, time-windowed
- **Full Razorpay flow** — order creation → Razorpay checkout modal → HMAC signature verification → payment confirmed

### Merchant Dashboard
- **Real-time Analytics** — revenue, order counts, top products
- **AI Agent Analytics** — conversation conversion rate, top searched queries, most recommended products
- **Low Stock Alerts** — configurable threshold, surfaced by AI agent
- **Order Fulfillment** — update status + attach tracking link via AI command

### Engineering
- **Multi-turn tool-calling loop** — up to 5 turns, Gemini + Groq dual-LLM with automatic fallback
- **Audit Trail** — every agent tool call saved to `messages.tool_calls` JSON column
- **Idempotent payments** — `idempotency_key` on Payment model prevents double-charges
- **Price locked at add-time** — `unit_price_paise` snapshot prevents cart manipulation
- **Async everywhere** — FastAPI + SQLAlchemy async, no blocking I/O in agent loop

---

## What Broke at 2AM (And How We Got Out)

### 1. Groq Rate Limits Killed the Demo

The agent loop calls the LLM up to 5 times per message (multi-turn tool calling). At demo load, Groq's free tier returned `429` on the second turn — meaning the agent would search products, then fail silently when trying to add to cart.

**Fix:** Added a primary/fallback model architecture. On `429`, the agent automatically retries with `llama-3.1-8b-instant` instead of `llama-3.3-70b-versatile`. On `400` (tool schema validation error), it retries without tools and degrades gracefully.

```python
response = await call_groq(http_client, primary_model, messages)
if response.status_code == 429:
    response = await call_groq(http_client, fallback_model, messages)
if response.status_code == 400:
    response = await call_groq(http_client, primary_model, messages, with_tools=False)
```

### 2. LLM Hallucinated Tool Names

Groq's `llama-3.3-70b` occasionally returned tool names like `"search_products_for_category"` instead of `"search_products"` — causing silent failures when the dispatcher couldn't find the tool.

**Fix:** Added a fuzzy name-cleaning pass before dispatch. If the returned name isn't in `valid_tool_names`, we check if any valid name is a substring of the returned name and correct it in-place.

```python
for tc in raw_tool_calls:
    raw_name = tc["function"]["name"]
    if raw_name not in valid_tool_names:
        for v in valid_tool_names:
            if v in raw_name:
                tc["function"]["name"] = v
                break
```

### 3. Razorpay Signature Verification Silently Passed Invalid Signatures

During testing, a bug in how we passed the signature dict to `verify_payment_signature()` meant it wasn't actually verifying — it just didn't raise. This meant any payment_id + fake signature would mark an order as PAID.

**Fix:** Wrapped the verification in a `try/except` that catches the Razorpay `SignatureVerificationError`, returns HTTP 400, and logs the attempt. Added an integration test that sends a tampered signature and asserts the 400.

### 4. Floating-Point Price Drift

Early version stored prices as `Float` in SQLite. A product priced at ₹999.99 came back as `999.9900000000001` and the coupon minimum-order check (`subtotal >= min_order_paise`) broke on edge cases.

**Fix:** All monetary values stored as `Integer` (paise). Conversion to rupees only happens at the API response boundary. The Policy Engine operates exclusively in paise — `subtotal_paise`, `discount_paise`, `total_paise`.

---

## Quick Start

### 1. Clone & Backend Setup

```powershell
git clone https://github.com/YOUR_USERNAME/AgentCART
cd AgentCART/backend

pip install -r requirements.txt
cp .env.example .env
# Fill in: GOOGLE_API_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

uvicorn app.main:app --reload --port 8000
```

### 2. Seed the Database

```powershell
cd backend
python reset_and_seed.py
```

This seeds ~50 products across Electronics, Computing, Audio categories + merchant policies + demo users + sample orders (for co-purchase recommendations).

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
# Open: http://localhost:5173
```

### 4. Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Customer | demo@agentcart.dev | demo1234 |
| Merchant | merchant@agentcart.dev | merchant1234 |

### 5. Demo Coupon Codes

| Code | Discount | Condition |
|------|----------|-----------|
| `WELCOME10` | 10% | Electronics / Computing |
| `SAVE200` | ₹200 off | Electronics / Computing, min ₹2000 |
| `FLASH15` | 15% | Computing only, max 12% cap |
| `PREMIUM5` | 5% | Electronics |

> All coupons are server-validated. The AI agent cannot invent or override them.

---

## Environment Variables

```env
# Backend — backend/.env

# AI
GOOGLE_API_KEY=          # Gemini Flash (primary LLM)
GROQ_API_KEY=            # Groq (fallback on 429 or alternative primary)
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=llama-3.1-8b-instant
GEMINI_MODEL=gemini-2.0-flash

# Payments
RAZORPAY_KEY_ID=         # Razorpay test-mode key
RAZORPAY_KEY_SECRET=     # Razorpay test-mode secret

# App
DATABASE_URL=sqlite+aiosqlite:///./agentcart.db   # or postgresql+asyncpg://...
SECRET_KEY=your-jwt-secret
APP_ENV=development
CORS_ORIGINS=http://localhost:5173
```

---

## API Reference

Full OpenAPI docs at `http://localhost:8000/docs` when running locally.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/products` | GET | List/search products |
| `/api/v1/cart` | GET/POST | Get or create cart |
| `/api/v1/cart/{id}/items` | POST | Add item to cart |
| `/api/v1/agent/conversation` | POST | Start AI conversation |
| `/api/v1/agent/chat` | POST | Send message to agent |
| `/api/v1/checkout/validate` | POST | Policy Engine gate |
| `/api/v1/checkout/order?confirmed=true` | POST | Create order |
| `/api/v1/checkout/payment/{order_id}` | POST | Init Razorpay order |
| `/api/v1/checkout/verify` | POST | Verify payment signature |
| `/api/v1/merchants/{store_id}/analytics` | GET | Revenue analytics |
| `/api/v1/merchants/{store_id}/orders` | GET | Order management |

---

## Project Structure

```
AgentCART/
├── backend/
│   └── app/
│       ├── agent/
│       │   ├── agent_service.py   # Multi-turn Gemini + Groq loop
│       │   └── tools.py           # 14 tool implementations + registry
│       ├── api/v1/
│       │   ├── agent.py           # /agent/chat endpoint
│       │   ├── checkout.py        # Full checkout + Razorpay flow
│       │   ├── products.py        # Catalogue endpoints
│       │   ├── cart.py            # Cart CRUD
│       │   ├── auth.py            # JWT auth
│       │   ├── users.py           # User & address management
│       │   └── merchants.py       # Merchant dashboard API
│       ├── policy/
│       │   └── policy_engine.py   # Server-side guardrails
│       ├── models/models.py       # SQLAlchemy ORM (12 tables)
│       ├── services/              # Business logic layer
│       └── main.py                # FastAPI app entry point
├── frontend/
│   └── src/
│       ├── pages/                 # Catalogue, Checkout, Dashboard, Orders...
│       ├── components/            # Agent chat, Cart, Product cards, Auth...
│       ├── store/                 # Zustand state (cart, auth, agent)
│       └── services/              # Axios API clients
├── ARCHITECTURE.md                # System diagrams & request flows
└── README.md                      # This file
```

---

## Design System

AgentCART uses the **Storefront + Ledger** design language:

- **Colors:** Paper (`#FAF8F4`) / Ink (`#1B2430`) / Signal green (`#3F6E5B`) / Flag orange (`#C4622D`)
- **Typography:** Inter (UI) + JetBrains Mono (prices, order numbers, IDs)
- **Borders:** Hairline (`#D9D3C7`) — no box shadows, no border-radius
- **Principle:** Everything visible is data-verified. No UI element should display a price the server hasn't confirmed.

---

## Build Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Complete | Foundation & Project Scaffolding |
| 2 | ✅ Complete | Product Catalogue API & UI |
| 3 | ✅ Complete | Authoritative Cart Engine |
| 4 | ✅ Complete | Conversational AI Agent (14 tools, dual-LLM) |
| 5 | ✅ Complete | Policy Engine & Checkout Gate |
| 6 | ✅ Complete | Razorpay Test Mode Integration |
| 7 | ✅ Complete | Reliability — Groq fallback, error handling, audit trail |
| 8 | ✅ Complete | Merchant Dashboard & AI Analytics |
| 9 | ✅ Complete | Documentation & Architecture Diagrams |
