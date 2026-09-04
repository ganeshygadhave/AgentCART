import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { productsApi } from '../services/api'
import useCartStore from '../store/cartStore'
import useAgentStore from '../store/agentStore'
import { formatPrice, discountPercent, parseTags } from '../utils/helpers'
import './ProductDetailPage.css'

export default function ProductDetailPage() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [qty, setQty] = useState(1)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const { addItem, openCart } = useCartStore()
  const openChat = useAgentStore((s) => s.openChat)

  useEffect(() => {
    const fetch = async () => {
      setIsLoading(true)
      try {
        const res = await productsApi.get(id)
        setProduct(res.data)
      } catch {
        setError('Product not found.')
      } finally {
        setIsLoading(false)
      }
    }
    fetch()
  }, [id])

  const handleAdd = async () => {
    setAdding(true)
    try {
      await addItem(product.id, qty)
      setAdded(true)
      openCart()
      setTimeout(() => setAdded(false), 2500)
    } finally {
      setAdding(false)
    }
  }

  if (isLoading) return (
    <div className="container product-detail-page">
      <div className="skeleton" style={{ height: 400, marginTop: 32 }} />
    </div>
  )
  if (error) return (
    <div className="container product-detail-page">
      <p className="body-sm text-flag" style={{ marginTop: 32 }}>{error}</p>
      <Link to="/catalogue" className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>← Back to Catalogue</Link>
    </div>
  )
  if (!product) return null

  const discount = discountPercent(product.original_price_paise, product.price_paise)
  const tags = parseTags(product.tags)

  return (
    <div className="container product-detail-page page-enter">
      <div className="product-detail__breadcrumb">
        <Link to="/catalogue" className="body-sm text-ink-ghost">Catalogue</Link>
        <span className="body-sm text-ink-ghost"> / </span>
        <span className="body-sm text-ink-soft">{product.category}</span>
        <span className="body-sm text-ink-ghost"> / </span>
        <span className="body-sm">{product.name}</span>
      </div>

      <div className="product-detail__grid">
        {/* ─── Image ─── */}
        <div className="product-detail__img-wrap">
          {product.image_url && (
            <img src={product.image_url} alt={product.name} className="product-detail__img" />
          )}
          {discount && (
            <div className="product-detail__discount badge badge-signal">{discount}% off</div>
          )}
        </div>

        {/* ─── Info Panel ─── */}
        <div className="product-detail__info">
          <div className="product-detail__brand label-caps">{product.brand}</div>
          <h1 className="headline-md product-detail__name">{product.name}</h1>

          {product.rating && (
            <div className="product-detail__rating">
              <span className="truth-sm text-signal">{'★'.repeat(Math.round(product.rating))}</span>
              <span className="truth-sm text-ink-ghost">{product.rating.toFixed(1)} ({product.review_count?.toLocaleString()} reviews)</span>
            </div>
          )}

          <div className="divider" />

          {/* Pricing */}
          <div className="product-detail__pricing">
            <span className="truth-lg">{formatPrice(product.price_paise)}</span>
            {product.original_price_paise && (
              <span className="truth-md text-ink-ghost" style={{ textDecoration: 'line-through' }}>
                {formatPrice(product.original_price_paise)}
              </span>
            )}
          </div>

          <div className="verified-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span className="truth-sm text-signal">Price verified by policy engine</span>
          </div>

          <div className="divider" />

          {/* Stock */}
          <div className={`product-detail__stock truth-sm ${product.stock_quantity > 10 ? 'text-signal' : product.stock_quantity > 0 ? 'text-flag' : 'text-flag'}`}>
            {product.stock_quantity > 10
              ? `✓ In Stock (${product.stock_quantity} units)`
              : product.stock_quantity > 0
              ? `⚠ Only ${product.stock_quantity} left`
              : '✗ Out of Stock'}
          </div>

          {/* Quantity + Add */}
          <div className="product-detail__cart-controls">
            <div className="input-group">
              <label className="input-label">Quantity</label>
              <div className="qty-stepper">
                <button className="qty-stepper__btn" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease">−</button>
                <span className="qty-stepper__val">{qty}</span>
                <button className="qty-stepper__btn" onClick={() => setQty(q => Math.min(product.stock_quantity, q + 1))} aria-label="Increase">+</button>
              </div>
            </div>

            <button
              id="add-to-cart-btn"
              className={`btn ${added ? 'btn-signal' : 'btn-primary'} btn-lg`}
              onClick={handleAdd}
              disabled={adding || product.stock_quantity === 0}
            >
              {product.stock_quantity === 0 ? 'Out of Stock' : added ? '✓ Added to Cart' : adding ? 'Adding…' : 'Add to Cart'}
            </button>

            <button
              id="ask-about-product-btn"
              className="btn btn-ghost btn-lg"
              onClick={() => openChat(product)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Ask AgentCART
            </button>
          </div>

          {/* Description */}
          {product.description && (
            <>
              <div className="divider" />
              <div>
                <p className="label-caps mb-2">Description</p>
                <p className="body-sm text-ink-soft">{product.description}</p>
              </div>
            </>
          )}

          {/* Store / Sold By */}
          {(product.store_name || product.store_id) && (
            <>
              <div className="divider" />
              <div className="product-detail__store">
                <span className="label-caps">Sold by</span>
                {product.store_slug ? (
                  <Link
                    to={`/store/${product.store_slug}`}
                    className="product-detail__store-link"
                  >
                    <i className="fa-solid fa-store" style={{ fontSize: 12, marginRight: 6 }} />
                    {product.store_name || product.store_id}
                  </Link>
                ) : (
                  <span className="product-detail__store-name">
                    <i className="fa-solid fa-store" style={{ fontSize: 12, marginRight: 6 }} />
                    {product.store_name || product.store_id}
                  </span>
                )}
              </div>
            </>
          )}


          {/* Tags */}
          {tags.length > 0 && (
            <div className="product-detail__tags">
              {tags.map((tag) => (
                <span key={tag} className="badge badge-ghost">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
