import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useCartStore from '../store/cartStore'
import { checkoutApi } from '../services/api'
import './CheckoutPage.css'

const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve()
  const script = document.createElement('script')
  script.src = 'https://checkout.razorpay.com/v1/checkout.js'
  script.onload = resolve
  script.onerror = () => reject(new Error('Could not load Razorpay Checkout.'))
  document.body.appendChild(script)
})

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { cartId, items, subtotal, discountAmount, total, appliedCoupon, clearCart } = useCartStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showRetryPrompt, setShowRetryPrompt] = useState(false)

  const handlePayment = async (event) => {
    if (event && event.preventDefault) event.preventDefault()
    if (!cartId || !items.length) return setError('Your cart is empty.')
    setIsLoading(true)
    setError('')
    setShowRetryPrompt(false)
    try {
      const validation = await checkoutApi.validate(cartId, appliedCoupon)
      if (!validation.data.valid) throw new Error(validation.data.issues.join(', '))
      const order = await checkoutApi.createOrder({
        cart_id: cartId,
        coupon_code: appliedCoupon,
        shipping_address: { name, email, phone, address },
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
        prefill: { name, email, contact: phone },
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
            navigate(`/order/${verified.data.id}`)
          } catch (verificationError) {
            setError(verificationError.message)
          } finally {
            setIsLoading(false)
          }
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false)
            setShowRetryPrompt(true)
            setError('You have cancelled the last transaction. Would you like to retry it?')
          }
        },
      })
      razorpay.on('payment.failed', (response) => {
        setIsLoading(false)
        setShowRetryPrompt(true)
        setError('You have cancelled the last transaction. Would you like to retry it?')
      })
      razorpay.open()
    } catch (paymentError) {
      setError(paymentError.response?.data?.detail || paymentError.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="container checkout-page">
      <div className="checkout-page__header">
        <div>
          <p className="label-caps text-signal">Test Mode</p>
          <h1 className="headline-md">Secure checkout</h1>
        </div>
        <Link to="/catalogue" className="btn btn-ghost btn-sm">← Catalogue</Link>
      </div>
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handlePayment}>
          <h2 className="headline-md">Delivery details</h2>
          <label>Name<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Phone<input required value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <label>Address<textarea required rows="3" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
          
          {showRetryPrompt ? (
            <div style={{ background: '#fff7ed', border: '1px solid #c4622d', padding: '16px', borderRadius: '8px', margin: '12px 0' }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#c4622d' }}>You have cancelled the last transaction. Would you like to retry it?</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn btn-signal btn-sm" onClick={handlePayment}>Yes, Retry Payment</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowRetryPrompt(false); setError(''); }}>No</button>
              </div>
            </div>
          ) : error ? (
            <p className="checkout-error">{error}</p>
          ) : null}

          <button className="btn btn-signal btn-lg" type="submit" disabled={isLoading || !items.length}>
            {isLoading ? 'Opening payment…' : `Pay ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </button>
          <p className="truth-sm text-ink-ghost">Razorpay Test Mode · Card: 4100 2800 0000 1007 · CVV: 123 · Exp: 12/26</p>
        </form>
        <aside className="checkout-summary">
          <h2 className="headline-md">Order summary</h2>
          {items.map((item) => <div className="checkout-item" key={item.id}><span>{item.product?.name || item.product_name} × {item.quantity}</span><strong>₹{item.subtotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>)}
          <div className="checkout-total"><span>Subtotal</span><strong>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
          {discountAmount > 0 && <div className="checkout-total"><span>Discount</span><strong>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>}
          <div className="checkout-total checkout-total--final"><span>Total</span><strong>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
        </aside>
      </div>
    </div>
  )
}
