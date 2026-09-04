/**
 * AgentCART — Cart Store (Zustand)
 *
 * Single source of truth for cart state on the frontend.
 * The ACTUAL cart totals are always fetched from/validated by the server.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cartApi } from '../services/api'
import { generateSessionId } from '../utils/helpers'

const useCartStore = create(
  persist(
    (set, get) => ({
      // ─── State ─────────────────────────────────────────────────────────────
      cartId: null,
      sessionId: null,
      items: [],
      subtotal: 0,
      discountAmount: 0,
      total: 0,
      appliedCoupon: null,
      itemCount: 0,
      isLoading: false,
      error: null,
      isOpen: false, // cart sidebar open state

      // ─── Actions ────────────────────────────────────────────────────────────

      /** Initialize or restore cart from server — never throws */
      initCart: async () => {
        let { cartId, sessionId } = get()

        // Ensure we have a session ID
        if (!sessionId) {
          sessionId = generateSessionId()
          set({ sessionId })
          localStorage.setItem('agentcart_session', sessionId)
        }

        try {
          if (cartId) {
            // Restore existing cart from server
            try {
              const res = await cartApi.get(cartId)
              get()._syncFromServer(res.data)
            } catch {
              // Cart expired or deleted — create new one
              await get()._createNewCart()
            }
          } else {
            await get()._createNewCart()
          }
        } catch (err) {
          // Silent fail — cart will be created on first add-to-cart
          console.warn('[CartStore] initCart failed silently:', err.message)
          set({ cartId: null })
        }
      },

      _createNewCart: async () => {
        try {
          const res = await cartApi.create()
          set({ cartId: res.data.id })
          get()._syncFromServer(res.data)
        } catch (err) {
          console.warn('[CartStore] _createNewCart failed:', err.message)
          throw err  // re-throw so initCart outer catch catches it
        }
      },

      _syncFromServer: (serverCart) => {
        const items = serverCart.items || []
        const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
        set({
          cartId: serverCart.id,
          items,
          subtotal: serverCart.subtotal ?? 0,
          discountAmount: serverCart.discount_amount ?? 0,
          total: serverCart.total ?? 0,
          appliedCoupon: serverCart.applied_coupon_code ?? null,
          itemCount,
          error: null,
        })
      },

      /** Add item to cart (calls server, syncs back) */
      addItem: async (productId, quantity = 1) => {
        const { cartId } = get()
        if (!cartId) return
        set({ isLoading: true, error: null })
        try {
          const res = await cartApi.addItem(cartId, { product_id: productId, quantity })
          get()._syncFromServer(res.data)
        } catch (err) {
          set({ error: err.message })
          throw err
        } finally {
          set({ isLoading: false })
        }
      },

      /** Update item quantity */
      updateItem: async (itemId, quantity) => {
        const { cartId } = get()
        if (!cartId) return
        set({ isLoading: true, error: null })
        try {
          const res = await cartApi.updateItem(cartId, itemId, { quantity })
          get()._syncFromServer(res.data)
        } catch (err) {
          set({ error: err.message })
          throw err
        } finally {
          set({ isLoading: false })
        }
      },

      /** Remove item from cart */
      removeItem: async (itemId) => {
        const { cartId } = get()
        if (!cartId) return
        set({ isLoading: true, error: null })
        try {
          const res = await cartApi.removeItem(cartId, itemId)
          get()._syncFromServer(res.data)
        } catch (err) {
          set({ error: err.message })
          throw err
        } finally {
          set({ isLoading: false })
        }
      },

      /** Apply coupon code */
      applyCoupon: async (code) => {
        const { cartId } = get()
        if (!cartId) return
        set({ isLoading: true, error: null })
        try {
          const res = await cartApi.applyCoupon(cartId, code)
          get()._syncFromServer(res.data)
          return { success: true }
        } catch (err) {
          set({ error: err.message })
          return { success: false, error: err.message }
        } finally {
          set({ isLoading: false })
        }
      },

      /** Remove coupon */
      removeCoupon: async () => {
        const { cartId } = get()
        if (!cartId) return
        set({ isLoading: true, error: null })
        try {
          const res = await cartApi.removeCoupon(cartId)
          get()._syncFromServer(res.data)
        } catch (err) {
          set({ error: err.message })
        } finally {
          set({ isLoading: false })
        }
      },

      /** Refresh cart from server (used after agent mutations) */
      refreshCart: async () => {
        const { cartId } = get()
        if (!cartId) return
        try {
          const res = await cartApi.get(cartId)
          get()._syncFromServer(res.data)
        } catch (err) {
          set({ error: err.message })
        }
      },

      /** Toggle cart sidebar */
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      /** Clear local cart state (after order completion) */
      clearCart: () =>
        set({
          cartId: null,
          items: [],
          subtotal: 0,
          discountAmount: 0,
          total: 0,
          appliedCoupon: null,
          itemCount: 0,
          error: null,
        }),
    }),
    {
      name: 'agentcart-cart',
      partialize: (state) => ({
        cartId: state.cartId,
        sessionId: state.sessionId,
      }),
    }
  )
)

export default useCartStore
