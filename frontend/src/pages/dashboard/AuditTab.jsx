import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import useDashboardStore from '../../store/dashboardStore'

const EVENT_TYPES = [
  'All', 'agent_tool_call', 'policy_evaluation', 'cart_mutation',
  'order_state_change', 'payment_state_change', 'webhook_received'
]

export default function AuditTab() {
  const { store } = useOutletContext()
  const { auditLogs, loading, fetchAuditLogs } = useDashboardStore()
  const [filter, setFilter] = useState('All')
  const [expandedIds, setExpandedIds] = useState(new Set())

  useEffect(() => {
    fetchAuditLogs(store.id, filter !== 'All' ? { event_type: filter } : {})
  }, [store.id, filter])

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const relativeTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div>
      <div className="dashboard-page-header">
        <h1>🔍 Audit Trail</h1>
        <p>Full transparency into every AI action, policy check, and payment event in your store</p>
      </div>

      {/* Filter Chips */}
      <div className="db-filter-bar">
        {EVENT_TYPES.map(t => (
          <button
            key={t}
            className={`db-chip ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t.replace(/_/g, ' ')}
          </button>
        ))}
        <button
          className="db-btn db-btn-secondary db-btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => fetchAuditLogs(store.id, filter !== 'All' ? { event_type: filter } : {})}
        >
          ↺ Refresh
        </button>
      </div>

      {loading.auditLogs ? (
        <div className="db-loading">Loading audit logs...</div>
      ) : auditLogs.length === 0 ? (
        <div className="db-empty-state">
          <div className="db-empty-icon">🔍</div>
          <p className="db-empty-text">
            No audit logs yet. Events are logged as your store receives orders, payments, and AI interactions.
          </p>
        </div>
      ) : (
        <div className="audit-feed">
          {auditLogs.map(log => (
            <div key={log.id} className="audit-entry">
              <div className={`audit-dot ${log.event_type}`} />
              <div className="audit-body">
                <div className="audit-event-type">{log.event_type.replace(/_/g, ' ')}</div>
                <div className="audit-notes">
                  {log.notes || `${log.entity_type || ''} ${log.entity_id ? '#' + log.entity_id.slice(-8) : ''}`.trim() || 'No details'}
                </div>
                <div className="audit-meta">
                  {log.actor && <span style={{ marginRight: '0.75rem' }}>👤 {log.actor}</span>}
                  {log.outcome && (
                    <span style={{ marginRight: '0.75rem', color: log.outcome === 'success' ? '#16a34a' : '#dc2626' }}>
                      ● {log.outcome}
                    </span>
                  )}
                  {log.entity_type && <span style={{ marginRight: '0.75rem', color: '#6366f1' }}>{log.entity_type}</span>}
                </div>
                {log.payload && (
                  <div style={{ marginTop: '0.35rem' }}>
                    <button className="audit-payload-toggle" onClick={() => toggleExpand(log.id)}>
                      {expandedIds.has(log.id) ? '▲ Hide payload' : '▼ View payload'}
                    </button>
                    {expandedIds.has(log.id) && (
                      <pre className="audit-payload-json">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
              <div className="audit-time">{relativeTime(log.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
