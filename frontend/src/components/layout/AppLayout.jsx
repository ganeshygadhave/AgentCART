import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import Header from './Header'
import CartSidebar from '../cart/CartSidebar'
import AgentChat from '../agent/AgentChat'
import useCartStore from '../../store/cartStore'
import useAuthStore from '../../store/authStore'
import useAgentStore from '../../store/agentStore'
import './AppLayout.css'

export default function AppLayout() {
  const initCart = useCartStore((s) => s.initCart)
  const { isAuthenticated, loadFromStorage, initialized } = useAuthStore()
  const { isEnabled, toggleEnabled, isOpen, openChat, closeChat } = useAgentStore()
  const hasLoaded = useRef(false)
  const cartInitialized = useRef(false)

  // Restore auth session from stored JWT — run only ONCE on mount
  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true
      loadFromStorage()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Init cart AFTER auth is fully settled and token is in localStorage
  useEffect(() => {
    if (isAuthenticated && initialized && !cartInitialized.current) {
      cartInitialized.current = true
      // Small tick to ensure localStorage token is written before cart API call
      setTimeout(() => {
        initCart().catch(err => {
          console.warn('[AppLayout] Cart init error (non-fatal):', err?.message)
        })
      }, 50)
    }
    // Reset cart init flag on logout so re-login re-inits cart
    if (!isAuthenticated) {
      cartInitialized.current = false
    }
  }, [isAuthenticated, initialized, initCart])

  return (
    <div className="app-layout">
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
      {isAuthenticated && initialized && (
        <>
          <CartSidebar />
          {isEnabled && <AgentChat />}

          {/* ─── Agent Toggle FAB (bottom-right, visible when chat is closed) ─── */}
          {!isOpen && (
            <button
              id="agent-toggle-fab"
              className="agent-fab agent-fab--enabled"
              onClick={openChat}
              aria-label="Open AgentCART"
              title="Open Agent Chat"
            >
              <span className="agent-fab__pulse" aria-hidden="true" />
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="agent-fab__label">AgentCART</span>
            </button>
          )}
        </>
      )}
    </div>
  )
}
