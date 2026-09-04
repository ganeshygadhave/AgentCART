import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import useDashboardStore from '../../store/dashboardStore'

const EMPTY_FORM = {
  code: '', description: '', discount_type: 'percentage',
  discount_value: 10, max_discount_paise: '', min_order_paise: 0,
  max_uses: '', valid_until: ''
}

function StatusBadge({ active }) {
  return <span className={`status-badge ${active ? 'paid' : 'cancelled'}`}>{active ? 'Active' : 'Inactive'}</span>
}

export default function PoliciesTab() {
  const { store } = useOutletContext()
  const { policies, loading, fetchPolicies, createPolicy, updatePolicy, deletePolicy } = useDashboardStore()
  const [modal, setModal] = useState(null) // null | { mode: 'create'|'edit', policy? }
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { fetchPolicies(store.id) }, [store.id])

  const openCreate = () => { setForm(EMPTY_FORM); setError(null); setModal({ mode: 'create' }) }
  const openEdit = (p) => {
    setForm({
      code: p.code,
      description: p.description || '',
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      max_discount_paise: p.max_discount_paise || '',
      min_order_paise: p.min_order_paise || 0,
      max_uses: p.max_uses || '',
      valid_until: p.valid_until ? p.valid_until.slice(0, 10) : '',
      is_active: p.is_active
    })
    setError(null)
    setModal({ mode: 'edit', policy: p })
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError(null)
    try {
      const data = {
        ...form,
        discount_value: parseFloat(form.discount_value),
        min_order_paise: parseInt(form.min_order_paise) || 0,
        max_discount_paise: form.max_discount_paise ? parseInt(form.max_discount_paise) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        valid_until: form.valid_until || null
      }
      if (modal.mode === 'create') {
        await createPolicy(store.id, data)
      } else {
        await updatePolicy(store.id, modal.policy.id, data)
      }
      setModal(null)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this policy?')) return
    await deletePolicy(store.id, id)
  }

  const handleToggle = async (p) => {
    await updatePolicy(store.id, p.id, { is_active: !p.is_active })
  }

  return (
    <div>
      <div className="dashboard-page-header">
        <h1>🏷️ Policies & Coupons</h1>
        <p>Create and manage promotional discount codes for your store</p>
      </div>

      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Promo Codes ({policies.length})</h3>
          <button className="db-btn db-btn-primary db-btn-sm" onClick={openCreate}>+ New Coupon</button>
        </div>

        {loading.policies ? (
          <div className="db-loading">Loading...</div>
        ) : policies.length === 0 ? (
          <div className="db-empty-state">
            <div className="db-empty-icon">🏷️</div>
            <p className="db-empty-text">No promo codes yet. Create your first coupon!</p>
          </div>
        ) : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Code</th><th>Discount</th><th>Min Order</th>
                  <th>Usage</th><th>Expires</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map(p => (
                  <tr key={p.id}>
                    <td>
                      <code style={{ background: '#f0f2f4', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem' }}>
                        {p.code}
                      </code>
                    </td>
                    <td>
                      {p.discount_type === 'percentage' ? `${p.discount_value}%` : `₹${p.discount_value.toFixed(0)}`}
                      {p.max_discount_paise && (
                        <span style={{ color: '#8b949e', fontSize: '0.75rem' }}> (max ₹{p.max_discount_paise / 100})</span>
                      )}
                    </td>
                    <td>₹{(p.min_order_paise / 100).toLocaleString('en-IN')}</td>
                    <td>{p.current_uses}{p.max_uses ? `/${p.max_uses}` : ' / ∞'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#57606a' }}>
                      {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '—'}
                    </td>
                    <td><StatusBadge active={p.is_active} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="db-btn db-btn-secondary db-btn-sm" onClick={() => openEdit(p)}>Edit</button>
                        <button
                          className="db-btn db-btn-sm"
                          style={{ background: p.is_active ? '#fef9c3' : '#dcfce7', color: p.is_active ? '#ca8a04' : '#16a34a', border: 'none' }}
                          onClick={() => handleToggle(p)}
                        >
                          {p.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="db-btn db-btn-danger db-btn-sm" onClick={() => handleDelete(p.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="db-modal-overlay" onClick={() => setModal(null)}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <div className="db-modal-header">
              <h3 className="db-modal-title">
                {modal.mode === 'create' ? 'Create Promo Code' : 'Edit Promo Code'}
              </h3>
              <button className="db-modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            {error && (
              <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '1rem', background: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="db-form-row">
                <div className="db-form-group">
                  <label className="db-label">Code *</label>
                  <input
                    className="db-input"
                    required
                    value={form.code}
                    onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="SAVE20"
                    disabled={modal.mode === 'edit'}
                  />
                </div>
                <div className="db-form-group">
                  <label className="db-label">Type *</label>
                  <select className="db-select" value={form.discount_type} onChange={e => setForm(p => ({ ...p, discount_type: e.target.value }))}>
                    <option value="percentage">Percentage %</option>
                    <option value="fixed">Fixed ₹</option>
                  </select>
                </div>
              </div>
              <div className="db-form-row">
                <div className="db-form-group">
                  <label className="db-label">Discount Value *</label>
                  <input type="number" className="db-input" required value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))} />
                </div>
                <div className="db-form-group">
                  <label className="db-label">Max Discount (paise) <span style={{ color: '#8b949e', fontWeight: 400 }}>cap</span></label>
                  <input type="number" className="db-input" value={form.max_discount_paise} onChange={e => setForm(p => ({ ...p, max_discount_paise: e.target.value }))} placeholder="e.g. 50000 = ₹500" />
                </div>
              </div>
              <div className="db-form-row">
                <div className="db-form-group">
                  <label className="db-label">Min Order (paise)</label>
                  <input type="number" className="db-input" value={form.min_order_paise} onChange={e => setForm(p => ({ ...p, min_order_paise: e.target.value }))} placeholder="e.g. 50000 = ₹500" />
                </div>
                <div className="db-form-group">
                  <label className="db-label">Max Uses</label>
                  <input type="number" className="db-input" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))} placeholder="Unlimited if blank" />
                </div>
              </div>
              <div className="db-form-group">
                <label className="db-label">Description</label>
                <input className="db-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Summer sale 20% off" />
              </div>
              <div className="db-form-group">
                <label className="db-label">Valid Until</label>
                <input type="date" className="db-input" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} />
              </div>
              <div className="db-form-actions">
                <button type="button" className="db-btn db-btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="db-btn db-btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Coupon'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
