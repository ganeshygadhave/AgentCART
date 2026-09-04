import { create } from 'zustand'
import { merchantApi } from '../services/api'

const useDashboardStore = create((set, get) => ({
  store: null,
  agentConfig: null,
  agentAnalytics: null,
  policies: [],
  products: [],
  orders: [],
  analytics: null,
  lowStock: [],
  auditLogs: [],
  loading: {},
  errors: {},

  _setLoading: (key, val) => set(s => ({ loading: { ...s.loading, [key]: val } })),
  _setError: (key, val) => set(s => ({ errors: { ...s.errors, [key]: val } })),

  fetchStore: async () => {
    get()._setLoading('store', true)
    try {
      const res = await merchantApi.getMyStore()
      set({ store: res.data })
      get()._setError('store', null)
    } catch (e) {
      get()._setError('store', e.message)
    } finally {
      get()._setLoading('store', false)
    }
  },

  updateStore: async (data) => {
    const res = await merchantApi.updateStore(data)
    set(s => ({ store: { ...s.store, ...res.data } }))
    return res.data
  },

  fetchAgentConfig: async (storeId) => {
    get()._setLoading('agentConfig', true)
    try {
      const res = await merchantApi.getAgentConfig(storeId)
      set({ agentConfig: res.data })
    } catch (e) {
      get()._setError('agentConfig', e.message)
    } finally {
      get()._setLoading('agentConfig', false)
    }
  },

  saveAgentConfig: async (storeId, data) => {
    const res = await merchantApi.updateAgentConfig(storeId, data)
    set({ agentConfig: res.data })
    return res.data
  },

  fetchAgentAnalytics: async (storeId) => {
    get()._setLoading('agentAnalytics', true)
    try {
      const res = await merchantApi.getAgentAnalytics(storeId)
      set({ agentAnalytics: res.data })
    } catch (e) {
      get()._setError('agentAnalytics', e.message)
    } finally {
      get()._setLoading('agentAnalytics', false)
    }
  },

  fetchPolicies: async (storeId) => {
    get()._setLoading('policies', true)
    try {
      const res = await merchantApi.getPolicies(storeId)
      set({ policies: res.data.policies || [] })
    } catch (e) {
      get()._setError('policies', e.message)
    } finally {
      get()._setLoading('policies', false)
    }
  },

  createPolicy: async (storeId, data) => {
    await merchantApi.createPolicy(storeId, data)
    await get().fetchPolicies(storeId)
  },

  updatePolicy: async (storeId, policyId, data) => {
    await merchantApi.updatePolicy(storeId, policyId, data)
    await get().fetchPolicies(storeId)
  },

  deletePolicy: async (storeId, policyId) => {
    await merchantApi.deletePolicy(storeId, policyId)
    set(s => ({ policies: s.policies.filter(p => p.id !== policyId) }))
  },

  fetchProducts: async (storeId) => {
    get()._setLoading('products', true)
    try {
      const res = await merchantApi.getProducts(storeId)
      set({ products: res.data.products || [] })
    } catch (e) {
      get()._setError('products', e.message)
    } finally {
      get()._setLoading('products', false)
    }
  },

  saveProduct: async (storeId, data, productId = null) => {
    if (productId) {
      await merchantApi.updateProduct(storeId, productId, data)
    } else {
      await merchantApi.createProduct(storeId, data)
    }
    await get().fetchProducts(storeId)
  },

  deleteProduct: async (storeId, productId) => {
    await merchantApi.deleteProduct(storeId, productId)
    set(s => ({ products: s.products.filter(p => p.id !== productId) }))
  },

  toggleProduct: async (storeId, productId, isActive) => {
    await merchantApi.toggleProduct(storeId, productId, isActive)
    set(s => ({ products: s.products.map(p => p.id === productId ? { ...p, is_active: isActive } : p) }))
  },

  fetchOrders: async (storeId, params = {}) => {
    get()._setLoading('orders', true)
    try {
      const res = await merchantApi.getOrders(storeId, params)
      set({ orders: res.data.orders || [] })
    } catch (e) {
      get()._setError('orders', e.message)
    } finally {
      get()._setLoading('orders', false)
    }
  },

  updateOrderStatus: async (orderId, storeId, data) => {
    await merchantApi.updateOrderStatus(orderId, storeId, data)
    set(s => ({
      orders: s.orders.map(o =>
        o.id === orderId
          ? { ...o, status: data.status, tracking_link: data.tracking_link || o.tracking_link }
          : o
      )
    }))
  },

  fetchAnalytics: async (storeId) => {
    get()._setLoading('analytics', true)
    try {
      const [analyticsRes, lowStockRes] = await Promise.all([
        merchantApi.getAnalytics(storeId),
        merchantApi.getLowStock(storeId)
      ])
      set({ analytics: analyticsRes.data, lowStock: lowStockRes.data.products || [] })
    } catch (e) {
      get()._setError('analytics', e.message)
    } finally {
      get()._setLoading('analytics', false)
    }
  },

  fetchAuditLogs: async (storeId, params = {}) => {
    get()._setLoading('auditLogs', true)
    try {
      const res = await merchantApi.getAuditLogs(storeId, params)
      set({ auditLogs: res.data.logs || [] })
    } catch (e) {
      get()._setError('auditLogs', e.message)
    } finally {
      get()._setLoading('auditLogs', false)
    }
  },
}))

export default useDashboardStore
