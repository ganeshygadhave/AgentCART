/**
 * AgentCART — Axios API Client
 * All API calls go through this singleton instance.
 */
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''  // Uses Render URL in prod, Vite proxy in dev

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

// ─── Request Interceptor: Attach Auth Token ─────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('agentcart_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Attach cart session ID for guest carts
  const sessionId = localStorage.getItem('agentcart_session')
  if (sessionId && !config.headers['X-Session-ID']) {
    config.headers['X-Session-ID'] = sessionId
  }
  return config
})

// ─── Response Interceptor: Normalize Errors ─────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred'
    return Promise.reject(new Error(message))
  }
)

export default apiClient

// ─── Products API ────────────────────────────────────────────────────────────
export const productsApi = {
  list: (params) => apiClient.get('/api/v1/products', { params }),
  get: (id) => apiClient.get(`/api/v1/products/${id}`),
  categories: () => apiClient.get('/api/v1/products/categories'),
}

// ─── Cart API ─────────────────────────────────────────────────────────────────
export const cartApi = {
  get: (cartId) => apiClient.get(`/api/v1/cart/${cartId}`),
  create: () => apiClient.post('/api/v1/cart'),
  addItem: (cartId, data) => apiClient.post(`/api/v1/cart/${cartId}/items`, data),
  updateItem: (cartId, itemId, data) =>
    apiClient.patch(`/api/v1/cart/${cartId}/items/${itemId}`, data),
  removeItem: (cartId, itemId) =>
    apiClient.delete(`/api/v1/cart/${cartId}/items/${itemId}`),
  applyCoupon: (cartId, code) =>
    apiClient.post(`/api/v1/cart/${cartId}/coupon`, { code }),
  removeCoupon: (cartId) => apiClient.delete(`/api/v1/cart/${cartId}/coupon`),
  clear: (cartId) => apiClient.delete(`/api/v1/cart/${cartId}/items`),
  relatedProducts: (cartId) => apiClient.get(`/api/v1/cart/${cartId}/related-products`),
  availableDiscounts: (cartId) => apiClient.get(`/api/v1/cart/${cartId}/available-discounts`),
}

// ─── Agent API ────────────────────────────────────────────────────────────────
export const agentApi = {
  chat: (data) => apiClient.post('/api/v1/agent/chat', data),
  newConversation: (cartId) =>
    apiClient.post('/api/v1/agent/conversation', { cart_id: cartId }),
}

// ─── Checkout API ─────────────────────────────────────────────────────────────
export const checkoutApi = {
  validate: (cartId, couponCode) =>
    apiClient.post('/api/v1/checkout/validate', { cart_id: cartId, coupon_code: couponCode }),
  createOrder: (data) => apiClient.post('/api/v1/checkout/order?confirmed=true', data),
  initPayment: (orderId) => apiClient.post(`/api/v1/checkout/payment/${orderId}`),
  verifyPayment: (data) => apiClient.post('/api/v1/checkout/verify', data),
  cancelOrder: (orderId) => apiClient.patch(`/api/v1/orders/${orderId}/cancel`),
}

// ─── Orders API ───────────────────────────────────────────────────────────────
export const ordersApi = {
  get: (orderId) => apiClient.get(`/api/v1/orders/${orderId}`),
  list: () => apiClient.get('/api/v1/orders'),
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => apiClient.post('/api/v1/auth/login', { email, password }),
  signup: (email, name, password) => apiClient.post('/api/v1/auth/signup', { email, name, password }),
  googleLogin: ({ email, name, google_token, password }) =>
    apiClient.post('/api/v1/auth/google', { email, name, google_token, password }),
  sendOtp: (phone) => apiClient.post('/api/v1/auth/otp/send', { phone }),
  verifyOtp: (phone, otp) => apiClient.post('/api/v1/auth/otp/verify', { phone, otp }),
  me: () => apiClient.get('/api/v1/auth/me'),
}

// ─── Users API ────────────────────────────────────────────────────────────────
export const usersApi = {
  updateProfile: (data) => apiClient.patch('/api/v1/users/me', data),
  getAddresses: () => apiClient.get('/api/v1/users/addresses'),
  addAddress: (data) => apiClient.post('/api/v1/users/addresses', data),
  deleteAddress: (addressId) => apiClient.delete(`/api/v1/users/addresses/${addressId}`),
  getOrders: (storeId) => apiClient.get('/api/v1/users/orders', { params: storeId ? { store_id: storeId } : {} }),
}


// ─── Merchant API ──────────────────────────────────────────────────────────────────────────────
export const merchantApi = {
  // Store
  register: (data) => apiClient.post('/api/v1/merchants/register', data),
  getMyStore: () => apiClient.get('/api/v1/merchants/my-store'),
  updateStore: (data) => apiClient.patch('/api/v1/merchants/my-store', data),

  // Agent Config
  getAgentConfig: (storeId) => apiClient.get(`/api/v1/merchants/${storeId}/agent-config`),
  updateAgentConfig: (storeId, data) => apiClient.put(`/api/v1/merchants/${storeId}/agent-config`, data),
  getAgentAnalytics: (storeId) => apiClient.get(`/api/v1/merchants/${storeId}/agent-analytics`),

  // Policies
  getPolicies: (storeId) => apiClient.get(`/api/v1/merchants/${storeId}/policies`),
  createPolicy: (storeId, data) => apiClient.post(`/api/v1/merchants/${storeId}/policies`, data),
  updatePolicy: (storeId, policyId, data) => apiClient.patch(`/api/v1/merchants/${storeId}/policies/${policyId}`, data),
  deletePolicy: (storeId, policyId) => apiClient.delete(`/api/v1/merchants/${storeId}/policies/${policyId}`),

  // Products (Admin CRUD)
  getProducts: (storeId) => apiClient.get(`/api/v1/merchants/${storeId}/products`),
  createProduct: (storeId, data) => apiClient.post(`/api/v1/merchants/${storeId}/products`, data),
  updateProduct: (storeId, productId, data) => apiClient.patch(`/api/v1/merchants/${storeId}/products/${productId}`, data),
  deleteProduct: (storeId, productId) => apiClient.delete(`/api/v1/merchants/${storeId}/products/${productId}`),
  toggleProduct: (storeId, productId, isActive) =>
    apiClient.patch(`/api/v1/merchants/${storeId}/products/${productId}/toggle-active`, null, { params: { is_active: isActive } }),
  bulkStock: (storeId, updates) => apiClient.post(`/api/v1/merchants/${storeId}/products/bulk-stock`, { updates }),

  // Orders
  getOrders: (storeId, params) => apiClient.get(`/api/v1/merchants/${storeId}/orders`, { params }),
  updateOrderStatus: (orderId, storeId, data) =>
    apiClient.patch(`/api/v1/merchants/orders/${orderId}/status`, data, { params: { store_id: storeId } }),

  // Analytics
  getAnalytics: (storeId) => apiClient.get(`/api/v1/merchants/${storeId}/analytics`),
  getLowStock: (storeId) => apiClient.get(`/api/v1/merchants/${storeId}/low-stock`),

  // Audit Logs
  getAuditLogs: (storeId, params) => apiClient.get(`/api/v1/merchants/${storeId}/audit-logs`, { params }),
}

// ─── Stores API ───────────────────────────────────────────────────────────────
export const storesApi = {
  getBySlug: (slug) => apiClient.get(`/api/v1/stores/${slug}`),
}
