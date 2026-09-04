import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import apiClient from '../services/api'
import useCartStore from '../store/cartStore'
import { formatPrice } from '../utils/helpers'
import './StorePage.css'

function StoreProductCard({ product }) {
  const { addItem, openCart } = useCartStore()

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    addItem(product.id, 1)
    openCart()
  }

  return (
    <Link to={`/product/${product.id}`} className="product-card">
      <div className="product-card__img-wrap">
        <img 
          src={product.image_url || 'https://via.placeholder.com/400x300?text=No+Image'} 
          alt={product.name} 
          className="product-card__img" 
        />
      </div>
      <div className="product-card__body">
        <div className="product-card__brand">{product.brand || 'Generic'}</div>
        <div className="product-card__name" title={product.name}>{product.name}</div>
        
        <div className="product-card__price-row">
          <span className="price">{formatPrice(product.price)}</span>
        </div>
        
        <div className="product-card__actions">
          <button 
            className="btn btn-primary btn-sm add-btn"
            onClick={handleAddToCart}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </Link>
  )
}

export default function StorePage() {
  const { storeSlug } = useParams()
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchStore = async () => {
      try {
        setLoading(true)
        const res = await apiClient.get('/api/v1/stores/' + storeSlug)
        setStore(res.data)
      } catch (err) {
        console.error("Failed to fetch store:", err)
        setError("Store not found or an error occurred.")
      } finally {
        setLoading(false)
      }
    }
    
    if (storeSlug) {
      fetchStore()
    }
  }, [storeSlug])

  if (loading) {
    return <div className="page-enter store-page"><div className="store-loading">Loading store...</div></div>
  }

  if (error || !store) {
    return (
      <div className="page-enter store-page">
        <div className="store-error card">
          <h2>Oops!</h2>
          <p>{error || "Store not found"}</p>
          <Link to="/catalogue" className="btn btn-primary">Back to Catalogue</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter store-page">
      <div className="store-header card">
        <div className="store-header-content">
          <h1>{store.name}</h1>
          <div className="store-meta">
            <span className="store-domain">Domain: {store.domain || store.slug}</span>
            <span className="store-products-count">{store.products?.length || 0} Products</span>
          </div>
        </div>
      </div>

      <div className="store-products-section">
        <h2>Products</h2>
        
        {(!store.products || store.products.length === 0) ? (
          <div className="empty-state card">
            <p>This store has no products yet.</p>
          </div>
        ) : (
          <div className="catalogue-grid store-grid">
            {store.products.map(product => (
              <StoreProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
