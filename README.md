# AgentCART — AI Growth & Agentic Commerce

> **Track 01 · Razorpay Agentic Hackathon**  
> Build an agent that grows revenue for a merchant and makes them transactable by an AI buyer, end to end.

---

## Live Demo

| | URL |
|---|---|
| 🌐 **Frontend** | [agent-cart-ten.vercel.app](https://agent-cart-ten.vercel.app/) |
| ⚙️ **Backend API** | [agentcart-1-4kxs.onrender.com/docs](https://agentcart-1-4kxs.onrender.com/docs) |
| 📂 **GitHub** | [github.com/ganeshygadhave/AgentCART](https://github.com/ganeshygadhave/AgentCART) |

> ⚠️ Backend is on Render free tier — first load may take **~30 seconds** to wake up.

### Test Accounts

| Role | Email | Password |
|---|---|---|
| Customer | `demo@agentcart.dev` | `demo1234` |
| Merchant | `merchant@agentcart.dev` | `merchant1234` |

### Test Payment Card (Razorpay Test Mode)
```
Card Number: 4111 1111 1111 1111
Expiry: Any future date    CVV: Any 3 digits
```

### Test Coupons
| Code | Discount |
|---|---|
| `WELCOME10` | 10% off Electronics |
| `SAVE200` | ₹200 off (min ₹2000 order) |
| `FLASH15` | 15% off — server caps at 12% (shows the guardrail) |

---

## What It Solves

Most AI shopping demos trust the LLM with money. The agent quotes prices it invented. It applies discounts the merchant never approved. It places orders without confirmation.

AgentCART is built on one rule: **the LLM is the salesperson, not the cashier.**

- The agent can search, recommend, and negotiate — but **cannot compute prices**
- Every money action goes through a server-side **PolicyEngine** before it executes
- Every tool call is logged to an **audit trail** — explainable after the fact
- Payment is gated by **HMAC signature verification** before any order is marked paid

---

## The Bar — Every Money Action Is Bounded, Gated, Auditable

### 1. Bounded
```python
# PolicyEngine.py — hard caps in Python, not in the prompt
discount_percent = min(coupon.discount_value, 12.0)      # never > 12%
raw_discount     = min(raw_discount, subtotal_paise * 0.12)  # enforced again
```
Even if the LLM tells the user they get 50% off — the server computes 12% and that is what they pay.

### 2. Gated
The checkout endpoint physically refuses to create an order without `?confirmed=true`. No code path can accidentally place an order on behalf of a user:
```python
confirmation_error = PolicyEngine.validate_confirmation(confirmed)
if confirmation_error:
    raise HTTPException(status_code=422, detail=confirmation_error)
```

### 3. Auditable
Every agent tool call — product searches, price calculations, coupon validations — is stored in the `messages.tool_calls` JSON column. The judge can see the exact sequence:

```
user says → "add headphones and apply WELCOME10"
agent calls → search_products({query: "headphones"})
agent calls → add_to_cart({product_id: "...", qty: 1})
agent calls → calculate_total({coupon_code: "WELCOME10"})
server returns → {subtotal: 4999, discount: 499, total: 4500}  ← authoritative
```
The agent never quotes a price it computed itself.

---

## What Broke at 2 AM — And How We Got Out

### 1. Groq Rate Limits Killed the Multi-Turn Loop
The agent makes up to 5 LLM calls per user message. At demo load, Groq's free tier returned `429` on the 2nd turn — the agent searched products, then silently failed on add-to-cart.

**Fix:** Primary/fallback model cascade. On `429` → retry with `llama-3.1-8b-instant` (smaller, within limits). On `400` (tool schema error) → retry without tools, agent gives a degraded text response. The agent **never silently fails**.
```python
response = await call_groq(http_client, primary_model, messages)
if response.status_code == 429:
    response = await call_groq(http_client, fallback_model, messages)
if response.status_code == 400:
    response = await call_groq(http_client, primary_model, messages, with_tools=False)
```

### 2. LLM Hallucinated Tool Names
Groq's `llama-3.3-70b` occasionally returned `"search_products_for_category"` instead of `"search_products"` — the dispatcher couldn't find the tool and silently skipped it.

**Fix:** Fuzzy name-cleaning pass before dispatch. If the returned name isn't in `valid_tool_names`, check if any valid name is a substring of the returned name and correct in-place.

### 3. Razorpay Signature Verification Wasn't Verifying
A bug in how we built the dict passed to `verify_payment_signature()` meant it never actually raised — any fake `payment_id` + fake signature would mark an order as PAID.

**Fix:** Wrapped in `try/except SignatureVerificationError`, returns HTTP 400, logs the tampered attempt. Added an integration test: send a modified signature → assert 400.

---

## Architecture

```
Browser (React + Vite)
    │  REST / Axios
    ▼
FastAPI Backend
    ├── AgentService ──→ Gemini Flash (primary) / Groq 70B (alternative)
    │       └── 14 Tools: search, cart, orders, coupons, analytics...
    ├── PolicyEngine ──→ Authoritative price, discount cap, inventory gate
    └── Razorpay SDK ──→ order.create → verify_payment_signature (HMAC)
    │
    ▼ SQLAlchemy async
SQLite (all monetary values stored as Integer paise — no float drift)
```

**Key design choices:**
- All money stored as **Integer paise** — no IEEE 754 float drift
- `unit_price_paise` **snapshot at add-to-cart time** — price changes can't affect in-flight orders
- Agent tool access **gated by mode** — a customer cannot call merchant tools even with a crafted request

---

## Run Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # add GOOGLE_API_KEY, GROQ_API_KEY, RAZORPAY keys
python reset_and_seed.py
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Zustand |
| Backend | FastAPI (async) + SQLAlchemy 2.0 |
| AI | Gemini 2.0 Flash + Groq LLaMA 3.3 70B (fallback) |
| Payments | Razorpay Test Mode — full order → verify flow |
| Database | SQLite (dev) — Integer paise, no floats |
| Deployed | Render (backend) + Vercel (frontend) |
