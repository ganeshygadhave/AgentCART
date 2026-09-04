# AgentCART — System Architecture

## High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (React + Vite)                         │
│                                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ Catalogue │  │  AI Chat     │  │  Checkout   │  │ Merchant       │  │
│  │ & Search  │  │  Sidebar     │  │  Flow       │  │ Dashboard      │  │
│  └────┬──────┘  └──────┬───────┘  └──────┬──────┘  └───────┬────────┘  │
└───────┼────────────────┼─────────────────┼─────────────────┼────────────┘
        │                │  Axios / REST   │                 │
        ▼                ▼                 ▼                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend  (Python 3.11, async)                  │
│                                                                           │
│  ┌─────────────┐  ┌────────────────────┐  ┌──────────────────────────┐  │
│  │ Products    │  │  Agent Router      │  │  Checkout Router         │  │
│  │ /api/v1/    │  │  POST /agent/chat  │  │  POST /checkout/validate │  │
│  │ products    │  │                    │  │  POST /checkout/order    │  │
│  └─────────────┘  └─────────┬──────────┘  │  POST /checkout/payment │  │
│                              │             │  POST /checkout/verify  │  │
│                              ▼             └──────────┬───────────────┘  │
│                   ┌──────────────────────┐            │                  │
│                   │   AgentService       │            ▼                  │
│                   │                      │  ┌──────────────────────┐    │
│                   │  ┌────────────────┐  │  │   PolicyEngine       │    │
│                   │  │  Gemini Flash  │  │  │                      │    │
│                   │  │  (google-genai)│  │  │  validate_inventory  │    │
│                   │  │  + Groq 70B    │  │  │  validate_discount   │    │
│                   │  │  (fallback)    │  │  │  calculate_total     │    │
│                   │  └───────┬────────┘  │  │  validate_confirm    │    │
│                   │          │ tool calls│  │  increment_coupon    │    │
│                   │  ┌───────▼────────┐  │  └──────────┬───────────┘    │
│                   │  │  Tool Dispatch │  │             │                 │
│                   │  │  14 tools:     │  │             ▼                 │
│                   │  │  search_prod   │  │  ┌──────────────────────┐    │
│                   │  │  add_to_cart   │  │  │  razorpay.Client     │    │
│                   │  │  get_cart      │  │  │  (Python SDK)        │    │
│                   │  │  calculate_ttl │  │  │                      │    │
│                   │  │  get_addresses │  │  │  order.create()      │    │
│                   │  │  get_orders    │  │  │  verify_payment_sig()│    │
│                   │  │  + 8 more...   │  │  └──────────┬───────────┘    │
│                   │  └───────┬────────┘  │             │                 │
│                   └──────────┼───────────┘             │                 │
│                              │                          │                 │
└──────────────────────────────┼──────────────────────────┼─────────────────┘
                               │   SQLAlchemy (async)      │
                               ▼                           ▼
              ┌────────────────────────────────────────────────┐
              │              SQLite / PostgreSQL               │
              │                                               │
              │  users  products  carts  cart_items            │
              │  orders  order_items  payments  audit_logs     │
              │  conversations  messages  stores               │
              │  merchant_policies  addresses                  │
              └────────────────────────────────────────────────┘
                                    ▲
                                    │ Razorpay Webhook (HMAC verified)
                               ┌────┴──────┐
                               │  Razorpay │
                               │ Test Mode │
                               └───────────┘
