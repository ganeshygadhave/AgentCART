import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import useDashboardStore from '../../store/dashboardStore'

const EMPTY_FORM = {
  sku: '', name: '', description: '', category: '', brand: '',
  price_paise: '', original_price_paise: '', stock_quantity: 0,
  image_url: '', tags: '', is_active: true
}

export default function ProductsTab() {
  const { store } = useOutletContext()
  const { products, loading, fetchProducts, saveProduct, deleteProduct, toggleProduct } = useDashboardStore()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { fetchProducts(store.id) }, [store.id])

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setForm(EMPTY_FORM); setError(null); setModal({ mode: 'create' }) }
  const openEdit = (p) => {
    setForm({
      sku: p.sku, name: p.name, description: p.description || '',
      category: p.category, brand: p.brand || '',
      price_paise: p.price_paise,
      original_price_paise: p.original_price_paise || '',
      stock_quantity: p.stock_quantity,
      image_url: p.image_url || '',
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
      is_active: p.is_active
    })
    setError(null)
    setModal({ mode: 'edit', product: p })
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError(null)
    try {
      const data = {
        sku: form.sku,
        name: form.name,
        description: form.description || null,
        category: form.category,
        brand: form.brand || null,
        price_paise: parseInt(form.price_paise),
        original_price_paise: form.original_price_paise ? parseInt(form.original_price_paise) : null,
        stock_quantity: parseInt(form.stock_quantity) || 0,
        image_url: form.image_url || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        is_active: form.is_active
      }
      await saveProduct(store.id, data, modal.mode === 'edit' ? modal.product.id : null)
      setModal(null)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Archive (soft-delete) this product?')) return
    await deleteProduct(store.id, id)
  }

  return (
    <div>
      <div className="dashboard-page-header">
        <h1>📦 Product Catalog</h1>
        <p>Manage all products in your store — pricing, stock, and availability</p>
      </div>

      <div className="db-card">
        <div className="db-card-header">
          <div className="db-filter-bar" style={{ margin: 0 }}>
            <input
              className="db-search-input"
              placeholder="Search products by name, SKU, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>
              {filtered.length} / {products.length} products
            </span>
          </div>
          <button className="db-btn db-btn-primary db-btn-sm" onClick={openCreate}>+ Add Product</button>
        </div>

        {loading.products ? (
          <div className="db-loading">Loading products...</div>
        ) : filtered.length === 0 ? (
          <div className="db-empty-state">
            <div className="db-empty-icon">📦</div>
            <p className="db-empty-text">
              {search ? 'No products match your search.' : 'No products yet. Add your first product!'}
            </p>
          </div>
        ) : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Active</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {p.image_url && (
                          <img
                            src={p.image_url}
                            alt=""
                            style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '1px solid #e1e4e8' }}
                            onError={e => { e.target.style.display = 'none' }}
                          />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</div>
                          {p.brand && <div style={{ fontSize: '0.72rem', color: '#8b949e' }}>{p.brand}</div>}
                        </div>
                      </div>
                    </td>
                    <td><code style={{ fontSize: '0.78rem', color: '#57606a' }}>{p.sku}</code></td>
                    <td style={{ color: '#57606a' }}>{p.category}</td>
                    <td style={{ fontWeight: 600 }}>₹{(p.price_paise / 100).toLocaleString('en-IN')}</td>
                    <td>
                      <span style={{
                        color: p.stock_quantity < 5 ? '#dc2626' : p.stock_quantity < 15 ? '#ca8a04' : '#16a34a',
                        fontWeight: 700
                      }}>
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td>
                      <label className="db-toggle">
                        <input
                          type="checkbox"
                          checked={p.is_active}
                          onChange={() => toggleProduct(store.id, p.id, !p.is_active)}
                        />
                        <span className="db-toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="db-btn db-btn-secondary db-btn-sm" onClick={() => openEdit(p)}>Edit</button>
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
          <div className="db-modal db-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="db-modal-header">
              <h3 className="db-modal-title">{modal.mode === 'create' ? '+ Add Product' : 'Edit Product'}</h3>
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
                  <label className="db-label">Product Name *</label>
                  <input className="db-input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="db-form-group">
                  <label className="db-label">SKU *</label>
                  <input className="db-input" required value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} disabled={modal.mode === 'edit'} />
                </div>
              </div>
              <div className="db-form-row">
                <div className="db-form-group">
                  <label className="db-label">Category *</label>
                  <input className="db-input" required value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
                </div>
                <div className="db-form-group">
                  <label className="db-label">Brand</label>
                  <input className="db-input" value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} />
                </div>
              </div>
              <div className="db-form-row">
                <div className="db-form-group">
                  <label className="db-label">Price (paise) * <span style={{ color: '#8b949e', fontWeight: 400 }}>49900 = ₹499</span></label>
                  <input type="number" className="db-input" required min="1" value={form.price_paise} onChange={e => setForm(p => ({ ...p, price_paise: e.target.value }))} />
                </div>
                <div className="db-form-group">
                  <label className="db-label">Original Price (paise) <span style={{ color: '#8b949e', fontWeight: 400 }}>for strikethrough</span></label>
                  <input type="number" className="db-input" min="1" value={form.original_price_paise} onChange={e => setForm(p => ({ ...p, original_price_paise: e.target.value }))} />
                </div>
              </div>
              <div className="db-form-row">
                <div className="db-form-group">
                  <label className="db-label">Stock Quantity *</label>
                  <input type="number" className="db-input" required min="0" value={form.stock_quantity} onChange={e => setForm(p => ({ ...p, stock_quantity: e.target.value }))} />
                </div>
                <div className="db-form-group">
                  <label className="db-label">Active</label>
                  <div style={{ marginTop: '0.5rem' }}>
                    <label className="db-toggle">
                      <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                      <span className="db-toggle-slider" />
                    </label>
                  </div>
                </div>
              </div>
              <div className="db-form-group">
                <label className="db-label">Image URL</label>
                <input className="db-input" value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="db-form-group">
                <label className="db-label">Tags <span style={{ color: '#8b949e', fontWeight: 400 }}>(comma-separated)</span></label>
                <input className="db-input" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="wireless, premium, gaming" />
              </div>
              <div className="db-form-group">
                <label className="db-label">Description</label>
                <textarea className="db-textarea" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="db-form-actions">
                <button type="button" className="db-btn db-btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="db-btn db-btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
