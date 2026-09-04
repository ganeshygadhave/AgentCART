import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import useAuthStore from '../../store/authStore'
import useCartStore from '../../store/cartStore'
import './Header.css'

export default function Header() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const { itemCount, openCart } = useCartStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = () => {
    logout()
    setDropdownOpen(false)
    setMobileMenuOpen(false)
    navigate('/')
  }

  return (
    <header className="header">
      <div className="header__inner container">
        {/* ─── Wordmark ─── */}
        <Link to="/" className="header__wordmark" onClick={() => setMobileMenuOpen(false)}>
          <span className="header__wordmark-agent">Agent</span>
          <span className="header__wordmark-cart">CART</span>
        </Link>

        {/* ─── Desktop Nav ─── */}
        <nav className="header__nav" aria-label="Main navigation">
          {isAuthenticated && (
            <NavLink
              to="/catalogue"
              className={({ isActive }) =>
                `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`
              }
            >
              Catalogue
            </NavLink>
          )}
        </nav>

        {/* ─── Desktop Actions ─── */}
        <div className="header__actions">
          {isAuthenticated && (
            <>
              {/* Cart Icon Button */}
              <button
                className="header__cart-btn"
                onClick={openCart}
                aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
                id="header-cart-btn"
              >
                <i className="fa-solid fa-bag-shopping" style={{ fontSize: 15 }} />
                {itemCount > 0 && (
                  <span className="header__cart-badge">{itemCount > 99 ? '99+' : itemCount}</span>
                )}
              </button>

              {/* Profile Dropdown */}
              <div className="header__user-menu" ref={dropdownRef}>
                <button
                  className="header__user-btn"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-label="User menu"
                  aria-expanded={dropdownOpen}
                >
                  <div className="header__user-avatar">
                    <i className="fa-solid fa-user" style={{ fontSize: 13 }} />
                  </div>
                  <span className="header__user-name">{user?.name?.split(' ')[0]}</span>
                  <i className={`fa-solid fa-chevron-down header__chevron-icon ${dropdownOpen ? 'open' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="header__dropdown">
                    <Link
                      to="/profile"
                      className="header__dropdown-info header__dropdown-info--link"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="label-caps" style={{ fontSize: 10 }}>SIGNED IN AS</span>
                      <span className="truth-sm" style={{ marginTop: 2 }}>{user?.name}</span>
                      <span className="truth-sm text-ink-ghost" style={{ fontSize: 11 }}>
                        {user?.email || user?.phone}
                      </span>
                    </Link>
                    <div className="header__dropdown-divider" />
                    <Link to="/catalogue" className="header__dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <i className="fa-solid fa-boxes-stacked" /> All Products
                    </Link>
                    <Link to="/orders" className="header__dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <i className="fa-solid fa-receipt" /> My Orders
                    </Link>
                    {user?.owned_store && (
                      <Link to="/dashboard" className="header__dropdown-item" onClick={() => setDropdownOpen(false)} style={{ color: '#6366f1', fontWeight: 600 }}>
                        <i className="fa-solid fa-store" /> My Dashboard
                      </Link>
                    )}
                    <div className="header__dropdown-divider" />
                    <button className="header__dropdown-item header__dropdown-item--danger" onClick={handleLogout}>
                      <i className="fa-solid fa-right-from-bracket" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ─── Mobile Hamburger ─── */}
          <button
            className="header__hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`} />
          </button>
        </div>
      </div>

      {/* ─── Mobile Drawer ─── */}
      {mobileMenuOpen && (
        <div className="header__mobile-menu">
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className="header__mobile-user header__mobile-user--link"
                onClick={() => setMobileMenuOpen(false)}
              >
                <i className="fa-solid fa-circle-user header__mobile-user-icon" />
                <div>
                  <p className="body-sm font-semibold">{user?.name}</p>
                  <p className="truth-sm text-ink-ghost">{user?.email || user?.phone}</p>
                </div>
                <i className="fa-solid fa-chevron-right" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-ink-ghost)' }} />
              </Link>
              <div className="header__dropdown-divider" />
              <Link to="/catalogue" className="header__mobile-link" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-store" /> Browse Catalogue
              </Link>
              <Link to="/orders" className="header__mobile-link" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-receipt" /> My Orders
              </Link>
              {user?.owned_store && (
                <Link to="/dashboard" className="header__mobile-link" onClick={() => setMobileMenuOpen(false)} style={{ color: '#6366f1', fontWeight: 600 }}>
                  <i className="fa-solid fa-store" /> My Dashboard
                </Link>
              )}
              <div className="header__dropdown-divider" />
              <button className="header__mobile-link header__mobile-link--danger" onClick={handleLogout}>
                <i className="fa-solid fa-right-from-bracket" /> Sign Out
              </button>
            </>
          ) : (
            // Unauthenticated: no links shown in mobile drawer
            <></>
          )}
        </div>
      )}
    </header>
  )
}
