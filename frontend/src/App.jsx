import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'

// ── Lazy-load all pages so the initial JS bundle is small ─────────────────
const HomePage              = lazy(() => import('./pages/HomePage'))
const CataloguePage         = lazy(() => import('./pages/CataloguePage'))
const ProductDetailPage     = lazy(() => import('./pages/ProductDetailPage'))
const CheckoutPage          = lazy(() => import('./pages/CheckoutPage'))
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage'))
const ProfilePage           = lazy(() => import('./pages/ProfilePage'))
const OrdersPage            = lazy(() => import('./pages/OrdersPage'))
const StorePage             = lazy(() => import('./pages/StorePage'))
const DashboardPage         = lazy(() => import('./pages/DashboardPage'))
const DashboardOverviewTab  = lazy(() => import('./pages/dashboard/DashboardOverviewTab'))
const AgentConfigTab        = lazy(() => import('./pages/dashboard/AgentConfigTab'))
const PoliciesTab           = lazy(() => import('./pages/dashboard/PoliciesTab'))
const ProductsTab           = lazy(() => import('./pages/dashboard/ProductsTab'))
const OrdersTab             = lazy(() => import('./pages/dashboard/OrdersTab'))
const AuditTab              = lazy(() => import('./pages/dashboard/AuditTab'))

// ── Minimal full-page spinner shown while a chunk loads ───────────────────
function PageLoader() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 14,
      color: '#828B9A',
    }}>
      <span style={{
        width: 20,
        height: 20,
        border: '2px solid #D9D3C7',
        borderTopColor: '#3F6E5B',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        display: 'inline-block',
      }} />
      Loading…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/**
 * AgentCART — Main Router
 *
 * The AgentToggleWidget is NOT mounted here. On the main AgentCART site,
 * logged-in customers use the full catalogue + existing AgentChat panel.
 * The AgentToggleWidget is only for embedding on third-party store websites
 * (injected separately via their own script/embed code).
 */
export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Main app with shared AppLayout navbar */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="catalogue" element={<CataloguePage />} />
          <Route path="product/:id" element={<ProductDetailPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="order/:orderId" element={<OrderConfirmationPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="store/:storeSlug" element={<StorePage />} />
        </Route>

        {/* Merchant Dashboard — standalone layout with its own sidebar */}
        <Route path="/dashboard" element={<DashboardPage />}>
          <Route index element={<DashboardOverviewTab />} />
          <Route path="agent" element={<AgentConfigTab />} />
          <Route path="policies" element={<PoliciesTab />} />
          <Route path="products" element={<ProductsTab />} />
          <Route path="orders" element={<OrdersTab />} />
          <Route path="audit" element={<AuditTab />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
