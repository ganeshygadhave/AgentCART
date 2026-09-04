import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import useDashboardStore from '../../store/dashboardStore'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'

const fmt  = (paise)  => `₹${(paise  / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmtR = (rupees) => `₹${Number(rupees).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

/* ── KPI Card ───────────────────────────────────────────────── */
function KpiCard({ faIcon, label, value, sub, colorClass }) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon ${colorClass}`}>
        <i className={`fa-solid ${faIcon}`} />
      </div>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

/* ── Custom Recharts Tooltip ────────────────────────────────── */
function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1B2430',
      border: '1px solid rgba(255,255,255,0.1)',
      padding: '8px 12px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
      color: '#FAF8F4',
    }}>
      <div style={{ color: 'rgba(250,248,244,0.5)', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{`₹${Number(payload[0].value).toLocaleString('en-IN')}`}</div>
      {payload[1] && (
        <div style={{ color: 'rgba(250,248,244,0.6)', fontSize: 11, marginTop: 2 }}>
          {payload[1].value} {payload[1].value === 1 ? 'order' : 'orders'}
        </div>
      )}
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────────── */
export default function DashboardOverviewTab() {
  const { store } = useOutletContext()
  const { analytics, lowStock, loading, fetchAnalytics } = useDashboardStore()

  useEffect(() => { fetchAnalytics(store.id) }, [store.id])

  if (loading.analytics) {
    return (
      <div className="db-loading">
        <div className="db-spinner" />
        Loading analytics…
      </div>
    )
  }

  if (!analytics) return (
    <div>
      <div className="dashboard-page-header">
        <div className="dashboard-page-header-left">
          <h1>
            <i className="fa-solid fa-chart-line" style={{ color: 'var(--color-signal)', fontSize: 18 }} />
            Store Overview
          </h1>
          <p>No data yet — place some orders to see analytics appear here.</p>
        </div>
      </div>
      <div className="db-empty-state">
        <div className="db-empty-icon">
          <i className="fa-solid fa-chart-bar" />
        </div>
        <p className="db-empty-text">
          No orders yet. Your revenue charts and KPIs will appear here once customers start buying.
        </p>
      </div>
    </div>
  )

  const chartData = (analytics.revenue_by_day || []).map(d => ({
    date: d.date.slice(5),
    revenue: d.revenue_paise / 100,
    orders: d.order_count
  }))

  return (
    <div>
      {/* Page Header */}
      <div className="dashboard-page-header">
        <div className="dashboard-page-header-left">
          <h1>
            <i className="fa-solid fa-chart-line" style={{ color: 'var(--color-signal)', fontSize: 18 }} />
            Store Overview
          </h1>
          <p>Revenue, orders, and performance metrics for <strong>{store.name}</strong></p>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="low-stock-strip">
          <i className="fa-solid fa-triangle-exclamation" />
          <strong>{lowStock.length} product{lowStock.length > 1 ? 's' : ''} running low on stock:</strong>
          {lowStock.slice(0, 3).map(p => (
            <span key={p.id} style={{
              background: 'rgba(180,83,9,0.1)',
              border: '1px solid #fcd34d',
              padding: '1px 8px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
            }}>
              {p.name} ({p.stock_quantity} left)
            </span>
          ))}
          {lowStock.length > 3 && (
            <span style={{ color: '#92400e', fontWeight: 700 }}>+{lowStock.length - 3} more</span>
          )}
        </div>
      )}

      {/* KPI Grid */}
      <div className="kpi-grid">
        <KpiCard
          faIcon="fa-indian-rupee-sign"
          label="Total Revenue"
          value={fmtR(analytics.total_revenue)}
          sub="All paid orders"
          colorClass="green"
        />
        <KpiCard
          faIcon="fa-box"
          label="Total Orders"
          value={analytics.order_count.toLocaleString()}
          sub="Paid & delivered"
          colorClass="blue"
        />
        <KpiCard
          faIcon="fa-receipt"
          label="Avg Order Value"
          value={fmtR(analytics.avg_order_value)}
          sub="Per order"
          colorClass="purple"
        />
        <KpiCard
          faIcon="fa-rotate-left"
          label="Refunds"
          value={analytics.refund_count}
          sub="Orders refunded"
          colorClass="amber"
        />
        <KpiCard
          faIcon="fa-circle-xmark"
          label="Failed Payments"
          value={analytics.failed_payment_count}
          sub="Payment failures"
          colorClass="red"
        />
      </div>

      {/* Revenue Chart */}
      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">
            <i className="fa-solid fa-chart-area" style={{ color: 'var(--color-signal)' }} />
            Revenue — Last 7 Days
          </h3>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: 'var(--color-ink-ghost)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {chartData.length} days
          </span>
        </div>
        {chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-ink-ghost)', fontSize: 14 }}>
            No revenue data in the last 7 days.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3F6E5B" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3F6E5B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D3C7" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#828B9A', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={{ stroke: '#D9D3C7' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#828B9A', fontFamily: 'JetBrains Mono, monospace' }}
                tickFormatter={v => v === 0 ? '₹0' : `₹${(v / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3F6E5B"
                strokeWidth={2}
                fill="url(#revenueGrad)"
                dot={{ fill: '#3F6E5B', r: 3, strokeWidth: 0 }}
                activeDot={{ fill: '#3F6E5B', r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Products */}
      {analytics.top_products?.length > 0 && (
        <div className="db-card">
          <div className="db-card-header">
            <h3 className="db-card-title">
              <i className="fa-solid fa-trophy" style={{ color: '#b45309' }} />
              Top Products by Revenue
            </h3>
          </div>
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Product</th>
                  <th>Units Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analytics.top_products.map((p, i) => (
                  <tr key={p.product_id}>
                    <td>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--color-ink-ghost)',
                      }}>{String(i + 1).padStart(2, '0')}</span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{p.product_name}</td>
                    <td>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {p.units_sold.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--color-signal)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {fmt(p.revenue_paise)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
