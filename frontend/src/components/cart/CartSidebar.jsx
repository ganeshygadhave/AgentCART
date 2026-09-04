import useCartStore from '../../store/cartStore'
import { formatPrice, formatRupees } from '../../utils/helpers'
import { Link } from 'react-router-dom'
import './CartSidebar.css'

export default function CartSidebar() {
  const { isOpen, closeCart, items, subtotal, discountAmount, total, appliedCoupon, itemCount, isLoading, removeItem, updateItem } = useCartStore()

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="cart-overlay" onClick={closeCart} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside
        className={`cart-sidebar ${isOpen ? 'cart-sidebar--open' : ''}`}
        aria-label="Shopping cart"
        role="complementary"
      >
        {/* ─── Header ─── */}
        <div className="cart-sidebar__header">
          <div className="cart-sidebar__title">
            <span className="label-caps">Cart</span>
            {itemCount > 0 && (
              <span className="truth-sm text-ink-ghost">({itemCount} items)</span>
            )}
          </div>
          <button className="cart-sidebar__close btn btn-ghost btn-sm" onClick={closeCart} aria-label="Close cart">
            ✕
          </button>
        </div>

        <div className="divider" />

        {/* ─── Body ─── */}
        {items.length === 0 ? (
          <div className="cart-sidebar__empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <p className="body-sm text-ink-ghost">Your cart is empty</p>
            <button className="btn btn-ghost btn-sm" onClick={closeCart}>Browse Catalogue</button>
          </div>
        ) : (
          <div className="cart-sidebar__items">
            {items.map((item) => (
              <CartLineItem key={item.id} item={item} onRemove={removeItem} onUpdate={updateItem} isLoading={isLoading} />
            ))}
          </div>
        )}

        {/* ─── Ledger Totals ─── */}
        {items.length > 0 && (
          <div className="cart-sidebar__footer">
            <div className="divider" />
            <div className="cart-totals">
              <div className="cart-totals__row">
                <span className="body-sm text-ink-soft">Subtotal</span>
                <span className="truth-sm">{formatRupees(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="cart-totals__row">
                  <span className="body-sm text-signal">
                    Discount {appliedCoupon && `(${appliedCoupon})`}
                  </span>
                  <span className="truth-sm text-signal">−{formatRupees(discountAmount)}</span>
                </div>
              )}
              <div className="divider-dashed" />
              <div className="cart-totals__row cart-totals__row--total">
                <span className="body-md font-semibold">Total</span>
                <span className="truth-md verified-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  {formatRupees(total)}
                </span>
              </div>
            </div>
            <Link to="/checkout" className="btn btn-signal btn-full btn-lg" onClick={closeCart} id="proceed-to-checkout-btn">
              Proceed to Checkout
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}

function CartLineItem({ item, onRemove, onUpdate, isLoading }) {
  const handleQty = async (delta) => {
    const newQty = item.quantity + delta
    if (newQty < 1) {
      await onRemove(item.id)
    } else {
      await onUpdate(item.id, newQty)
    }
  }

  return (
    <div className="cart-line-item">
      {item.product?.image_url && (
        <img
          src={item.product.image_url}
          alt={item.product?.name}
          className="cart-line-item__img"
        />
      )}
      <div className="cart-line-item__info">
        <p className="body-sm font-medium truncate">{item.product?.name ?? 'Product'}</p>
        <p className="truth-sm text-ink-ghost">{formatPrice(item.unit_price_paise)} / unit</p>
        <div className="cart-line-item__controls">
          <div className="qty-stepper">
            <button className="qty-stepper__btn" onClick={() => handleQty(-1)} disabled={isLoading} aria-label="Decrease quantity">−</button>
            <span className="qty-stepper__val">{item.quantity}</span>
            <button className="qty-stepper__btn" onClick={() => handleQty(1)} disabled={isLoading} aria-label="Increase quantity">+</button>
          </div>
          <span className="truth-sm font-medium">{formatPrice(item.subtotal_paise ?? item.unit_price_paise * item.quantity)}</span>
        </div>
      </div>
      <button
        className="cart-line-item__remove"
        onClick={() => onRemove(item.id)}
        disabled={isLoading}
        aria-label="Remove item"
      >
        ✕
      </button>
    </div>
  )
}
