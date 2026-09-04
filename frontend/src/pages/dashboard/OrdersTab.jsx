import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import useDashboardStore from '../../store/dashboardStore'

const STATUS_FILTERS = ['All', 'pending', 'confirmed', 'paid', 'shipped', 'in_transit', 'delivered', 'failed', 'refunded']

function StatusBadge({ status }) {
  return <span className={`status-badge ${status}`}>{status.replace(/_/g, ' ')}</span>
}

export default function OrdersTab() {
  const { store } = useOutletContext()
  const { orders, loading, fetchOrders, updateOrderStatus } = useDashboardStore()
  const [activeFilter, setActiveFilter] = useState('All')
  const [trackingModal, setTrackingModal] = useState(null)
  const [trackForm, setTrackForm] = useState({ status: '', tracking_link: '', tracking_carrier: '' })
  const [saving, setSaving] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState(null)

  useEffect(() => {
    fetchOrders(store.id, activeFilter !== 'All' ? { status: activeFilter } : {})
  }, [store.id, activeFilter])

  const handleOpenTracking = (order) => {
    setTrackForm({
      status: order.status,
      tracking_link: order.tracking_link || '',
      tracking_carrier: order.tracking_carrier || ''
    })
    setTrackingModal(order)
  }

  const handleSaveStatus = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await updateOrderStatus(trackingModal.id, store.id, {
        status: trackForm.status,
        tracking_link: trackForm.tracking_link || null,
        tracking_carrier: trackForm.tracking_carrier || null
      })
      setTrackingModal(null)
    } catch (e) {
      alert(e.response?.data?.detail || e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="dashboard-page-header">
        <h1>🚚 Order Fulfillment</h1>
        <p>Manage the order pipeline, update statuses, and dispatch tracking info</p>
      </div>

      {/* Status Filter Chips */}
      <div className="db-filter-bar">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            className={`db-chip ${activeFilter === f ? 'active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Orders ({orders.length})</h3>
        </div>

        {loading.orders ? (
          <div className="db-loading">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="db-empty-state">
            <div className="db-empty-icon">🚚</div>
            <p className="db-empty-text">No orders found.</p>
          </div>
        ) : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Order #</th><th>Customer</th><th>Items</th>
                  <th>Total</th><th>Coupon</th><th>Status</th><th>Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <>
                    <tr
                      key={o.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                    >
                      <td>
                        <code style={{ fontWeight: 700, fontSize: '0.82rem' }}>{o.order_number}</code>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{o.user_name || 'Guest'}</div>
                        {o.user_email && <div style={{ fontSize: '0.72rem', color: '#8b949e' }}>{o.user_email}</div>}
                      </td>
                      <td>{o.items?.length || 0} item{(o.items?.length || 0) !== 1 ? 's' : ''}</td>
                      <td style={{ fontWeight: 600 }}>₹{(o.total_paise / 100).toLocaleString('en-IN')}</td>
                      <td>
                        {o.applied_coupon_code
                          ? <code style={{ background: '#f0f2f4', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.78rem' }}>{o.applied_coupon_code}</code>
                          : <span style={{ color: '#8b949e' }}>—</span>}
                      </td>
                      <td><StatusBadge status={o.status} /></td>
                      <td style={{ fontSize: '0.78rem', color: '#57606a' }}>
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          className="db-btn db-btn-secondary db-btn-sm"
                          onClick={e => { e.stopPropagation(); handleOpenTracking(o) }}
                        >
                          Update Status
                        </button>
                      </td>
                    </tr>
                    {expandedOrder === o.id && o.items?.length > 0 && (
                      <tr key={`${o.id}-detail`}>
                        <td colSpan={8} style={{ background: '#f6f8fa', padding: '0.75rem 1rem' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#57606a', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Order Items
                          </div>
                          {o.items.map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid #e1e4e8', fontSize: '0.85rem' }}>
                              <span style={{ color: '#24292f' }}>{item.product_name} × {item.quantity}</span>
                              <span style={{ fontWeight: 600, color: '#16a34a' }}>₹{(item.subtotal_paise / 100).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                          {o.tracking_link && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
                              <span style={{ color: '#57606a' }}>{o.tracking_carrier || 'Carrier'}: </span>
                              <a href={o.tracking_link} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>Track shipment →</a>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tracking / Status Modal */}
      {trackingModal && (
        <div className="db-modal-overlay" onClick={() => setTrackingModal(null)}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <div className="db-modal-header">
              <h3 className="db-modal-title">Update Order {trackingModal.order_number}</h3>
              <button className="db-modal-close" onClick={() => setTrackingModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveStatus}>
              <div className="db-form-group">
                <label className="db-label">New Status *</label>
                <select
                  className="db-select"
                  value={trackForm.status}
                  onChange={e => setTrackForm(p => ({ ...p, status: e.target.value }))}
                  required
                >
                  {['pending','confirmed','paid','shipped','in_transit','delivered','cancelled','refunded'].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="db-form-group">
                <label className="db-label">Tracking Carrier</label>
                <input
                  className="db-input"
                  value={trackForm.tracking_carrier}
                  onChange={e => setTrackForm(p => ({ ...p, tracking_carrier: e.target.value }))}
                  placeholder="Delhivery / BlueDart / FedEx"
                />
              </div>
              <div className="db-form-group">
                <label className="db-label">Tracking Link</label>
                <input
                  className="db-input"
                  value={trackForm.tracking_link}
                  onChange={e => setTrackForm(p => ({ ...p, tracking_link: e.target.value }))}
                  placeholder="https://track.delhivery.com/..."
                />
              </div>
              <div className="db-form-actions">
                <button type="button" className="db-btn db-btn-secondary" onClick={() => setTrackingModal(null)}>Cancel</button>
                <button type="submit" className="db-btn db-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Update Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
