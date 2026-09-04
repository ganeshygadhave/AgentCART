/**
 * AgentCART — Agent (Chat) Store (Zustand)
 */
import { create } from 'zustand'
import { agentApi } from '../services/api'

// Holds the in-flight initConversation promise so concurrent callers wait
// instead of firing multiple /agent/conversation requests.
let _initPromise = null

const useAgentStore = create((set, get) => ({
  // ─── State ──────────────────────────────────────────────────────────────────
  conversationId: null,
  messages: [],
  isOpen: false,
  isTyping: false,
  error: null,
  contextProduct: null,
  isEnabled: (() => {
    try { return localStorage.getItem('agentcart_agent_enabled') !== 'false' }
    catch { return true }
  })(), // default enabled

  // ─── Actions ────────────────────────────────────────────────────────────────

  /**
   * Start or restore a conversation.
   * Returns a promise that resolves when conversationId is set.
   * Concurrent calls share the same in-flight promise.
   */
  initConversation: (cartId) => {
    const { conversationId } = get()
    if (conversationId) return Promise.resolve(conversationId)

    // Reuse in-flight promise to prevent duplicate /conversation calls
    if (_initPromise) return _initPromise

    _initPromise = agentApi
      .newConversation(cartId)
      .then((res) => {
        set({ conversationId: res.data.id, error: null })
        _initPromise = null
        return res.data.id
      })
      .catch((err) => {
        _initPromise = null
        set({ error: err.message })
        throw err
      })

    return _initPromise
  },

  /**
   * Send a user message. Ensures conversation is initialized first.
   * Returns { cartUpdated: bool }.
   */
  sendMessage: async (text, cartId) => {
    // ─── Ensure conversationId exists before proceeding ──────────────────────
    let { conversationId } = get()
    if (!conversationId) {
      try {
        conversationId = await get().initConversation(cartId)
      } catch {
        const errorMsg = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Could not start a conversation. Please check your connection.',
          isError: true,
          created_at: new Date().toISOString(),
        }
        set((s) => ({ messages: [...s.messages, errorMsg], isTyping: false }))
        return { cartUpdated: false }
      }
    }

    // Add user message optimistically
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ messages: [...s.messages, userMessage], isTyping: true, error: null }))

    try {
      const res = await agentApi.chat({
        conversation_id: conversationId,
        cart_id: cartId,
        message: text,
        context_product_id: get().contextProduct?.id ?? null,
      })

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.data.response,
        tool_calls: res.data.tool_calls ?? null,
        cart_updated: res.data.cart_updated ?? false,
        created_at: new Date().toISOString(),
      }

      set((s) => ({
        messages: [...s.messages, assistantMessage],
        isTyping: false,
      }))

      return {
        cartUpdated: res.data.cart_updated ?? false,
        response: res.data.response,
        toolCalls: res.data.tool_calls ?? [],
      }
    } catch (err) {
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'I encountered an issue processing your request. Please try again.',
        isError: true,
        created_at: new Date().toISOString(),
      }
      set((s) => ({
        messages: [...s.messages, errorMessage],
        isTyping: false,
        error: err.message,
      }))
      return { cartUpdated: false }
    }
  },

  /** Open chat with optional product context */
  openChat: (product = null) => set({ isOpen: true, contextProduct: product }),
  closeChat: () => set({ isOpen: false }),
  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),

  /** Enable/disable the agent chat widget */
  toggleEnabled: () => set((s) => {
    const next = !s.isEnabled
    try { localStorage.setItem('agentcart_agent_enabled', String(next)) } catch {}
    return { isEnabled: next, isOpen: next ? s.isOpen : false }
  }),
  setEnabled: (val) => set((s) => {
    try { localStorage.setItem('agentcart_agent_enabled', String(val)) } catch {}
    return { isEnabled: val, isOpen: val ? s.isOpen : false }
  }),

  addAssistantMessage: (content, tool_calls = null) => set((s) => ({
    messages: [...s.messages, {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content,
      tool_calls,
      created_at: new Date().toISOString(),
    }],
  })),
  addUserMessage: (content) => set((s) => ({
    messages: [...s.messages, {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }],
  })),

  /** Clear all messages and reset conversation */
  resetConversation: () => {
    _initPromise = null
    set({ conversationId: null, messages: [], contextProduct: null, error: null })
  },
}))

export default useAgentStore
