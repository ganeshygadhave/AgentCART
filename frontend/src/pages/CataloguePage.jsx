import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { productsApi } from '../services/api'
import useCartStore from '../store/cartStore'
import useAgentStore from '../store/agentStore'
import { formatPrice, discountPercent, parseTags } from '../utils/helpers'
import './CataloguePage.css'

const CATEGORIES = ['All', 'Electronics', 'Computing', 'Home & Kitchen', 'Fashion', 'Sports & Fitness', 'Books']
const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
]

export default function CataloguePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const activeCategory = searchParams.get('category') || 'All'
  const activeSort = searchParams.get('sort') || 'featured'
  const openChat = useAgentStore((s) => s.openChat)
  const debounceRef = useRef(null)

  // Debounce search input — only fires API after 400ms of no typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = {}
        if (activeCategory && activeCategory !== 'All') params.category = activeCategory
        if (debouncedSearch) params.q = debouncedSearch
        if (activeSort && activeSort !== 'featured') params.sort = activeSort
        const res = await productsApi.list(params)
        setProducts(res.data)
      } catch {
        setError('Could not load products. Make sure the backend is running.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchProducts()
  }, [activeCategory, debouncedSearch, activeSort])

  const setCategory = useCallback((cat) => {
    const p = new URLSearchParams(searchParams)
    if (cat === 'All') p.delete('category')
    else p.set('category', cat)
    setSearchParams(p)
    setSidebarOpen(false)
  }, [searchParams, setSearchParams])

  const setSort = useCallback((val) => {
    const p = new URLSearchParams(searchParams)
    p.set('sort', val)
    setSearchParams(p)
  }, [searchParams, setSearchParams])

  return (
    <div className="catalogue-page page-enter">
      {/* ─── Page Header ─── */}
      <div className="catalogue-header">
        <div className="container catalogue-header__inner">
          <div className="catalogue-header__left">
            <h1 className="headline-md">Catalogue</h1>
            {products.length > 0 && (
              <p className="body-sm text-ink-ghost mt-1">{products.length} products</p>
            )}
          </div>

          {/* ─── Search Bar (always visible) ─── */}
          <div className="catalogue-searchbar">
            <i className="fa-solid fa-magnifying-glass catalogue-searchbar__icon" />
            <input
              id="catalogue-search-bar"
              type="search"
              className="catalogue-searchbar__input"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
            {search && (
              <button
                className="catalogue-searchbar__clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          <div className="catalogue-header__actions">
            {/* Filter Toggle Button */}
            <button
              className={`btn btn-ghost btn-sm catalogue-filter-toggle ${sidebarOpen ? 'catalogue-filter-toggle--active' : ''}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              id="catalogue-filter-btn"
              aria-label="Toggle filters"
              aria-expanded={sidebarOpen}
            >
              <i className="fa-solid fa-sliders" />
              Filters
              {(activeCategory !== 'All' || activeSort !== 'featured') && (
                <span className="catalogue-filter-dot" aria-label="Active filters" />
              )}
            </button>

          </div>
        </div>
      </div>

      {/* ─── Filter Sidebar Overlay (mobile) ─── */}
      {sidebarOpen && (
        <div
          className="catalogue-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="container catalogue-layout">
        {/* ─── Filters Sidebar ─── */}
        <aside className={`catalogue-filters ${sidebarOpen ? 'catalogue-filters--open' : ''}`}>
          <div className="catalogue-filters__header">
            <span className="label-caps">Filters</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close filters"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="mb-6">
            <p className="label-caps mb-4">Category</p>
            <div className="catalogue-category-list">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  id={`filter-cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`catalogue-category-btn ${activeCategory === cat ? 'catalogue-category-btn--active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label-caps mb-4">Sort By</p>
            <div className="catalogue-category-list">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`catalogue-category-btn ${activeSort === opt.value ? 'catalogue-category-btn--active' : ''}`}
                  onClick={() => setSort(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {(activeCategory !== 'All' || activeSort !== 'featured') && (
            <button
              className="btn btn-ghost btn-sm catalogue-clear-btn"
              onClick={() => {
                const p = new URLSearchParams()
                setSearchParams(p)
              }}
            >
              <i className="fa-solid fa-rotate-left" /> Clear Filters
            </button>
          )}
        </aside>

        {/* ─── Product Grid ─── */}
        <div className="catalogue-grid-wrap">
          {isLoading ? (
            <div className="catalogue-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="product-card-skeleton card">
                  <div className="skeleton" style={{ height: 220 }} />
                  <div style={{ padding: 'var(--space-4)', display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
                    <div className="skeleton" style={{ height: 14, width: '80%' }} />
                    <div className="skeleton" style={{ height: 12, width: '50%' }} />
                    <div className="skeleton" style={{ height: 20, width: '40%', marginTop: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="catalogue-error">
              <p className="body-sm text-flag">{error}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="catalogue-empty">
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 32, color: 'var(--color-ink-ghost)', marginBottom: 12 }} />
              <p className="body-sm text-ink-ghost">No products found{search ? ` for "${search}"` : ''}.</p>
              {search && (
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setSearch('')}>
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="catalogue-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProductCard({ product }) {
  const { addItem, openCart } = useCartStore()
  const openChat = useAgentStore((s) => s.openChat)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const discount = discountPercent(product.original_price_paise, product.price_paise)

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true)
    try {
      await addItem(product.id, 1)
      setAdded(true)
      openCart()
      setTimeout(() => setAdded(false), 2000)
    } finally {
      setAdding(false)
    }
  }

  return (
    <Link to={`/product/${product.id}`} className="product-card card" id={`product-${product.id}`}>
      <div className="product-card__img-wrap">
        {product.image_url && (
          <img src={product.image_url} alt={product.name} className="product-card__img" loading="lazy" />
        )}
        {discount && (
          <span className="product-card__discount badge badge-signal">{discount}% off</span>
        )}
        {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
          <span className="product-card__low-stock badge badge-flag">Only {product.stock_quantity} left</span>
        )}
      </div>

      <div className="divider" />

      <div className="product-card__body">
        <p className="label-caps text-ink-ghost">{product.brand}</p>
        <p className="body-sm font-medium product-card__name">{product.name}</p>

        {product.rating && (
          <div className="product-card__rating">
            <span className="truth-sm">{'★'.repeat(Math.round(product.rating))}</span>
            <span className="truth-sm text-ink-ghost">{product.rating.toFixed(1)} ({product.review_count?.toLocaleString()})</span>
          </div>
        )}

        <div className="product-card__price-row">
          <span className="truth-md">{formatPrice(product.price_paise)}</span>
          {product.original_price_paise && (
            <span className="truth-sm text-ink-ghost" style={{ textDecoration: 'line-through' }}>
              {formatPrice(product.original_price_paise)}
            </span>
          )}
        </div>

        <div className="product-card__actions">
          <button
            className={`btn ${added ? 'btn-signal' : 'btn-primary'} btn-sm btn-full`}
            onClick={handleAdd}
            disabled={adding || product.stock_quantity === 0}
            aria-label={`Add ${product.name} to cart`}
          >
            {product.stock_quantity === 0 ? 'Out of Stock' : added ? '✓ Added' : adding ? 'Adding…' : 'Add to Cart'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.preventDefault(); openChat(product) }}
            aria-label={`Ask about ${product.name}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </Link>
  )
}