```

---

## Request Flow: Conversational Checkout

```
User types: "Add the Sony headphones to my cart and checkout"
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Turn 1 — Agent calls: search_products(query="Sony headphones") │
│  → Backend queries DB, returns 6 products with real prices      │
│  → Agent sees product IDs and prices (never fabricated)         │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Turn 2 — Agent calls: add_to_cart(product_id="...", qty=1)     │
│  → CartService locks price in paise at time of add              │
│  → get_related_products() called automatically                  │
│  → Cart mutation logged to audit trail                          │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Turn 3 — Agent calls: get_user_addresses(user_id="...")        │
│  → Returns saved addresses, lets user pick                      │
│  → Agent WAITS for explicit user confirmation                   │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Checkout Gate — POST /checkout/validate                        │
│  → PolicyEngine.validate_inventory()  (stock check)            │
│  → PolicyEngine.calculate_authoritative_total() (server price) │
│  → Returns totals — frontend CANNOT override these             │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Order Creation — POST /checkout/order?confirmed=true           │
│  → confirmed=false → HTTP 422, order rejected                   │
│  → Policy re-validates inventory + recomputes totals            │
│  → Order created with server-authoritative amounts              │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Razorpay Integration — POST /checkout/payment/{order_id}       │
│  → razorpay.order.create(amount=total_paise, currency="INR")    │
│  → Returns razorpay_order_id + key_id to frontend              │
│  → Frontend opens Razorpay checkout modal                       │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Signature Verification — POST /checkout/verify                 │
│  → razorpay.utility.verify_payment_signature()                  │
│  → HMAC-SHA256 check: razorpay_order_id + "|" + payment_id     │
│  → Order status → PAID, cart deactivated, coupon incremented   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Policy Engine: What the LLM Cannot Do

The `PolicyEngine` is the trust boundary. It runs **server-side only**.

| Policy | What It Prevents | How |
|--------|-----------------|-----|
| Price Authority | LLM quoting wrong prices | All totals computed from DB `price_paise` |
| Discount Cap | LLM over-applying discounts | Hard 12% cap, DB-validated codes only |
| Inventory Gate | LLM promising out-of-stock items | Stock check at validate + order create |
| Confirmation Gate | LLM placing orders without consent | `confirmed=true` query param required |
| Coupon Rate Limit | Unlimited code reuse | `current_uses >= max_uses` check |
| Coupon Window | Expired code usage | `valid_from` / `valid_until` timestamps |

---

## Database Schema

```
users ──────────────────────┐
  │                          │
  ├── carts ─── cart_items   │
  │      │         │         │
  │      │      products     │
  │      │         │         │
  │      └── conversations   │
  │               │          │
  │           messages       │
  │         (tool_calls JSON)│
  │                          │
  ├── orders ─── order_items │
  │      │                   │
  │   payments               │
  │   (razorpay_ids)         │
  │                          │
  ├── addresses               │
  │                          │
  └── owned_stores ──────────┘
           │
        products
        merchant_policies
        store_agent_config
        audit_logs
```

---

## AI Agent Guardrail Design

The agent runs in a **multi-turn tool-calling loop** (max 5 turns):

```python
# Simplified flow
while turn < 5:
    response = gemini.generate(contents, tools=TOOL_DEFINITIONS)
    
    if response has function_calls:
        for each call:
            result = dispatch_tool(db, tool_name, args, cart_id)
            # dispatch_tool enforces mode-based access control:
            # merchant tools only callable in mode="merchant"
        add tool results to contents
    else:
        # Final text response — break
        break
```

Key guardrails enforced in system prompt:
1. **Never call add_to_cart without explicit user intent**
2. **Never compute totals — always call calculate_total**
3. **Always call search_products before mentioning any product**
4. **Never initiate payment — wait for explicit checkout intent**
5. **Always get_user_addresses before proceeding to payment**

---

## Tech Stack Summary

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite + Zustand | Fast SPA, minimal state boilerplate |
| Styling | Vanilla CSS (Paper & Ink design system) | Zero-dependency, full control |
| Backend | FastAPI + async SQLAlchemy | High-throughput async I/O for agent loops |
| AI | Gemini Flash → Groq 70B fallback | Rate-limit resilient, cost-effective |
| Payments | Razorpay Python SDK (test mode) | Direct integration, HMAC-verified |
| Database | SQLite (dev) / PostgreSQL (prod) | Simple dev, production-grade switch |
| Auth | JWT (HS256) + bcrypt | Stateless, standard |
