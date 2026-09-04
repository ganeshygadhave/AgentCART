# AgentCART — 5-Minute Pitch Video Script

## Structure (5 minutes total)

---

### [00:00 – 00:30] Hook — The Problem With AI Shopping (30 sec)

**Show on screen:** A generic AI chatbot saying "Here's a 20% discount just for you!"

**Say:**
> "Every AI shopping demo has the same flaw. The LLM quotes prices it made up. It applies discounts the merchant never approved. It places orders without the user confirming. This happens because the agent is trusted with money it shouldn't control.
>
> AgentCART is built on one idea: the LLM is the salesperson, not the cashier. Every money action is bounded, server-side, and logged. Let me show you."

---

### [00:30 – 01:30] Demo — Conversational Shopping (60 sec)

**Show on screen:** Browser at `localhost:5173`, logged in as demo customer

**Do:**
1. Type: *"I'm looking for wireless headphones under ₹5000"*
2. Show agent calling `search_products` — product cards render from DB data (not LLM text)
3. Type: *"Add the Sony ones to my cart"*
4. Show cart updating, agent shows related products automatically
5. Show the `tool_calls` in the network response briefly — "this is the audit trail"

**Say:**
> "The agent never invents product data. It calls `search_products` against our database, and the UI renders the results directly from the tool response — not from whatever the LLM wrote in prose."

---

### [01:30 – 02:30] Demo — Policy Engine in Action (60 sec)

**Show on screen:** Chat with coupon validation

**Do:**
1. Type: *"Apply coupon SAVE200"*
2. Show agent calling `calculate_total` — coupon validated server-side
3. Show the response: discount is ₹200 (correct), not whatever the LLM guessed
4. Now try: Type something like *"Can you give me a 50% discount?"*
5. Show agent refusing — "I can only apply valid merchant coupons via `calculate_total`"
6. Show checkout validation: inventory check, authoritative total computation

**Say:**
> "The Policy Engine is deterministic Python code — not a prompt instruction. Even if the user asks for 50%, the server caps all discounts at 12%. The LLM cannot override this regardless of what it's told."

---

### [02:30 – 03:30] Demo — Full Razorpay Payment Flow (60 sec)

**Show on screen:** Checkout flow

**Do:**
1. Click checkout, show the confirmation gate — order rejected without `confirmed=true`
2. User confirms, order created with server-authoritative total
3. Razorpay modal opens (test mode — use card: `4111 1111 1111 1111`)
4. Payment succeeds, order status updates to PAID
5. Show the payment record in the DB briefly (razorpay_order_id, signature stored)

**Say:**
> "This is the full Razorpay test-mode flow. Order creation, Razorpay order init, the payment modal, and HMAC signature verification — all on the server before the order is marked paid. A fake signature returns HTTP 400."

---

### [03:30 – 04:15] Merchant Dashboard (45 sec)

**Show on screen:** Log in as merchant

**Do:**
1. Show revenue analytics — total orders, GMV, recent order list
2. Type in merchant chat: *"Show me low stock items"*
3. Show AI returning structured stock data, merchant can update order status via chat
4. Show AI agent analytics — conversation conversion rate, top searched queries

**Say:**
> "The same agent serves both sides. In merchant mode, different tools unlock — store analytics, low-stock alerts, order fulfillment by chat. The tool access is gated server-side by mode, not by prompt instruction."

---

### [04:15 – 05:00] Architecture & What Broke (45 sec)

**Show on screen:** ARCHITECTURE.md diagram (or a clean screenshot)

**Say:**
> "Three things broke at 2 AM that made the project better.
>
> First — Groq rate limits. The agent loop makes 5 LLM calls per message. On the free tier, the second call hits 429. We added a primary/fallback model cascade — same tools, smaller model. The agent never silently fails.
>
> Second — the LLM hallucinated tool names. `search_products_for_category` instead of `search_products`. We added a fuzzy cleanup pass in the dispatcher. If no exact match, check substrings.
>
> Third — Razorpay signature verification wasn't actually verifying. A bug in how we built the dict meant it never raised. We caught it in testing with a tampered signature, fixed it, added a test.
>
> The repo is at [GitHub URL]. It runs. Thank you."

---

## Screen Recording Tips

- Resolution: 1920×1080, record at 30fps
- Use OBS or Loom (unlisted is fine per Razorpay's form)
- Zoom browser to 110-125% so text is readable
- Use the seeded demo data — it has realistic products and order history
- Keep a terminal split-screen to show uvicorn logs during agent tool calls
- Upload to YouTube as Unlisted and submit the URL

## Key Things to Show

- [ ] Agent calling a tool (visible in network tab or terminal)
- [ ] A coupon being validated — show the correct server-computed discount
- [ ] The Razorpay modal loading and completing
- [ ] An error handled gracefully (invalid coupon, or stock out)
- [ ] The audit trail (tool_calls JSON in one API response)
