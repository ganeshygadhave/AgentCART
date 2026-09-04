import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usersApi } from '../services/api'
import { formatPrice } from '../utils/helpers'
import './OrdersPage.css'

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedOrders, setExpandedOrders] = useState({})

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await usersApi.getOrders()
        setOrders(res.data?.orders || [])
      } catch (error) {
        console.error('Failed to fetch orders', error)
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [])

  const toggleOrder = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }))
  }

  const getStatusClass = (status) => {
    const s = (status || '').toLowerCase()
    if (['pending'].includes(s)) return 'status-yellow'
    if (['confirmed', 'paid', 'delivered'].includes(s)) return 'status-green'
    if (['failed', 'cancelled'].includes(s)) return 'status-red'
    return 'status-default'
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="orders-page">
        <div className="orders-page__header">
          <h1 className="orders-page__title">My Orders</h1>
        </div>
        <div className="orders-loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="orders-skeleton" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="orders-page">
      <div className="orders-page__header">
        <h1 className="orders-page__title">My Orders</h1>
        {orders.length > 0 && (
          <p className="orders-page__subtitle">
            {orders.length} order{orders.length !== 1 ? 's' : ''} placed
          </p>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="empty-orders">
          <span className="empty-orders__icon">📦</span>
          <h2 className="empty-orders__title">No orders yet</h2>
          <p className="empty-orders__subtitle">You haven't placed any orders. Start exploring our catalogue!</p>
          <Link to="/catalogue" className="btn btn-primary">Browse Catalogue</Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => {
            const isExpanded = !!expandedOrders[order.id]

            return (
              <div key={order.id} className="order-card">
                {/* ── Summary Row ── */}
                <div className="order-summary" onClick={() => toggleOrder(order.id)}>
                  <div className="order-summary-left">
                    <span className="order-number">
                      #{order.order_number || order.id}
                    </span>
                    <span className="order-date">
                      <i className="fa-regular fa-calendar" />
                      {formatDate(order.created_at)}
                    </span>
                  </div>
                  <div className="order-summary-right">
                    <span className={`status-badge ${getStatusClass(order.status)}`}>
                      {order.status}
                    </span>
                    <span className="order-total">{formatPrice(order.total)}</span>
                    <div className={`expand-btn ${isExpanded ? 'open' : ''}`}>
                      <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`} />
                    </div>
                  </div>
                </div>

                {/* ── Details Panel ── */}
                {isExpanded && (
                  <div className="order-details">
                    {/* Store chip */}
                    {order.store_name && (
                      <div>
                        <div className="order-store-chip">
                          <i className="fa-solid fa-store" />
                          {order.store_name}
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    <div>
                      <p className="detail-section-label">
                        <i className="fa-solid fa-box" style={{ marginRight: 6 }} />
                        Items
                      </p>
                      <div className="items-table">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="item-row">
                            <div>
                              <span className="item-name">{item.product_name}</span>
                              <span className="item-qty">×{item.quantity}</span>
                            </div>
                            <span className="item-price">{formatPrice(item.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Billing */}
                    <div>
                      <p className="detail-section-label">
                        <i className="fa-solid fa-receipt" style={{ marginRight: 6 }} />
                        Billing
                      </p>
                      <div className="billing-card">
                        <div className="billing-row">
                          <span>Subtotal</span>
                          <span>{formatPrice(order.subtotal)}</span>
                        </div>
                        {order.discount > 0 && (
                          <div className="billing-row billing-row--discount">
                            <span>
                              <i className="fa-solid fa-tag" style={{ marginRight: 6 }} />
                              Discount {order.applied_coupon ? `(${order.applied_coupon})` : ''}
                            </span>
                            <span>−{formatPrice(order.discount)}</span>
                          </div>
                        )}
                        <div className="billing-row billing-row--total">
                          <span>Total</span>
                          <span>{formatPrice(order.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Shipping Address */}
                    {order.shipping_address && (
                      <div>
                        <p className="detail-section-label">
                          <i className="fa-solid fa-location-dot" style={{ marginRight: 6 }} />
                          Shipping Address
                        </p>
                        <div className="shipping-box">
                          <strong>{order.shipping_address.full_name}</strong><br />
                          {order.shipping_address.street_address}<br />
                          {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.pincode}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
