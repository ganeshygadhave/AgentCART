import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import useAgentStore from '../../store/agentStore'
import useCartStore from '../../store/cartStore'
import { cartApi, checkoutApi } from '../../services/api'
import { formatPrice } from '../../utils/helpers'
import './AgentChat.css'

const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve()
  const script = document.createElement('script')
  script.src = 'https://checkout.razorpay.com/v1/checkout.js'
  script.onload = resolve
  script.onerror = () => reject(new Error('Could not load Razorpay Checkout.'))
  document.body.appendChild(script)
})

function renderInlineMarkdown(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function FormattedMessage({ content }) {
  const blocks = []
  let paragraph = []
  let list = []

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ').trim() })
      paragraph = []
    }
  }

  const flushList = () => {
    if (list.length) {
      blocks.push({ type: 'list', items: list })
      list = []
    }
  }

  content.split(/\r?\n/).forEach((line) => {
    let cleanLine = line.trim()
    // Skip raw markdown table header lines or separator lines
    if (
      /^\s*\|?\s*#?\s*\|?\s*Product\s*\|/i.test(cleanLine) ||
      /^\s*\|?\s*[-|:\s]+\|?\s*$/.test(cleanLine) ||
      /^\s*\|?\s*#\s*\|\s*Product/i.test(cleanLine)
    ) {
      return
    }

    // If line has pipe table formatting, transform pipes into clean readable text
    if (cleanLine.includes('|')) {
      const parts = cleanLine.split('|').map(p => p.trim()).filter(Boolean)
      if (parts.length >= 2 && !isNaN(parts[0])) {
        cleanLine = `${parts[0]}. **${parts[1]}** ${parts.slice(2).join(' · ')}`
      } else if (parts.length >= 2) {
        cleanLine = parts.join(' · ')
      }
    }

    const bullet = cleanLine.match(/^(?:\*|-|•|\d+\.)\s+(.*)$/)
    if (bullet) {
      flushParagraph()
      list.push(bullet[1].trim())
    } else if (!cleanLine) {
      flushParagraph()
      flushList()
    } else if (list.length) {
      list[list.length - 1] += ` ${cleanLine}`
    } else {
      paragraph.push(cleanLine)
    }
  })

  flushParagraph()
  flushList()

  return (
    <div className="agent-message__formatted">
      {blocks.map((block, index) => (
        block.type === 'list'
          ? <ul key={index}>{block.items.map((item) => <li key={item}>{renderInlineMarkdown(item)}</li>)}</ul>
          : <p key={index}>{renderInlineMarkdown(block.text)}</p>
      ))}
    </div>
  )
}

// ── Friendly labels for tool names ──────────────────────────────────────────
const TOOL_LABELS = {
  search_products:    { icon: '🔍', label: 'search_products' },
  get_product_details:{ icon: '📄', label: 'get_product_details' },
  get_related_products:{ icon: '🔗', label: 'get_related_products' },
  add_to_cart:        { icon: '🛒', label: 'add_to_cart' },
  remove_from_cart:   { icon: '🗑️', label: 'remove_from_cart' },
  get_cart:           { icon: '🛍️', label: 'get_cart' },
  calculate_total:    { icon: '🧮', label: 'calculate_total' },
  get_user_addresses: { icon: '📍', label: 'get_user_addresses' },
  add_user_address:   { icon: '📍', label: 'add_user_address' },
  get_user_orders:    { icon: '📦', label: 'get_user_orders' },
  get_store_analytics:{ icon: '📊', label: 'get_store_analytics' },
  get_low_stock:      { icon: '⚠️', label: 'get_low_stock' },
  update_order_status:{ icon: '🚚', label: 'update_order_status' },
}

