import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import useDashboardStore from '../store/dashboardStore'
import { merchantApi, usersApi } from '../services/api'
import './DashboardPage.css'

const NAV_ITEMS = [
  { icon: 'fa-chart-line',    label: 'Overview',   to: '/dashboard' },
  { icon: 'fa-robot',         label: 'AI Agent',   to: '/dashboard/agent' },
  { icon: 'fa-tag',           label: 'Policies',   to: '/dashboard/policies' },
  { icon: 'fa-box',           label: 'Products',   to: '/dashboard/products' },
  { icon: 'fa-truck',         label: 'Orders',     to: '/dashboard/orders' },
  { icon: 'fa-shield-halved', label: 'Audit Log',  to: '/dashboard/audit' },
]

/* ── Merchant Profile Panel ─────────────────────────────────── */
function MerchantProfilePanel({ user, store, onClose, onSignOut, onProfileUpdated }) {
  const initials      = user?.name?.slice(0, 2).toUpperCase() || 'M'
  const storeInitials = store?.name?.slice(0, 2).toUpperCase() || 'ST'
  const memberSince   = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
    : '—'

  // ── Copy store link ────────────────────────────────────────
  const [copied, setCopied] = useState(false)
  const storeUrl = `${window.location.origin}/store/${store?.slug}`
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for insecure contexts
      const el = document.createElement('textarea')
      el.value = storeUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ── Edit profile ───────────────────────────────────────────
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveOk, setSaveOk]     = useState(false)
  const [form, setForm] = useState({
    name:  user?.name  || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setSaveError(null); setSaveOk(false)
    try {
      const res = await usersApi.updateProfile({
        name:  form.name.trim()  || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      })
      onProfileUpdated(res.data)
      setSaveOk(true)
      setTimeout(() => { setSaveOk(false); setEditing(false) }, 1200)
    } catch (err) {
      setSaveError(err.response?.data?.detail || err.message)
    } finally {
      setSaving(false)
    }
  }


  return (
    <>
      {/* Backdrop */}
      <div className="profile-panel-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="profile-panel" role="dialog" aria-label="Merchant Profile">

        {/* Header */}
        <div className="profile-panel__header">
          <span style={{ fontFamily: 'var(--font-truth)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(250,248,244,0.4)' }}>
            MERCHANT ACCOUNT
          </span>
          <button className="profile-panel__close" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Identity */}
        <div className="profile-panel__identity">
          <div className="profile-panel__avatar">{initials}</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p className="profile-panel__name">{user?.name || 'Merchant'}</p>
            <p className="profile-panel__email">{user?.email || '—'}</p>
            {user?.phone && (
              <p className="profile-panel__phone">
                <i className="fa-solid fa-phone" style={{ fontSize: 9, marginRight: 5 }} />
                {user.phone}
              </p>
            )}
          </div>
          <button
            className="profile-panel__edit-btn"
            onClick={() => { setEditing(v => !v); setSaveError(null) }}
            title={editing ? 'Cancel editing' : 'Edit profile'}
          >
            <i className={`fa-solid ${editing ? 'fa-xmark' : 'fa-pen'}`} />
          </button>
        </div>

        {/* ── Edit Profile Form ─── */}
        {editing && (
          <form onSubmit={handleSave} className="profile-panel__edit-form">
            {saveError && (
              <div className="profile-panel__alert-error">
                <i className="fa-solid fa-circle-exclamation" /> {saveError}
              </div>
            )}
            {saveOk && (
              <div className="profile-panel__alert-ok">
                <i className="fa-solid fa-circle-check" /> Saved successfully
              </div>
            )}
            <div className="profile-panel__field">
              <label className="profile-panel__field-label">Full Name</label>
              <input
                className="profile-panel__field-input"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Your full name"
                required
              />
            </div>
            <div className="profile-panel__field">
              <label className="profile-panel__field-label">Email</label>
              <input
                className="profile-panel__field-input"
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
              />
            </div>
            <div className="profile-panel__field">
              <label className="profile-panel__field-label">Phone</label>
              <input
                className="profile-panel__field-input"
                type="tel"
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+91 9876543210"
              />
            </div>
            <div className="profile-panel__edit-actions">
              <button type="button" className="profile-panel__btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="profile-panel__btn-primary" disabled={saving}>
                {saving
                  ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</>
                  : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
              </button>
            </div>
          </form>
        )}

        <div className="profile-panel__divider" />

        {/* Store Info */}
        {store && (
          <>
            <p className="profile-panel__section-label">
              <i className="fa-solid fa-store" style={{ marginRight: 6 }} />
              STORE DETAILS
            </p>

            <div className="profile-panel__store-card">
              <div className="profile-panel__store-avatar">{storeInitials}</div>
              <div className="profile-panel__store-info">
                <p className="profile-panel__store-name">{store.name}</p>
                <p className="profile-panel__store-slug">
                  <i className="fa-solid fa-link" style={{ fontSize: 9, marginRight: 4 }} />
                  {storeUrl.replace(/^https?:\/\//, '')}
                </p>
              </div>
              {/* Copy store link */}
              <button
                className="profile-panel__copy-btn"
                onClick={handleCopy}
                title="Copy store link"
                aria-label="Copy store link"
              >
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
              </button>
            </div>

            <div className="profile-panel__meta-grid">
              <div className="profile-panel__meta-item">
                <span className="profile-panel__meta-label">STORE ID</span>
                <span className="profile-panel__meta-value profile-panel__meta-mono">
                  {store.id?.slice(0, 8).toUpperCase()}…
                </span>
              </div>
              <div className="profile-panel__meta-item">
                <span className="profile-panel__meta-label">STATUS</span>
                <span className="profile-panel__meta-value profile-panel__status-active">
                  <i className="fa-solid fa-circle" style={{ fontSize: 7, marginRight: 5 }} />
                  Active
                </span>
              </div>
              {store.public_api_key && (
                <div className="profile-panel__meta-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="profile-panel__meta-label">PUBLIC API KEY</span>
                  <span className="profile-panel__meta-value profile-panel__meta-mono" style={{ fontSize: 10 }}>
                    {store.public_api_key}
                  </span>
                </div>
              )}
              <div className="profile-panel__meta-item">
                <span className="profile-panel__meta-label">MEMBER SINCE</span>
                <span className="profile-panel__meta-value">{memberSince}</span>
              </div>
            </div>

            <div className="profile-panel__divider" />
          </>
        )}


        {/* Sign Out */}
        <button className="profile-panel__signout" onClick={onSignOut}>
          <i className="fa-solid fa-arrow-right-from-bracket" />
          Sign Out
        </button>
      </div>
    </>
  )
}

/* ── Main Dashboard Page ────────────────────────────────────── */
export default function DashboardPage() {
  const { user, isAuthenticated, logout, loadFromStorage } = useAuthStore()
  const { store, fetchStore, loading } = useDashboardStore()
  const navigate = useNavigate()
  const [showCreateStore, setShowCreateStore] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', slug: '', domain: '' })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return }
    fetchStore()
  }, [isAuthenticated])

  const handleCreateStore = async (e) => {
    e.preventDefault()
    setCreateLoading(true); setCreateError(null)
    try {
      await merchantApi.register(createForm)
      await fetchStore()
      setShowCreateStore(false)
    } catch (err) {
      setCreateError(err.response?.data?.detail || err.message)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleSignOut = () => {
    setProfileOpen(false)
    logout()
    navigate('/')
  }

  // After profile edit, refresh user state from server
  const handleProfileUpdated = async () => {
    await loadFromStorage()
  }

  if (loading.store) {
    return (
      <div className="db-full-loader">
        <div className="db-spinner" />
        <span>Loading dashboard…</span>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="create-store-prompt">
        <div className="create-store-card">
          <div className="create-store-icon-wrap">
            <i className="fa-solid fa-store" />
          </div>
          <h2>Launch Your Store</h2>
          <p>
            You don't have a store yet. Create one to access the full merchant
            dashboard — manage products, track orders, and configure your AI sales agent.
          </p>
          {!showCreateStore ? (
            <button className="db-btn db-btn-primary db-btn-full" onClick={() => setShowCreateStore(true)}>
              <i className="fa-solid fa-plus" /> Create Your Store
            </button>
          ) : (
            <form onSubmit={handleCreateStore} style={{ textAlign: 'left', marginTop: '1.5rem' }}>
              {createError && <div className="db-alert db-alert-error">{createError}</div>}
              <div className="db-form-group">
                <label className="db-label">Store Name</label>
                <input
                  className="db-input" required
                  value={createForm.name}
                  onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="My Awesome Store"
                />
              </div>
              <div className="db-form-group">
                <label className="db-label">Store Slug <span style={{ fontWeight: 400, color: '#8b949e' }}>(URL identifier)</span></label>
                <input
                  className="db-input" required
                  value={createForm.slug}
                  onChange={e => setCreateForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="my-awesome-store"
                />
              </div>
              <div className="db-form-group">
                <label className="db-label">Domain <span style={{ fontWeight: 400, color: '#8b949e' }}>(optional)</span></label>
                <input
                  className="db-input"
                  value={createForm.domain}
                  onChange={e => setCreateForm(p => ({ ...p, domain: e.target.value }))}
                  placeholder="mystore.com"
                />
              </div>
              <div className="db-form-row" style={{ marginTop: '1rem' }}>
                <button type="button" className="db-btn db-btn-ghost" onClick={() => setShowCreateStore(false)}>
                  Cancel
                </button>
                <button type="submit" className="db-btn db-btn-primary" disabled={createLoading}>
                  {createLoading
                    ? <><i className="fa-solid fa-spinner fa-spin" /> Creating…</>
                    : <><i className="fa-solid fa-rocket" /> Create Store</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }

  const initials = store.name?.slice(0, 2).toUpperCase() || 'ST'

  return (
    <div className="dashboard-layout">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Profile panel */}
      {profileOpen && (
        <MerchantProfilePanel
          user={user}
          store={store}
          onClose={() => setProfileOpen(false)}
          onSignOut={handleSignOut}
          onProfileUpdated={handleProfileUpdated}
        />
      )}

      {/* Sidebar */}
      <aside className={`dashboard-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        {/* Store identity */}
        <div className="sidebar-store-header">
          <div className="sidebar-store-avatar">{initials}</div>
          <div className="sidebar-store-info">
            <p className="sidebar-store-name">{store.name}</p>
            <p className="sidebar-store-slug">
              <i className="fa-solid fa-link" style={{ fontSize: 9, marginRight: 4 }} />
              {store.slug}
            </p>
          </div>
        </div>

        <div className="sidebar-section-label">MENU</div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sidebar-nav-icon">
                <i className={`fa-solid ${item.icon}`} />
              </span>
              <span className="sidebar-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom user badge — click to open profile */}
        <button
          className="sidebar-user-badge sidebar-user-badge--btn"
          onClick={() => setProfileOpen(true)}
          aria-label="Open merchant profile"
          title="View profile & sign out"
        >
          <div className="sidebar-user-avatar">
            <i className="fa-solid fa-user" />
          </div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user?.name || 'Merchant'}</p>
            <p className="sidebar-user-email">{user?.email || ''}</p>
          </div>
          <i className="fa-solid fa-ellipsis-vertical sidebar-user-badge__more" />
        </button>
      </aside>

      {/* Main content */}
      <div className="dashboard-main">
        {/* Mobile topbar */}
        <header className="dashboard-topbar">
          <button className="topbar-menu-btn" onClick={() => setSidebarOpen(v => !v)}>
            <i className="fa-solid fa-bars" />
          </button>
          <div className="topbar-store-name">
            <i className="fa-solid fa-store" style={{ marginRight: 6, color: 'var(--color-signal)' }} />
            {store.name}
          </div>
          <button className="topbar-avatar" onClick={() => setProfileOpen(true)} aria-label="Open profile">
            {initials}
          </button>
        </header>

        <main className="dashboard-content">
          <div className="dashboard-content-inner">
            <Outlet context={{ store }} />
          </div>
        </main>
      </div>
    </div>
  )
}
