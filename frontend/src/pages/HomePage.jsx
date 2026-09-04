import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import useAuthStore from '../store/authStore'
import { merchantApi } from '../services/api'
import './HomePage.css'

/* ─── Auth Modal ────────────────────────────────────────────── */
function AuthModal({ mode, onClose, onSuccess, prefillEmail = '', prefillPassword = '' }) {
  const [tab, setTab] = useState('email') // 'email' | 'phone'
  const [authMode, setAuthMode] = useState(mode)
  const [form, setForm] = useState({ email: prefillEmail, name: '', password: prefillPassword, phone: '', otp: '' })
  const [otpSent, setOtpSent] = useState(false)
  const [otpHint, setOtpHint] = useState('')
  const [error, setError] = useState('')

  const { login, signup, sendOtp, verifyOtp, isLoading } = useAuthStore()

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (authMode === 'login') {
        const user = await login(form.email, form.password)
        // Block merchants from using customer login
        if (user?.owned_store) {
          useAuthStore.getState().logout()
          setError('This account is registered as a merchant. Please use the Merchant Portal to access your dashboard.')
          return
        }
      } else {
        await signup(form.email, form.name, form.password)
      }
      onSuccess()
    } catch (err) {
      setError(err.message || 'Authentication failed.')
    }
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await sendOtp(form.phone)
      setOtpSent(true)
      if (res.otp_hint) setOtpHint(res.otp_hint)
    } catch (err) {
      setError(err.message || 'Failed to send OTP.')
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await verifyOtp(form.phone, form.otp)
      onSuccess()
    } catch (err) {
      setError(err.message || 'Invalid OTP.')
    }
  }

  return (
    <div className="auth-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Sign in to AgentCART">
        <div className="auth-modal__header">
          <div className="auth-modal__logo">
            <span className="auth-modal__logo-agent">Agent</span>
            <span className="auth-modal__logo-cart">CART</span>
          </div>
          <button className="auth-modal__close" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="auth-modal__body">
          <h2 className="auth-modal__title">
            {authMode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="auth-modal__subtitle">
            {authMode === 'login'
              ? 'Sign in to access your global AgentCART profile across all stores.'
              : 'Join AgentCART to shop across all registered stores with one account.'}
          </p>

          <div className="auth-modal__tabs">
            <button
              className={`auth-modal__tab ${tab === 'email' ? 'active' : ''}`}
              onClick={() => { setTab('email'); setError(''); setOtpSent(false) }}
            >
              <i className="fa-solid fa-envelope" /> Email & Password
            </button>
            <button
              className={`auth-modal__tab ${tab === 'phone' ? 'active' : ''}`}
              onClick={() => { setTab('phone'); setError(''); setOtpSent(false) }}
            >
              <i className="fa-solid fa-mobile-screen-button" /> Phone OTP
            </button>
          </div>

          {tab === 'email' && (
            <form className="auth-modal__form" onSubmit={handleEmailSubmit}>
              {authMode === 'signup' && (
                <div className="auth-field">
                  <label className="auth-field__label label-caps">Full Name</label>
                  <div className="auth-field__input-wrap">
                    <i className="fa-solid fa-user auth-field__icon" />
                    <input
                      className="auth-field__input"
                      type="text"
                      placeholder="e.g. Samir Khan"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              )}
              <div className="auth-field">
                <label className="auth-field__label label-caps">Email Address</label>
                <div className="auth-field__input-wrap">
                  <i className="fa-solid fa-envelope auth-field__icon" />
                  <input
                    className="auth-field__input"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-field__label label-caps">Password</label>
                <div className="auth-field__input-wrap">
                  <i className="fa-solid fa-lock auth-field__icon" />
                  <input
                    className="auth-field__input"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                  />
                </div>
              </div>
              {error && <p className="auth-error"><i className="fa-solid fa-circle-exclamation" /> {error}</p>}
              <button type="submit" className="btn btn-primary auth-modal__submit" disabled={isLoading}>
                {isLoading
                  ? <><i className="fa-solid fa-spinner fa-spin" /> Authenticating…</>
                  : authMode === 'login' ? 'Sign In with Password' : 'Create Account'}
              </button>
            </form>
          )}

          {tab === 'phone' && (
            <form className="auth-modal__form" onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
              <div className="auth-field">
                <label className="auth-field__label label-caps">Phone Number</label>
                <div className="auth-field__phone-row">
                  <span className="auth-field__prefix">
                    <i className="fa-solid fa-phone" style={{ fontSize: 11, marginRight: 4 }} />+91
                  </span>
                  <input
                    className="auth-field__input"
                    type="tel"
                    placeholder="98765 43210"
                    value={form.phone.replace(/^\+91/, '')}
                    onChange={e => setForm(f => ({ ...f, phone: '+91' + e.target.value.replace(/\D/g,'') }))}
                    required
                    disabled={otpSent}
                  />
                </div>
              </div>
              {otpSent && (
                <div className="auth-field">
                  <label className="auth-field__label label-caps">
                    <i className="fa-solid fa-key" style={{ marginRight: 4 }} />Enter OTP
                  </label>
                  <input
                    className="auth-field__input auth-field__input--otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="——————"
                    value={form.otp}
                    onChange={e => setForm(f => ({ ...f, otp: e.target.value.replace(/\D/,'') }))}
                    required
                    autoFocus
                  />
                  {otpHint && (
                    <span className="auth-field__hint">
                      <i className="fa-solid fa-circle-info" /> Dev OTP: <strong>{otpHint}</strong>
                    </span>
                  )}
                </div>
              )}
              {error && <p className="auth-error"><i className="fa-solid fa-circle-exclamation" /> {error}</p>}
              {otpSent ? (
                <>
                  <button type="submit" className="btn btn-primary auth-modal__submit" disabled={isLoading}>
                    {isLoading ? <><i className="fa-solid fa-spinner fa-spin" /> Verifying…</> : 'Verify OTP'}
                  </button>
                  <button type="button" className="auth-modal__resend" onClick={() => { setOtpSent(false); setOtpHint('') }}>
                    <i className="fa-solid fa-rotate-right" style={{ marginRight: 4 }} />Resend OTP
                  </button>
                </>
              ) : (
                <button type="submit" className="btn btn-primary auth-modal__submit" disabled={isLoading}>
                  {isLoading ? <><i className="fa-solid fa-spinner fa-spin" /> Sending…</> : 'Send OTP'}
                </button>
              )}
            </form>
          )}
        </div>

        <div className="auth-modal__footer">
          {authMode === 'login' ? (
            <span>New to AgentCART?{' '}
              <button className="auth-modal__toggle-link" onClick={() => { setAuthMode('signup'); setError('') }}>
                Create account
              </button>
            </span>
          ) : (
            <span>Already have an account?{' '}
              <button className="auth-modal__toggle-link" onClick={() => { setAuthMode('login'); setError('') }}>
                Sign in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Merchant Registration Modal ───────────────────────────── */
const STORE_CATEGORIES = [
  'Electronics', 'Fashion', 'Home & Kitchen', 'Computing', 'Sports & Fitness',
  'Books', 'Beauty & Health', 'Groceries & Food', 'Toys & Games', 'Automotive', 'Other'
]

function MerchantModal({ onClose, prefillEmail = '', prefillPassword = '' }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [accountMode, setAccountMode] = useState(prefillEmail ? 'login' : 'register') // 'register' | 'login'
  const [form, setForm] = useState({
    name: '', email: prefillEmail, phone: '', password: prefillPassword,
    storeName: '', slug: '', domain: '', description: '', category: ''
  })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')
  const { signup, login, loadFromStorage } = useAuthStore()

  // Auto-generate slug from store name
  const handleStoreNameChange = (value) => {
    const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    setForm(f => ({ ...f, storeName: value, slug }))
  }

  const handleAccountSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      setLoading(true)
      if (accountMode === 'register') {
        // New merchant signup → go to store setup
        await signup(form.email, form.name, form.password)
        setStep(2)
      } else {
        const user = await login(form.email, form.password)
        if (user?.owned_store) {
          // Has a store → go straight to dashboard
          onClose()
          navigate('/dashboard')
        } else {
          // No store yet → proceed to store setup
          setStep(2)
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStoreSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      setLoading(true)
      const res = await merchantApi.register({
        name: form.storeName,
        slug: form.slug,
        domain: form.domain || undefined,
        description: form.description || undefined,
        category: form.category || undefined,
      })
      // Refresh user profile so owned_store appears in header
      await loadFromStorage()
      setDone(res.data)
    } catch (err) {
      setError(err.message || 'Store registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal auth-modal--wide" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="auth-modal__header">
          <div>
            <div className="auth-modal__logo">
              <span className="auth-modal__logo-agent">Agent</span>
              <span className="auth-modal__logo-cart">CART</span>
            </div>
            <p className="label-caps" style={{ marginTop: 4, fontSize: 10 }}>MERCHANT PORTAL</p>
          </div>
          <button className="auth-modal__close" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Step indicator */}
        {!done && (
          <div className="merchant-steps">
            <div className={`merchant-step ${step >= 1 ? 'active' : ''}`}>
              <div className="merchant-step__dot">
                {step > 1 ? <i className="fa-solid fa-check" style={{fontSize:10}} /> : '1'}
              </div>
              <span>Account</span>
            </div>
            <div className="merchant-step__line" />
            <div className={`merchant-step ${step >= 2 ? 'active' : ''}`}>
              <div className="merchant-step__dot">2</div>
              <span>Store Details</span>
            </div>
          </div>
        )}

        <div className="auth-modal__body">
          {/* ── SUCCESS ── */}
          {done ? (
            <div className="merchant-success">
              <div className="merchant-success__icon">
                <i className="fa-solid fa-check" />
              </div>
              <h2 className="auth-modal__title">Store is live! 🎉</h2>
              <p className="body-sm text-ink-soft" style={{ marginBottom: 16 }}>
                <strong>{done.name}</strong> has been registered on AgentCART. Head to your dashboard to add products, configure your AI agent, and start selling.
              </p>
              <button
                className="btn btn-primary auth-modal__submit"
                onClick={() => { onClose(); navigate('/dashboard') }}
              >
                <i className="fa-solid fa-arrow-right" /> Go to My Dashboard
              </button>
            </div>

          /* ── STEP 1: Account ── */
          ) : step === 1 ? (
            <>
              {/* Login / Register toggle */}
              <div className="merchant-mode-toggle">
                <button
                  className={`merchant-mode-btn ${accountMode === 'register' ? 'active' : ''}`}
                  onClick={() => { setAccountMode('register'); setError('') }}
                >
                  New Merchant
                </button>
                <button
                  className={`merchant-mode-btn ${accountMode === 'login' ? 'active' : ''}`}
                  onClick={() => { setAccountMode('login'); setError('') }}
                >
                  Already Registered
                </button>
              </div>

              <h2 className="auth-modal__title" style={{ marginTop: 16 }}>
                {accountMode === 'register' ? 'Create your merchant account' : 'Welcome back'}
              </h2>
              <p className="auth-modal__subtitle">
                {accountMode === 'register'
                  ? 'Start by creating your AgentCART merchant account, then set up your store.'
                  : 'Sign in to your existing merchant account to continue setting up your store.'}
              </p>

              <form className="auth-modal__form" onSubmit={handleAccountSubmit}>
                {accountMode === 'register' && (
                  <>
                    <div className="auth-field">
                      <label className="auth-field__label label-caps">Full Name</label>
                      <div className="auth-field__input-wrap">
                        <i className="fa-solid fa-user auth-field__icon" />
                        <input className="auth-field__input" type="text" placeholder="e.g. Vikram Sharma"
                          value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
                      </div>
                    </div>
                    <div className="auth-field">
                      <label className="auth-field__label label-caps">Phone Number</label>
                      <div className="auth-field__phone-row">
                        <span className="auth-field__prefix">
                          <i className="fa-solid fa-phone" style={{ fontSize: 11, marginRight: 4 }} />+91
                        </span>
                        <input className="auth-field__input" type="tel" placeholder="98765 43210"
                          value={form.phone.replace(/^\+91/, '')}
                          onChange={e => setForm(f => ({...f, phone: '+91' + e.target.value.replace(/\D/g,'')}))} required />
                      </div>
                    </div>
                  </>
                )}

                <div className="auth-field">
                  <label className="auth-field__label label-caps">Email Address</label>
                  <div className="auth-field__input-wrap">
                    <i className="fa-solid fa-envelope auth-field__icon" />
                    <input className="auth-field__input" type="email" placeholder="you@yourstore.com"
                      value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
                  </div>
                </div>
                <div className="auth-field">
                  <label className="auth-field__label label-caps">Password</label>
                  <div className="auth-field__input-wrap">
                    <i className="fa-solid fa-lock auth-field__icon" />
                    <input className="auth-field__input" type="password" placeholder="Min. 8 characters"
                      value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required minLength={8} />
                  </div>
                </div>

                {error && <p className="auth-error"><i className="fa-solid fa-circle-exclamation" /> {error}</p>}
                <button type="submit" className="btn btn-primary auth-modal__submit" disabled={loading}>
                  {loading
                    ? <><i className="fa-solid fa-spinner fa-spin" /> {accountMode === 'register' ? 'Creating…' : 'Signing in…'}</>
                    : accountMode === 'register' ? 'Create Account & Continue →' : 'Sign In & Continue →'}
                </button>
              </form>
            </>

          /* ── STEP 2: Store Info ── */
          ) : (
            <>
              <h2 className="auth-modal__title">Set up your store</h2>
              <p className="auth-modal__subtitle">Fill in your store details — you can update these anytime from your dashboard.</p>

              <form className="auth-modal__form" onSubmit={handleStoreSubmit}>
                <div className="auth-field">
                  <label className="auth-field__label label-caps">Store Name</label>
                  <div className="auth-field__input-wrap">
                    <i className="fa-solid fa-store auth-field__icon" />
                    <input className="auth-field__input" type="text" placeholder="e.g. TechGear India"
                      value={form.storeName}
                      onChange={e => handleStoreNameChange(e.target.value)} required />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-field__label label-caps">
                    Store Slug
                    <span style={{fontWeight:400, marginLeft:6, color:'var(--color-ink-ghost)'}}>agentcart.io/<strong>{form.slug || 'your-store'}</strong></span>
                  </label>
                  <div className="auth-field__input-wrap">
                    <i className="fa-solid fa-at auth-field__icon" />
                    <input className="auth-field__input" type="text" placeholder="techgear-india"
                      value={form.slug}
                      onChange={e => setForm(f => ({...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'')}))} required />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-field__label label-caps">Business Category</label>
                  <div className="auth-field__input-wrap">
                    <i className="fa-solid fa-tag auth-field__icon" />
                    <select className="auth-field__input auth-field__select"
                      value={form.category}
                      onChange={e => setForm(f => ({...f, category: e.target.value}))}
                    >
                      <option value="">Select a category</option>
                      {STORE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-field__label label-caps">Store Description <span style={{fontWeight:400}}>(optional)</span></label>
                  <textarea
                    className="auth-field__input auth-field__textarea"
                    placeholder="Briefly describe what your store sells and who it's for…"
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  />
                </div>

                <div className="auth-field">
                  <label className="auth-field__label label-caps">Store Domain <span style={{fontWeight:400}}>(optional)</span></label>
                  <div className="auth-field__input-wrap">
                    <i className="fa-solid fa-globe auth-field__icon" />
                    <input className="auth-field__input" type="text" placeholder="techgear.com"
                      value={form.domain} onChange={e => setForm(f => ({...f, domain: e.target.value}))} />
                  </div>
                </div>

                {error && <p className="auth-error"><i className="fa-solid fa-circle-exclamation" /> {error}</p>}
                <button type="submit" className="btn btn-signal auth-modal__submit" disabled={loading}>
                  {loading
                    ? <><i className="fa-solid fa-spinner fa-spin" /> Registering…</>
                    : <><i className="fa-solid fa-store" /> Register My Store</>}
                </button>
                <button type="button" className="auth-modal__resend" style={{marginTop:4}} onClick={() => setStep(1)}>
                  ← Back to account
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Hero Feature Bullets ──────────────────────────────────── */
const HERO_BULLETS = [
  { icon: 'fa-solid fa-comment-dots',   label: 'Embedded AI chat widget for your store' },
  { icon: 'fa-solid fa-users',           label: 'Global customer identity & address management' },
  { icon: 'fa-solid fa-gears',           label: 'Server-side policy & coupon engine' },
  { icon: 'fa-solid fa-credit-card',     label: 'Razorpay payment integration' },
  { icon: 'fa-solid fa-truck-fast',      label: 'Real-time order tracking & analytics' },
]

/* ─── Pillars ───────────────────────────────────────────────── */
const PILLARS = [
  {
    icon: 'fa-solid fa-robot',
    title: 'Conversational AI Agent',
    desc: 'Your store gets an AI shopping assistant that finds products, manages cart, and guides customers naturally.',
  },
  {
    icon: 'fa-solid fa-clipboard-list',
    title: 'Server-Side Policy Engine',
    desc: 'Discounts, prices, and stock are enforced server-side. The AI never manufactures prices or violates your rules.',
  },
  {
    icon: 'fa-solid fa-shield-halved',
    title: 'Verified Checkout',
    desc: 'Razorpay Test Mode with webhook reconciliation. Orders confirmed only on server-verified payment.',
  },
  {
    icon: 'fa-solid fa-book',
    title: 'Ledger Audit Trail',
    desc: 'Every agent decision, policy evaluation, and payment state transition is logged immutably.',
  },
]

/* ─── Categories ────────────────────────────────────────────── */
const CATEGORIES = [
  { name: 'Electronics',      icon: 'fa-solid fa-bolt',       slug: 'Electronics' },
  { name: 'Computing',        icon: 'fa-solid fa-laptop',      slug: 'Computing' },
  { name: 'Home & Kitchen',   icon: 'fa-solid fa-house',       slug: 'Home & Kitchen' },
  { name: 'Fashion',          icon: 'fa-solid fa-shirt',       slug: 'Fashion' },
  { name: 'Sports & Fitness', icon: 'fa-solid fa-dumbbell',    slug: 'Sports & Fitness' },
  { name: 'Books',            icon: 'fa-solid fa-book-open',   slug: 'Books' },
]

/* ─── Main HomePage ─────────────────────────────────────────── */
export default function HomePage() {
  const { isAuthenticated, initialized } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [prefill, setPrefill] = useState({ email: '', password: '' })

  const queryParams = new URLSearchParams(location.search)
  const modal = queryParams.get('modal')

  const openWithCreds = (email, password) => {
    setPrefill({ email, password })
    navigate('/?modal=login')
  }

  // Once auth check is complete, redirect authenticated users to catalogue
  useEffect(() => {
    if (initialized && isAuthenticated) {
      navigate('/catalogue', { replace: true })
    }
  }, [initialized, isAuthenticated, navigate])

  const closeModal = () => navigate('/', { replace: true })

  // After successful login — go straight to catalogue
  const onAuthSuccess = () => {
    navigate('/catalogue', { replace: true })
  }

  // Show spinner until the auth session check completes
  if (!initialized) {
    return (
      <div className="home-loading">
        <div className="home-loading__spinner" />
      </div>
    )
  }

  // If authenticated, the useEffect above will redirect — render nothing meanwhile
  if (isAuthenticated) return null

  return (
    <div className="home-page page-enter">

      {/* ─── Modals ─── */}
      {(modal === 'login' || modal === 'signup') && (
        <AuthModal
          mode={modal}
          onClose={() => { setPrefill({ email: '', password: '' }); closeModal() }}
          onSuccess={onAuthSuccess}
          prefillEmail={prefill.email}
          prefillPassword={prefill.password}
        />
      )}
      {modal === 'merchant' && (
        <MerchantModal
          onClose={closeModal}
          prefillEmail={prefill.email}
          prefillPassword={prefill.password}
        />
      )}

      {/* ─── Hero ─── */}
      <section className="home-hero">
        <div className="container home-hero__inner">

          {/* Left: content */}
          <div className="home-hero__content">
            <div className="badge badge-signal home-hero__badge">
              <i className="fa-solid fa-check" style={{ fontSize: 9 }} />
              AI-Powered Commerce Platform
            </div>

            <h1 className="headline-lg home-hero__headline">
              Commerce, guided<br />by intelligence.
            </h1>

            {/* Bullet points directly below headline */}
            <ul className="home-hero__bullets">
              {HERO_BULLETS.map(b => (
                <li key={b.label} className="home-hero__bullet">
                  <span className="home-hero__bullet-icon">
                    <i className={b.icon} />
                  </span>
                  <span className="body-sm">{b.label}</span>
                </li>
              ))}
            </ul>

            <div className="home-hero__actions">
              <Link to="/?modal=merchant" id="register-store-btn" className="btn btn-primary btn-lg">
                <i className="fa-solid fa-store" />
                Register Your Store
              </Link>
              <Link to="/?modal=login" id="customer-login-btn" className="btn btn-ghost btn-lg">
                <i className="fa-solid fa-user" />
                User Login / Sign Up
              </Link>
            </div>
          </div>

          {/* Right: receipt card */}
          <div className="home-hero__receipt" aria-hidden="true">
            <div className="receipt-preview">
              <div className="receipt-preview__header">
                <span className="label-caps">AgentCART Receipt</span>
                <span className="truth-sm text-ink-ghost">#AC-2026-0042</span>
              </div>
              <div className="divider" />
              <div className="receipt-preview__items">
                {[
                  { name: 'Sony WH-1000XM5', qty: 1, price: '₹29,999' },
                  { name: 'Logitech MX Master 3S', qty: 1, price: '₹8,999' },
                  { name: 'Atomic Habits', qty: 2, price: '₹1,198' },
                ].map((item) => (
                  <div key={item.name} className="receipt-preview__row">
                    <span className="body-sm">{item.name} × {item.qty}</span>
                    <span className="truth-sm">{item.price}</span>
                  </div>
                ))}
              </div>
              <div className="divider-dashed" />
              <div className="receipt-preview__row">
                <span className="body-sm text-ink-soft">Discount (WELCOME10)</span>
                <span className="truth-sm text-signal">−₹500</span>
              </div>
              <div className="divider" />
              <div className="receipt-preview__row receipt-preview__total">
                <span className="body-md font-semibold">Total</span>
                <span className="truth-lg text-signal verified-badge">
                  <i className="fa-solid fa-circle-check" style={{ fontSize: 15 }} />
                  ₹39,696
                </span>
              </div>
              <div className="receipt-preview__footer">
                <span className="label-caps text-signal">
                  <i className="fa-solid fa-check" style={{ marginRight: 4 }} />Policy Verified · Webhook Confirmed
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Test Credentials Banner ─── */}
      <section className="home-test-creds">
        <div className="container">
          <div className="test-creds__inner">
            <div className="test-creds__label">
              <i className="fa-solid fa-flask" />
              <span>Demo Credentials — Click to auto-fill</span>
            </div>
            <div className="test-creds__cards">
              <button
                className="test-creds__card"
                onClick={() => openWithCreds('customer@test.com', 'Pass@1234')}
              >
                <div className="test-creds__role">
                  <i className="fa-solid fa-user" /> Customer
                </div>
                <div className="test-creds__detail">customer@test.com</div>
                <div className="test-creds__detail test-creds__pwd">Pass@1234</div>
              </button>
              <button
                className="test-creds__card test-creds__card--merchant"
                onClick={() => { setPrefill({ email: 'merchant@test.com', password: 'Pass@1234' }); navigate('/?modal=merchant') }}
              >
                <div className="test-creds__role">
                  <i className="fa-solid fa-store" /> Merchant
                </div>
                <div className="test-creds__detail">merchant@test.com</div>
                <div className="test-creds__detail test-creds__pwd">Pass@1234</div>
              </button>
            </div>
            <div className="test-creds__hint">
              <i className="fa-solid fa-credit-card" style={{ marginRight: 6 }} />
              Razorpay test card: <strong>4111 1111 1111 1111</strong> · Any expiry · Any CVV
            </div>
          </div>
        </div>
      </section>

      {/* ─── Feature Pillars ─── */}
      <section className="home-pillars">
        <div className="container">
          <div className="home-pillars__grid">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="pillar-card card card-padded">
                <div className="pillar-card__icon-wrap">
                  <i className={pillar.icon} />
                </div>
                <h3 className="headline-md pillar-card__title">{pillar.title}</h3>
                <p className="body-sm text-ink-soft">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Category Grid ─── */}
      <section className="home-categories">
        <div className="container">
          <div className="home-categories__head">
            <h2 className="headline-md">Browse by Category</h2>
          </div>
          <div className="home-categories__grid">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                className="category-card"
                id={`category-${cat.slug.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => navigate('/?modal=login')}
              >
                <div className="category-card__icon-wrap">
                  <i className={cat.icon} />
                </div>
                <span className="body-sm font-medium">{cat.name}</span>
              </button>
            ))}
          </div>
          <p className="home-categories__cta-hint body-sm text-ink-soft">
            <Link to="/?modal=login" className="text-signal">Sign in</Link>
            {' '}to browse all products across every registered store
          </p>
        </div>
      </section>
    </div>
  )
}