function formatArgs(args) {
  if (!args || !Object.keys(args).length) return ''
  return Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: "${String(v).slice(0, 40)}${String(v).length > 40 ? '…' : ''}"`)
    .join(', ')
}

function ToolCallBadges({ toolCalls }) {
  const [expanded, setExpanded] = useState({})
  if (!toolCalls || !toolCalls.length) return null

  // Filter out noisy internal-only calls that don't add judge value
  const visible = toolCalls.filter(tc => tc.tool_name !== 'get_cart')
  if (!visible.length) return null

  return (
    <div className="agent-tool-log">
      {visible.map((tc, idx) => {
        const meta = TOOL_LABELS[tc.tool_name] || { icon: '⚡', label: tc.tool_name }
        const args = formatArgs(tc.arguments)
        const isOpen = !!expanded[idx]
        return (
          <div key={idx} className="agent-tool-badge">
            <button
              className="agent-tool-badge__pill"
              onClick={() => setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }))}
              title="Toggle tool call details"
            >
              <span className="agent-tool-badge__icon">⚡</span>
              <span className="agent-tool-badge__name">{meta.icon} {meta.label}</span>
              {args && <span className="agent-tool-badge__args">({args})</span>}
              <span className="agent-tool-badge__chevron">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="agent-tool-badge__detail">
                <div className="agent-tool-badge__detail-row">
                  <span className="agent-tool-badge__detail-label">Tool</span>
                  <code className="agent-tool-badge__detail-value">{tc.tool_name}</code>
                </div>
                {tc.arguments && Object.keys(tc.arguments).length > 0 && (
                  <div className="agent-tool-badge__detail-row">
                    <span className="agent-tool-badge__detail-label">Args</span>
                    <code className="agent-tool-badge__detail-value">
                      {JSON.stringify(tc.arguments, null, 0)}
                    </code>
                  </div>
                )}
                {tc.result?.count !== undefined && (
                  <div className="agent-tool-badge__detail-row">
                    <span className="agent-tool-badge__detail-label">Result</span>
                    <code className="agent-tool-badge__detail-value">{tc.result.count} items returned</code>
                  </div>
                )}
                {tc.result?.success !== undefined && (
                  <div className="agent-tool-badge__detail-row">
                    <span className="agent-tool-badge__detail-label">Status</span>
                    <code className="agent-tool-badge__detail-value" style={{ color: tc.result.success ? '#16a34a' : '#dc2626' }}>
                      {tc.result.success ? '✓ success' : '✗ failed'}
                    </code>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ProductCards({ toolCalls, onAdd }) {
  const [addedIds, setAddedIds] = useState({})
  const products = Array.from(new Map((toolCalls || [])
    .filter((call) => call.tool_name === 'search_products')
    .flatMap((call) => call.result?.products || [])
    .map((product) => [product.id, product])).values())

  if (!products.length) return null

  const handleAdd = async (product) => {
    setAddedIds(prev => ({ ...prev, [product.id]: 'loading' }))
    await onAdd(product)
    setAddedIds(prev => ({ ...prev, [product.id]: 'added' }))
  }

  return (
    <div className="agent-product-cards">
      {products.map((product) => {
        const state = addedIds[product.id]
        return (
          <div className="agent-product-card" key={product.id}>
            {product.image_url && <img src={product.image_url} alt="" className="agent-product-card__image" />}
            <div className="agent-product-card__details">
              <Link
                to={`/product/${product.id}`}
                className="agent-product-card__name-link"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <strong>{product.name}</strong>
              </Link>
              <span className="truth-sm">{formatPrice(product.price_paise)}</span>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <Link
                  to={`/product/${product.id}`}
                  className="btn btn-sm btn-ghost"
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                >
                  View
                </Link>
                <button
                  className={`btn btn-sm ${state === 'added' ? 'btn-signal' : 'btn-ghost'}`}
                  onClick={() => !state && handleAdd(product)}
                  disabled={!!state}
                >
                  {state === 'loading' ? 'Adding…' : state === 'added' ? '✓ Added' : 'Add to cart'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AgentChat() {
  const { isOpen, messages, isTyping, sendMessage, closeChat, initConversation, contextProduct, addAssistantMessage, addUserMessage } = useAgentStore()
  const { cartId, items, total, appliedCoupon, refreshCart, clearCart, addItem, applyCoupon } = useCartStore()
  const [input, setInput] = useState('')
  const [showPaymentSummary, setShowPaymentSummary] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [awaitingPaymentConfirmation, setAwaitingPaymentConfirmation] = useState(false)
  const [showAddOnPanel, setShowAddOnPanel] = useState(false)
  const [hasCompletedAddOnStage, setHasCompletedAddOnStage] = useState(false)
  const [addOnProducts, setAddOnProducts] = useState([])
  const [addedAddOnIds, setAddedAddOnIds] = useState({})
  const [discounts, setDiscounts] = useState([])
  const [showDiscountPrompt, setShowDiscountPrompt] = useState(false)
  const [showRetryPrompt, setShowRetryPrompt] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  // Address selection state
  const [showAddressStep, setShowAddressStep] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState([])
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)
  const [newAddress, setNewAddress] = useState({ label: 'Home', full_name: '', phone: '', street_address: '', landmark: '', city: '', state: '', pincode: '' })
  const [savingAddress, setSavingAddress] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)


  useEffect(() => {
    if (isOpen) {
      initConversation(cartId)
      inputRef.current?.focus()
    }
  }, [isOpen, cartId, initConversation])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isTyping) return
    setInput('')
    const checkoutIntent = /\b(proceed|checkout|pay|payment|confirm)\b/i.test(text)

    if (showDiscountPrompt && checkoutIntent) {
      addUserMessage(text)
      handleSkipDiscount()
      return
    }

    if (awaitingPaymentConfirmation && checkoutIntent) {
      addUserMessage(text)
      setShowPaymentSummary(true)
      setAwaitingPaymentConfirmation(false)
      return
    }

    if (showAddOnPanel && checkoutIntent) {
      addUserMessage(text)
      await handleConfirmAddOns()
      return
    }

    if (items.length > 0 && checkoutIntent && !showPaymentSummary) {
      addUserMessage(text)
      await handleConfirmAddOns()
      return
    }

    if (showRetryPrompt) {
      addUserMessage(text)
      if (/^(yes|retry|sure|okay|ok)/i.test(text)) {
        await handleRetryPayment()
      } else {
        handleCancelRetry()
      }
      return
    }

    if (showDiscountPrompt && /^(yes|apply|okay|ok)/i.test(text)) {
      addUserMessage(text)
      await handleApplyDiscount(discounts[0].code)
      return
    }
    if (awaitingPaymentConfirmation && /^(yes|confirm|proceed|pay|checkout|okay|ok)/i.test(text)) {
      addUserMessage(text)
      setShowPaymentSummary(true)
      setAwaitingPaymentConfirmation(false)
      return
    }
    const result = await sendMessage(text, cartId)
    if (result?.cartUpdated) {
      await refreshCart()
      const explicitlyRequestedAdd = /\b(add|buy|purchase|put)\b/i.test(text)
      if (!explicitlyRequestedAdd || hasCompletedAddOnStage || showAddOnPanel) return
      const addedToCart = result.toolCalls.some((call) => call.tool_name === 'add_to_cart' && call.result?.success)
      if (!addedToCart) return
      const related = result.toolCalls
        .filter((call) => call.tool_name === 'get_related_products' || call.tool_name === 'add_to_cart')
        .flatMap((call) => call.tool_name === 'add_to_cart'
          ? call.result?.related_products?.products || []
          : call.result?.products || [])
      setAddOnProducts(Array.from(new Map(related.map((product) => [product.id, product])).values()))
      setShowAddOnPanel(true)
      setAwaitingPaymentConfirmation(false)
    }
  }

  const handleConfirmAddOns = async () => {
    setShowAddOnPanel(false)
    setHasCompletedAddOnStage(true)
    const result = await cartApi.availableDiscounts(cartId)
    const available = result.data.discounts || []
    setDiscounts(available)
    if (available.length) {
      setShowDiscountPrompt(true)
      addAssistantMessage(`I found ${available.length === 1 ? 'an available discount' : 'available discounts'} for your order. Would you like to apply ${available.map((discount) => `**${discount.code}**`).join(' or ')}?`)
    } else {
      // Show address selection before payment
      await handleShowAddressStep()
    }
  }

  const handleShowAddressStep = async () => {
    try {
      const res = await import('../../services/api').then(m => m.usersApi.getAddresses())
      setSavedAddresses(res.data.addresses || [])
    } catch {
      setSavedAddresses([])
    }
    setShowAddressStep(true)
    addAssistantMessage('Before we proceed to payment, please select a delivery address or add a new one below.')
  }

  const handleAddressSelect = (address) => {
    setSelectedAddress(address)
    setShowAddressStep(false)
    setShowNewAddressForm(false)
    setShowPaymentSummary(false)
    setAwaitingPaymentConfirmation(true)
    addAssistantMessage(`Address selected: **${address.full_name}**, ${address.street_address}, ${address.city} — ${address.pincode}. Your total is **${formatPrice(useCartStore.getState().total * 100)}**. Would you like to proceed to checkout?`)
  }

  const handleSaveNewAddress = async () => {
    setSavingAddress(true)
    try {
      const { usersApi } = await import('../../services/api')
      const res = await usersApi.addAddress(newAddress)
      const newId = res.data.id
      const freshRes = await usersApi.getAddresses()
      const addresses = freshRes.data.addresses || []
      setSavedAddresses(addresses)
      const saved = addresses.find(a => a.id === newId) || { ...newAddress, id: newId }
      handleAddressSelect(saved)
      setNewAddress({ label: 'Home', full_name: '', phone: '', street_address: '', landmark: '', city: '', state: '', pincode: '' })
    } catch (err) {
      addAssistantMessage(`Could not save address: ${err.message}. Please try again.`)
    } finally {
      setSavingAddress(false)
    }
  }



  const handleApplyDiscount = async (code) => {
    const applied = await applyCoupon(code)
    if (!applied?.success) {
      setPaymentError(applied?.error || 'This discount could not be applied.')
      return
    }
    await refreshCart()
    setShowDiscountPrompt(false)
    setShowPaymentSummary(false)
    // Show address step after discount applied
    await handleShowAddressStep()
  }

  const handleSkipDiscount = async () => {
    setShowDiscountPrompt(false)
    // Show address step before payment
    await handleShowAddressStep()
  }



  const handleRetryPayment = async () => {
    setShowRetryPrompt(false)
    setPaymentError('')
    await handleConfirmPay()
  }

  const handleCancelRetry = () => {
    setShowRetryPrompt(false)
    setPaymentError('')
    addAssistantMessage("No problem! Your cart items are still saved. Let me know whenever you're ready to checkout.")
  }

  const handleConfirmPay = async () => {
    if (!cartId || !items.length || isPaying) return
    setIsPaying(true)
    setPaymentError('')
    try {
      const validation = await checkoutApi.validate(cartId, appliedCoupon)
      if (!validation.data.valid) throw new Error(validation.data.issues.join(', '))
      const order = await checkoutApi.createOrder({
        cart_id: cartId,
        coupon_code: appliedCoupon,
      })
      const payment = await checkoutApi.initPayment(order.data.id)
      await loadRazorpay()
      const razorpay = new window.Razorpay({
        key: payment.data.key_id,
        amount: payment.data.amount_paise,
        currency: payment.data.currency,
        name: 'AgentCART',
        description: `Order ${order.data.order_number}`,
        order_id: payment.data.razorpay_order_id,
        theme: { color: '#3F6E5B' },
        handler: async (response) => {
          try {
            const verified = await checkoutApi.verifyPayment({
              order_id: order.data.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            clearCart()
            setShowPaymentSummary(false)
            setPaymentSuccess(true)
            setShowAddOnPanel(false)
            setShowDiscountPrompt(false)
            setShowRetryPrompt(false)
            addAssistantMessage(`🎉 **Order Successful!**\n\nThank you for shopping with AgentCART! Your order **#${verified.data.order_number}** has been confirmed and is being processed.`)
          } catch (error) {
            setPaymentError(error.message)
          } finally {
            setIsPaying(false)
          }
        },
        modal: {
          ondismiss: () => {
            setIsPaying(false)
            setShowRetryPrompt(true)
            addAssistantMessage("You have cancelled the last transaction. Would you like to retry it?")
          }
        },
      })
      razorpay.on('payment.failed', (response) => {
        setIsPaying(false)
        setShowRetryPrompt(true)
        addAssistantMessage("You have cancelled the last transaction. Would you like to retry it?")
      })
      razorpay.open()
    } catch (error) {
      setPaymentError(error.response?.data?.detail || error.message)
      setIsPaying(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAddProduct = async (product) => {
    setAddedAddOnIds(prev => ({ ...prev, [product.id]: 'loading' }))
    try {
      await addItem(product.id)
      await refreshCart()
      setAddedAddOnIds(prev => ({ ...prev, [product.id]: 'added' }))
      const related = await cartApi.relatedProducts(cartId)
      if (!showAddOnPanel && !hasCompletedAddOnStage) {
        setAddOnProducts(related.data.products || [])
        setShowAddOnPanel(true)
        setAwaitingPaymentConfirmation(false)
        addAssistantMessage(
          `Added **${product.name}** to your cart. Here are a few popular add-ons. Add any you want, then confirm below.`,
        )
      } else {
        addAssistantMessage(`Added **${product.name}** to your cart.`)
      }
    } catch (error) {
      setAddedAddOnIds(prev => ({ ...prev, [product.id]: null }))
      setPaymentError(error.message)
    }
  }

  return (
    <>
      {isOpen && <div className="agent-overlay" onClick={closeChat} aria-hidden="true" />}

      <div className={`agent-chat ${isOpen ? 'agent-chat--open' : ''}`} role="dialog" aria-label="AgentCART Assistant">
        {/* ─── Header ─── */}
        <div className="agent-chat__header">
          <div className="agent-chat__title">
            <div className="agent-chat__status-dot" aria-hidden="true" />
            <div>
              <p className="label-caps">AgentCART</p>
              <p className="truth-sm text-ink-ghost">AI Shopping Assistant</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm agent-chat__close" onClick={closeChat} aria-label="Close chat">✕</button>
        </div>

        <div className="divider" />

        {/* ─── Context Banner ─── */}
        {contextProduct && (
          <div className="agent-chat__context">
            <span className="label-caps text-signal">Context</span>
            <span className="body-sm truncate">{contextProduct.name}</span>
          </div>
        )}

        {/* ─── Messages ─── */}
        <div className="agent-chat__messages" role="log" aria-live="polite">
          {messages.length === 0 && (
            <div className="agent-chat__welcome">
              <p className="body-sm text-ink-soft">
                Hi! I'm AgentCART, your AI shopping assistant. Ask me to find products, compare prices, or add items to your cart.
              </p>
              <div className="agent-chat__suggestions">
                {[
                  'Show me laptops',
                  'Find wireless headphones under ₹3000',
                  'What coupons do I have?',
                ].map((label) => (
                  <button
                    key={label}
                    className="agent-chat__suggestion"
                    onClick={async () => {
                      setInput('')
                      // sendMessage already adds the user message — do NOT call addUserMessage here
                      const result = await sendMessage(label, cartId)
                      if (result?.cartUpdated) await refreshCart()
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}


          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`agent-message agent-message--${msg.role} ${msg.isError ? 'agent-message--error' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="agent-message__avatar" aria-hidden="true">A</div>
              )}
              <div className="agent-message__bubble">
                {msg.role === 'assistant' && msg.tool_calls?.length > 0 && (
                  <ToolCallBadges toolCalls={msg.tool_calls} />
                )}
                {msg.role === 'assistant' ? <FormattedMessage content={msg.content} /> : <p className="body-sm">{msg.content}</p>}
                {msg.role === 'assistant' && (
                  <ProductCards toolCalls={msg.tool_calls} onAdd={handleAddProduct} />
                )}
                {msg.cart_updated && (
                  <div className="agent-message__cart-update">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span className="truth-sm text-signal">Cart updated</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {showAddOnPanel && items.length > 0 && (
            <div className="agent-payment-summary agent-add-on-panel">
              <div className="agent-payment-summary__heading">
                <span className="label-caps">Popular Add-ons</span>
                <span className="truth-sm text-ink-ghost">Optional</span>
              </div>
              {addOnProducts.length ? addOnProducts.map((product) => {
                const status = addedAddOnIds[product.id]
                return (
                  <div className="agent-product-card" key={product.id}>
                    {product.image_url && <img src={product.image_url} alt="" className="agent-product-card__image" />}
                    <div className="agent-product-card__details">
                      <strong>{product.name}</strong>
                      <span className="truth-sm">{formatPrice(product.price_paise)}</span>
                      <button
                        className={`btn btn-sm ${status === 'added' ? 'btn-signal' : 'btn-ghost'}`}
                        onClick={() => !status && handleAddProduct(product)}
                        disabled={!!status}
                      >
                        {status === 'loading' ? 'Adding…' : status === 'added' ? '✓ Added' : 'Add to cart'}
                      </button>
                    </div>
                  </div>
                )
              }) : <p className="body-sm">No related add-ons are available right now.</p>}
              <button className="btn btn-signal btn-full" onClick={handleConfirmAddOns}>Confirm</button>
            </div>
          )}

          {showDiscountPrompt && (
            <div className="agent-payment-summary">
              <div className="agent-payment-summary__heading"><span className="label-caps">Available Discounts</span></div>
              {discounts.map((discount) => (
                <div className="agent-payment-summary__item" key={discount.code}>
                  <span>{discount.code}</span><strong>Save {formatPrice(discount.discount_paise)}</strong>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleApplyDiscount(discount.code)}>Apply</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={handleSkipDiscount}>Continue without discount</button>
            </div>
          )}

          {/* ─── Address Selection Step ─── */}
          {showAddressStep && (
            <div className="agent-payment-summary agent-address-step">
              <div className="agent-payment-summary__heading">
                <span className="label-caps">Delivery Address</span>
              </div>
              {savedAddresses.length > 0 && !showNewAddressForm && (
                <div className="agent-address-list">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      className={`agent-address-card ${selectedAddress?.id === addr.id ? 'agent-address-card--selected' : ''}`}
                      onClick={() => handleAddressSelect(addr)}
                    >
                      <div className="agent-address-card__label">
                        <i className="fa-solid fa-location-dot" />
                        <strong>{addr.label}</strong>
                        {addr.is_default && <span className="badge badge-signal" style={{fontSize:9,padding:'1px 6px'}}>Default</span>}
                      </div>
                      <p className="truth-sm">{addr.full_name} · {addr.phone}</p>
                      <p className="truth-sm text-ink-ghost">{addr.street_address}, {addr.city} — {addr.pincode}</p>
                    </button>
                  ))}
                </div>
              )}
              {!showNewAddressForm && (
                <button className="btn btn-ghost btn-sm" style={{marginTop: 8}} onClick={() => setShowNewAddressForm(true)}>
                  <i className="fa-solid fa-plus" /> Add New Address
                </button>
              )}
              {showNewAddressForm && (
                <div className="agent-new-address-form">
                  <div className="agent-form-row">
                    <input className="input-field" placeholder="Label (Home/Work)" value={newAddress.label} onChange={e => setNewAddress(a => ({...a, label: e.target.value}))} />
                    <input className="input-field" placeholder="Full Name" value={newAddress.full_name} onChange={e => setNewAddress(a => ({...a, full_name: e.target.value}))} />
                  </div>
                  <input className="input-field" placeholder="Phone" value={newAddress.phone} onChange={e => setNewAddress(a => ({...a, phone: e.target.value}))} />
                  <input className="input-field" placeholder="Street Address" value={newAddress.street_address} onChange={e => setNewAddress(a => ({...a, street_address: e.target.value}))} />
                  <input className="input-field" placeholder="Landmark (optional)" value={newAddress.landmark} onChange={e => setNewAddress(a => ({...a, landmark: e.target.value}))} />
                  <div className="agent-form-row">
                    <input className="input-field" placeholder="City" value={newAddress.city} onChange={e => setNewAddress(a => ({...a, city: e.target.value}))} />
                    <input className="input-field" placeholder="State" value={newAddress.state} onChange={e => setNewAddress(a => ({...a, state: e.target.value}))} />
                    <input className="input-field" placeholder="Pincode" value={newAddress.pincode} onChange={e => setNewAddress(a => ({...a, pincode: e.target.value}))} />
                  </div>
                  <div style={{display:'flex',gap:8,marginTop:8}}>
                    <button className="btn btn-signal btn-sm" onClick={handleSaveNewAddress} disabled={savingAddress}>
                      {savingAddress ? 'Saving…' : 'Save & Use'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowNewAddressForm(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}


          {showPaymentSummary && items.length > 0 && (
            <div className="agent-payment-summary">
              <div className="agent-payment-summary__heading">
                <span className="label-caps">Order Summary</span>
                <span className="truth-sm text-ink-ghost">Ready to pay</span>
              </div>
              {items.map((item) => (
                <div className="agent-payment-summary__item" key={item.id}>
                  <span>{item.product?.name || item.product_name} × {item.quantity}</span>
                  <strong>{formatPrice(item.subtotal_paise ?? item.subtotal * 100)}</strong>
                </div>
              ))}
              <div className="agent-payment-summary__total">
                <span>Your total</span>
                <strong>{formatPrice(total * 100)}</strong>
              </div>
              {paymentError && <p className="agent-payment-summary__error">{paymentError}</p>}
              {!paymentSuccess ? (
                <>
                  <button className="btn btn-signal btn-full" onClick={handleConfirmPay} disabled={isPaying}>
                    {isPaying ? 'Opening payment…' : `Confirm & Pay ${formatPrice(total * 100)}`}
                  </button>
                  <p className="truth-sm text-ink-ghost">Razorpay Test Mode</p>
                </>
              ) : (
                <p className="agent-payment-summary__success">✓ Payment verified</p>
              )}
            </div>
          )}

          {showRetryPrompt && (
            <div className="agent-payment-summary" style={{ border: '1px solid #c4622d', background: 'rgba(196, 98, 45, 0.08)' }}>
              <div className="agent-payment-summary__heading">
                <span className="label-caps" style={{ color: '#c4622d' }}>Payment Cancelled</span>
              </div>
              <p className="body-sm" style={{ color: 'var(--color-ink)' }}>You have cancelled the last transaction. Would you like to retry it?</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button className="btn btn-signal btn-sm" style={{ flex: 1 }} onClick={handleRetryPayment}>
                  Yes, Retry Payment
                </button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => handleCancelRetry()}>
                  No
                </button>
              </div>
            </div>
          )}

          {paymentSuccess && (
            <div className="agent-payment-summary agent-payment-summary--success">
              <strong style={{ fontSize: '15px' }}>🎉 Order Successful!</strong>
              <p className="body-sm" style={{ marginTop: '4px', color: 'var(--color-signal-mid)' }}>
                Thank you for shopping with AgentCART! Your order has been placed.
              </p>
            </div>
          )}

          {isTyping && (
            <div className="agent-message agent-message--assistant">
              <div className="agent-message__avatar" aria-hidden="true">A</div>
              <div className="agent-message__bubble agent-message__bubble--typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="divider" />

        {/* ─── Input ─── */}
        <div className="agent-chat__input-row">
          <textarea
            ref={inputRef}
            id="agent-chat-input"
            className="agent-chat__textarea input-field"
            placeholder="Ask AgentCART anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            aria-label="Chat input"
          />
          <button
            id="agent-send-btn"
            className="btn btn-primary agent-chat__send"
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
          >
            <i className="fa-solid fa-paper-plane" style={{ transform: 'rotate(45deg)', fontSize: '13px' }} />
          </button>
        </div>
      </div>
    </>
  )
}
