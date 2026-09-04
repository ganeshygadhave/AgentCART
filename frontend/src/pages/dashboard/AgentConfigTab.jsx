import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import useDashboardStore from '../../store/dashboardStore'

export default function AgentConfigTab() {
  const { store } = useOutletContext()
  const { agentConfig, agentAnalytics, loading, fetchAgentConfig, saveAgentConfig, fetchAgentAnalytics } = useDashboardStore()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAgentConfig(store.id)
    fetchAgentAnalytics(store.id)
  }, [store.id])

  useEffect(() => {
    if (agentConfig) {
      setForm({
        ...agentConfig,
        no_discount_categories: agentConfig.no_discount_categories?.join(', ') || ''
      })
    }
  }, [agentConfig])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const data = {
        persona_name: form.persona_name,
        store_context: form.store_context,
        greeting_message: form.greeting_message,
        max_discount_pct: parseFloat(form.max_discount_pct) || 0,
        min_cart_for_discount_paise: parseInt(form.min_cart_for_discount_paise) || 0,
        no_discount_categories: form.no_discount_categories
          ? form.no_discount_categories.split(',').map(s => s.trim()).filter(Boolean)
          : []
      }
      await saveAgentConfig(store.id, data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading.agentConfig || !form) return <div className="db-loading">Loading agent config...</div>

  return (
    <div>
      <div className="dashboard-page-header">
        <h1>🤖 AI Agent Config</h1>
        <p>Customize your store's AI sales agent persona and discount guardrails</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Config Form */}
        <div>
          <form onSubmit={handleSave}>
            {error && (
              <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '1rem', background: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                {error}
              </div>
            )}

            <div className="db-card">
              <div className="db-card-header">
                <h3 className="db-card-title">🎭 Agent Persona</h3>
              </div>
              <div className="db-form-group">
                <label className="db-label">Agent Name</label>
                <input
                  className="db-input"
                  value={form.persona_name || ''}
                  onChange={e => setForm(p => ({ ...p, persona_name: e.target.value }))}
                  placeholder="e.g. Nova, Aria, Max"
                />
              </div>
              <div className="db-form-group">
                <label className="db-label">
                  Store Context{' '}
                  <span style={{ color: '#8b949e', fontWeight: 400 }}>(product strategy, brand tone)</span>
                </label>
                <textarea
                  className="db-textarea"
                  rows={4}
                  value={form.store_context || ''}
                  onChange={e => setForm(p => ({ ...p, store_context: e.target.value }))}
                  placeholder="We sell premium electronics. Recommend accessories after each purchase. Be concise and helpful."
                />
              </div>
              <div className="db-form-group">
                <label className="db-label">Greeting Message</label>
                <input
                  className="db-input"
                  value={form.greeting_message || ''}
                  onChange={e => setForm(p => ({ ...p, greeting_message: e.target.value }))}
                  placeholder="Hi! I'm Nova, your shopping assistant. What can I help you find today?"
                />
              </div>
            </div>

            <div className="db-card">
              <div className="db-card-header">
                <h3 className="db-card-title">🛡️ Discount Guardrails</h3>
              </div>
              <div className="db-form-group">
                <label className="db-label">
                  Max AI Discount: <strong>{form.max_discount_pct || 0}%</strong>
                </label>
                <input
                  type="range"
                  className="db-slider"
                  min="0"
                  max="30"
                  step="0.5"
                  value={form.max_discount_pct || 0}
                  onChange={e => setForm(p => ({ ...p, max_discount_pct: parseFloat(e.target.value) }))}
                />
                <div className="db-slider-label">
                  <span>0% (no discounts)</span>
                  <span>30% max</span>
                </div>
              </div>
              <div className="db-form-group">
                <label className="db-label">Minimum Cart Value for AI Discounts</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#57606a', fontSize: '0.9rem' }}>₹</span>
                  <input
                    type="number"
                    className="db-input"
                    min="0"
                    value={(form.min_cart_for_discount_paise || 0) / 100}
                    onChange={e => setForm(p => ({ ...p, min_cart_for_discount_paise: Math.round(parseFloat(e.target.value || 0) * 100) }))}
                    placeholder="3000"
                    style={{ maxWidth: '180px' }}
                  />
                </div>
              </div>
              <div className="db-form-group">
                <label className="db-label">
                  Excluded Categories{' '}
                  <span style={{ color: '#8b949e', fontWeight: 400 }}>(comma-separated, AI won't discount these)</span>
                </label>
                <input
                  className="db-input"
                  value={form.no_discount_categories || ''}
                  onChange={e => setForm(p => ({ ...p, no_discount_categories: e.target.value }))}
                  placeholder="Clearance, Gift Cards, Electronics"
                />
              </div>
            </div>

            <button
              type="submit"
              className="db-btn db-btn-primary"
              disabled={saving}
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            >
              {saving ? 'Saving...' : saved ? '✅ Saved!' : '💾 Save Agent Config'}
            </button>
          </form>
        </div>

        {/* Agent Analytics */}
        <div>
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">📈 Agent Performance</h3>
            </div>
            {loading.agentAnalytics ? (
              <div className="db-loading" style={{ padding: '1.5rem' }}>Loading...</div>
            ) : agentAnalytics ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Total Chats', value: agentAnalytics.total_conversations },
                    { label: 'Converted', value: agentAnalytics.converted_conversations },
                    { label: 'Conv. Rate', value: `${agentAnalytics.conversion_rate}%` },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#f6f8fa', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#6366f1' }}>{s.value}</div>
                      <div style={{ fontSize: '0.7rem', color: '#57606a', fontWeight: 600, marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {agentAnalytics.top_searched_queries?.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#24292f', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🔎 Top Searched Queries
                    </div>
                    {agentAnalytics.top_searched_queries.slice(0, 5).map((q, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f0f2f4' }}>
                        <span style={{ fontSize: '0.85rem', color: '#24292f' }}>"{q.query}"</span>
                        <span style={{ fontSize: '0.75rem', background: '#f0f2f4', borderRadius: '100px', padding: '0.15rem 0.5rem', fontWeight: 600 }}>{q.count}×</span>
                      </div>
                    ))}
                  </div>
                )}

                {agentAnalytics.top_recommended_products?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#24292f', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🌟 Most Recommended Products
                    </div>
                    {agentAnalytics.top_recommended_products.slice(0, 5).map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f0f2f4' }}>
                        <span style={{ fontSize: '0.85rem', color: '#24292f' }}>{p.name}</span>
                        <span style={{ fontSize: '0.75rem', background: '#f0f2f4', borderRadius: '100px', padding: '0.15rem 0.5rem', fontWeight: 600 }}>{p.count}×</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="db-empty-state" style={{ padding: '1.5rem' }}>
                <p>No agent data yet. Start chatting to see performance metrics!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
