import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,     // true only during active API calls (login/signup/otp)
      initialized: false,   // true once loadFromStorage has run
      error: null,

      /**
       * Login with Email & Password
       */
      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const res = await authApi.login(email, password)
          const { access_token, user } = res.data
          localStorage.setItem('agentcart_token', access_token)
          set({ user, token: access_token, isAuthenticated: true, isLoading: false })
          return user
        } catch (err) {
          const msg = err?.response?.data?.detail || err.message || 'Login failed'
          set({ error: msg, isLoading: false })
          throw new Error(msg)
        }
      },

      /**
       * Sign up with Email, Name & Password
       */
      signup: async (email, name, password) => {
        set({ isLoading: true, error: null })
        try {
          const res = await authApi.signup(email, name, password)
          const { access_token, user } = res.data
          localStorage.setItem('agentcart_token', access_token)
          set({ user, token: access_token, isAuthenticated: true, isLoading: false })
          return user
        } catch (err) {
          const msg = err?.response?.data?.detail || err.message || 'Signup failed'
          set({ error: msg, isLoading: false })
          throw new Error(msg)
        }
      },

      /**
       * Legacy / Fallback Google Email login
       */
      loginWithGoogle: async (email, name, googleToken, password) => {
        set({ isLoading: true, error: null })
        try {
          const res = await authApi.googleLogin({ email, name, google_token: googleToken, password })
          const { access_token, user } = res.data
          localStorage.setItem('agentcart_token', access_token)
          set({ user, token: access_token, isAuthenticated: true, isLoading: false })
          return user
        } catch (err) {
          const msg = err?.response?.data?.detail || err.message || 'Login failed'
          set({ error: msg, isLoading: false })
          throw new Error(msg)
        }
      },

      /**
       * Send OTP to phone number.
       */
      sendOtp: async (phone) => {
        set({ isLoading: true, error: null })
        try {
          const res = await authApi.sendOtp(phone)
          set({ isLoading: false })
          return res.data  // { message, otp_hint }
        } catch (err) {
          const msg = err?.response?.data?.detail || err.message || 'Failed to send OTP'
          set({ error: msg, isLoading: false })
          throw new Error(msg)
        }
      },

      /**
       * Verify OTP.
       */
      verifyOtp: async (phone, otp) => {
        set({ isLoading: true, error: null })
        try {
          const res = await authApi.verifyOtp(phone, otp)
          const { access_token, user } = res.data
          localStorage.setItem('agentcart_token', access_token)
          set({ user, token: access_token, isAuthenticated: true, isLoading: false })
          return user
        } catch (err) {
          const msg = err?.response?.data?.detail || err.message || 'OTP verification failed'
          set({ error: msg, isLoading: false })
          throw new Error(msg)
        }
      },

      /**
       * Sign out — clear all auth state.
       */
      logout: () => {
        localStorage.removeItem('agentcart_token')
        set({ user: null, token: null, isAuthenticated: false, error: null, initialized: true })
      },

      /**
       * Called on app mount — restore session from stored JWT.
       * Sets initialized=true when done regardless of outcome.
       */
      loadFromStorage: async () => {
        const token = localStorage.getItem('agentcart_token')
        if (!token) {
          set({ isLoading: false, initialized: true })
          return
        }
        set({ isLoading: true, error: null })
        try {
          const res = await authApi.me()
          set({
            user: res.data,
            token,
            isAuthenticated: true,
            isLoading: false,
            initialized: true,
          })
        } catch (err) {
          localStorage.removeItem('agentcart_token')
          set({ user: null, token: null, isAuthenticated: false, isLoading: false, initialized: true })
        }
      },
    }),
    {
      name: 'agentcart-auth',
      // Only persist the token — all other state is derived fresh on load
      partialize: (state) => ({ token: state.token }),
    }
  )
)

export default useAuthStore
