# AgentCART — Design Decisions

## The Core Problem We Solved

AI shopping demos fail in one predictable way: they trust the LLM with money.

The LLM quotes a price it fabricated. It applies a 30% discount because the user asked nicely. It adds items to cart proactively. It processes payment before the user confirmed. These aren't hypotheticals — they're the default behavior of a naive agent connected to a shopping API.

AgentCART's architecture is built around one principle: **the LLM is an untrusted orchestrator, not a trusted authority**.

---

## Design Decision 1: Server-Side Policy Engine (Not Prompt Engineering)

**What we rejected:** Instructing the LLM to "never give discounts above 10%."

Prompt instructions are soft constraints. A sufficiently crafty user prompt can override them. A model update can change behavior. A different LLM provider has different behavior.

**What we built:** A `PolicyEngine` class that runs deterministically on the server, after the agent's tool call, before any response goes to the user.

```python
# The agent calls calculate_total — it cannot compute this itself
result = await PolicyEngine.calculate_authoritative_total(db, cart, coupon_code)

# Hard caps enforced in Python, not in the prompt
discount_percent = min(policy.discount_value, 12.0)  # never > 12%
raw_discount = min(raw_discount, int(subtotal_paise * 0.12))  # enforced again
```

The agent can *suggest* a coupon is valid, but the actual discount is computed by `PolicyEngine`. Even if the LLM returns `{"discount": 50}` in a tool response, the checkout endpoint recomputes everything from scratch.

---

## Design Decision 2: Integer Paise Storage, Not Float Rupees

**The bug we avoided:** `₹999.99 × 2 = ₹1999.9800000000002`

SQLite's `REAL` and Python's `float` both use IEEE 754 binary floating point. Monetary comparisons break silently. A minimum-order check of `subtotal >= 50000` (paise) fails when the computed total is `49999.999999997` due to float drift.

**Our rule:** All monetary values are stored and computed as `Integer` (paise). Conversion to rupees (`/ 100`) happens only at the API response serialization boundary, and only for display. The Policy Engine, Razorpay order creation, and all comparison logic operate exclusively on integers.

---

## Design Decision 3: Price Snapshot at Add-to-Cart Time

When a user adds a product to cart, we store `unit_price_paise` on the `CartItem` row — not the `Product.price_paise`. This is a deliberate snapshot.

**Why:** If a merchant updates a product price between add-to-cart and checkout, the user should pay the price they saw when they added it. This is standard e-commerce behavior (Flipkart, Amazon both do this).

**Tradeoff:** The cart total can diverge from the current product price. We show both in the checkout validation response so the UI can flag this if needed.

---

## Design Decision 4: Dual-LLM with Automatic Fallback

We chose Groq as the primary LLM (lower latency, higher free-tier throughput) with Gemini Flash as the production alternative. But the agent loop makes up to 5 LLM calls per user message — rate limits are a real operational concern.

**The cascade:**
1. Call primary model (`llama-3.3-70b-versatile`)
2. On `429` → retry with fallback (`llama-3.1-8b-instant`) — same tools, lower quality acceptable
3. On `400` (tool schema error) → retry without tools, agent gives a text-only response

This means the agent **never silently fails**. Worst case, the user gets "I couldn't search products right now" instead of a blank screen.

---

## Design Decision 5: Explicit Confirmation Gate

The checkout endpoint accepts `?confirmed=true` as a query parameter. Without it, the order is rejected with a `422`.

This isn't just about UX — it's a technical guarantee that no code path can accidentally place an order. The agent cannot call `POST /checkout/order` on behalf of the user unless the frontend explicitly adds `confirmed=true`, which only happens after the user clicks a confirmation button.

```python
confirmation_error = PolicyEngine.validate_confirmation(confirmed)
if confirmation_error:
    raise HTTPException(status_code=422, detail=confirmation_error)
```

The agent's system prompt also enforces this: *"Never initiate payment immediately — wait for explicit checkout/pay intent from user."* But the HTTP gate is the real enforcement — the prompt is just good UX.

---

## Design Decision 6: Audit Trail in the Messages Table

We didn't build a separate audit log table for agent actions (we have `AuditLog` for system events, but agent tool calls have a simpler home).

Every `Message` row has a `tool_calls` JSON column. When the agent makes tool calls in a turn, the full dispatch record — tool name, arguments, result — is saved alongside the message. This means:

1. Every product search that preceded an add-to-cart is traceable
2. Every price quote the agent gave is verifiable against the tool result
3. Every coupon validation attempt is logged, whether it succeeded or failed

This is the "explainable AI money action" that Razorpay's bar describes.

---

## Design Decision 7: Mode-Based Tool Access Control

The same agent endpoint serves both customers and merchants. The `mode` parameter controls which tools are accessible.

```python
# Merchant-only tools are blocked in customer mode
elif tool_name == "get_store_analytics":
    if mode != "merchant":
        return {"error": "Access denied."}, False
```

A customer cannot call `update_order_status` even if they craft a request with the right tool name, because `dispatch_tool` checks the mode before executing. This is defense-in-depth — the system prompt also tells the agent not to use merchant tools in customer mode, but the server enforces it regardless.

---

## Design Decision 8: The UI Knows What the Agent Said

When the agent calls `search_products`, the tool result includes product IDs and image URLs. The frontend doesn't just show the agent's text response — it parses the `tool_calls` array from the API response and renders interactive product cards inline in the chat.

**Why this matters:** The agent's text response is brief ("Here are some options:"). The real information is in the structured tool result. By rendering product cards from the tool result data, the UI always shows accurate, DB-sourced product details — not whatever the LLM happened to write in prose.

---

## What We Would Build Next

1. **Razorpay Webhook Handler** — Currently payment verification is client-initiated. A production system needs the Razorpay webhook (`payment.captured`) to update order status server-side, even if the client disconnects after payment.

2. **Multi-store Embedding** — The `Store` model + `StoreAgentConfig` are already in the schema. The next step is a JavaScript embed snippet (`<script src="agentcart.js" data-store="your-store-slug" />`) that any merchant can add to their site.

3. **Streaming Responses** — The agent currently waits for the full multi-turn loop before returning. Streaming tool-call results as SSE would make the chat feel significantly more responsive.

4. **Razorpay Subscriptions / EMI** — The checkout flow handles one-time payments. Razorpay's subscription API and EMI offerings are natural extensions for high-value cart items.
