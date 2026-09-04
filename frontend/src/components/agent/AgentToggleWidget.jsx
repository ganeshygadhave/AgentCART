import React, { useState, useEffect, useRef } from 'react'
import useAuthStore from '../../store/authStore'
import useCartStore from '../../store/cartStore'
import { agentApi, usersApi } from '../../services/api'
import LoginModal from '../auth/LoginModal'
import AddressSelector from '../checkout/AddressSelector'
import OrderStepper from '../checkout/OrderStepper'
import './AgentToggleWidget.css'

export default function AgentToggleWidget({ storeId = 'agentcart', storeName = 'AgentCART', isMerchantSite = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'orders' | 'merchant'
  
  const { user, isAuthenticated, loadFromStorage } = useAuthStore()
  const { itemCount, cartId, refreshCart } = useCartStore()

  useEffect(() => {
    loadFromStorage()
  }, [])

  const toggleWidget = () => {
    setIsOpen(!isOpen)
  }

  return (
    <>
      <button className="agent-toggle-btn" onClick={toggleWidget}>
        <span className="agent-toggle-icon">✨</span>
        <span className="agent-toggle-text">Ask AgentCART</span>
        {itemCount > 0 && (
          <div className="agent-toggle-badge">{itemCount}</div>
        )}
      </button>

      <div className={`agent-widget-drawer ${isOpen ? 'open' : ''}`}>
        <div className="agent-widget-header">
          <div className="agent-widget-title">
            <span className="agent-widget-store-name">{storeName}</span>
            <span className="agent-widget-badge">AgentCART</span>
          </div>
          <div className="agent-widget-auth">
            {isAuthenticated ? (
              <span className="agent-widget-user">👤 {user?.name}</span>
            ) : (
              <span className="agent-widget-login-link" onClick={() => setActiveTab('chat')}>Sign in</span>
            )}
          </div>
          <button className="agent-widget-close" onClick={toggleWidget}>&times;</button>
        </div>

        <div className="agent-widget-tabs">
          <button 
            className={`agent-widget-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            💬 Chat
          </button>
          {isAuthenticated && (
            <button 
              className={`agent-widget-tab ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              📦 Orders
            </button>
          )}
          {isMerchantSite && user?.is_merchant && (
            <button 
              className={`agent-widget-tab ${activeTab === 'merchant' ? 'active' : ''}`}
              onClick={() => setActiveTab('merchant')}
            >
              📊 Merchant
            </button>
          )}
        </div>

        <div className="agent-widget-content">
          {activeTab === 'chat' && (
            <ChatTab isAuthenticated={isAuthenticated} storeId={storeId} user={user} cartId={cartId} refreshCart={refreshCart} />
          )}
          {activeTab === 'orders' && isAuthenticated && (
            <OrdersTab storeId={storeId} />
          )}
          {activeTab === 'merchant' && isMerchantSite && user?.is_merchant && (
            <MerchantTab storeId={storeId} user={user} />
          )}
        </div>
      </div>
    </>
  )
}

function ChatTab({ isAuthenticated, storeId, user, cartId, refreshCart }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [showAddressSelector, setShowAddressSelector] = useState(false)
  
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping, showAddressSelector])

  const handleSend = async () => {
    if (!input.trim() || isTyping) return
    const text = input.trim()
    setInput('')

    const userMsg = { id: Date.now(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    try {
      const res = await agentApi.chat({
        message: text,
        cart_id: cartId,
        user_id: user?.id,
        store_id: storeId,
        mode: 'customer'
      })
      
      const assistantMsg = { 
        id: Date.now() + 1, 
        role: 'assistant', 
        content: res.data.response,
        tool_calls: res.data.tool_calls 
      }
      setMessages(prev => [...prev, assistantMsg])

      const cartUpdated = res.data.tool_calls?.some(t => ['add_to_cart', 'update_cart', 'remove_from_cart', 'apply_coupon', 'clear_cart'].includes(t.tool_name))
      if (cartUpdated) {
        refreshCart()
      }

      // Check if address selection is needed (simple heuristic for demo)
      const checkoutIntent = /\b(proceed|checkout|pay|payment|confirm|address)\b/i.test(text) || /\b(address|delivery|checkout)\b/i.test(res.data.response)
      if (checkoutIntent && !selectedAddress) {
        setShowAddressSelector(true)
      }

    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Sorry, an error occurred.' }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleAddressConfirm = (address) => {
    setSelectedAddress(address)
    setShowAddressSelector(false)
    setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: `Address confirmed: ${address.label || 'Delivery'}. You can now proceed to payment.` }])
  }

  if (!isAuthenticated) {
    return (
      <div className="agent-widget-login-container">
        <LoginModal onSuccess={() => {}} />
      </div>
    )
  }

  return (
    <div className="agent-widget-chat-container">
      <div className="agent-widget-messages">
        {messages.length === 0 && (
          <div className="agent-widget-welcome">
            How can I help you today?
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`agent-widget-msg ${msg.role}`}>
            <div className="msg-bubble">{msg.content}</div>
          </div>
        ))}
        {isTyping && (
          <div className="agent-widget-msg assistant">
            <div className="msg-bubble typing">...</div>
          </div>
        )}
        {showAddressSelector && (
          <div className="agent-widget-inline-address">
            <AddressSelector userId={user.id} onConfirm={handleAddressConfirm} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="agent-widget-input-row">
        <input 
          type="text" 
          value={input} 
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
        />
        <button onClick={handleSend} disabled={isTyping || !input.trim()}>Send</button>
      </div>
    </div>
  )
}

function OrdersTab({ storeId }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    usersApi.getOrders(storeId).then(res => {
      setOrders(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [storeId])

  if (loading) return <div className="p-16">Loading orders...</div>

  return (
    <div className="agent-widget-orders">
      {orders.length === 0 && <div className="p-16">No orders found.</div>}
      {orders.map(order => (
        <div key={order.id} className="agent-widget-order-card">
          <div className="order-header">
            <strong>Order #{order.order_number}</strong>
            <span>{order.store_name}</span>
          </div>
          <div className="order-total">Total: ₹{order.total_paise / 100}</div>
          <OrderStepper 
            status={order.status} 
            tracking_link={order.tracking_link}
            tracking_carrier={order.tracking_carrier}
          />
        </div>
      ))}
    </div>
  )
}

function MerchantTab({ storeId, user }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = async () => {
    if (!input.trim() || isTyping) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: text }])
    setIsTyping(true)
    try {
      const res = await agentApi.chat({
        message: text,
        user_id: user?.id,
        store_id: storeId,
        mode: 'merchant'
      })
      setMessages(prev => [...prev, { id: Date.now()+1, role: 'assistant', content: res.data.response }])
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now()+1, role: 'assistant', content: 'Error connecting to merchant agent.' }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="agent-widget-chat-container">
      <div className="agent-widget-messages">
        {messages.length === 0 && (
          <div className="agent-widget-welcome">
            Hello Admin. How can I help you manage your store today?
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`agent-widget-msg ${msg.role}`}>
            <div className="msg-bubble">{msg.content}</div>
          </div>
        ))}
        {isTyping && (
          <div className="agent-widget-msg assistant">
            <div className="msg-bubble typing">...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="agent-widget-input-row">
        <input 
          type="text" 
          value={input} 
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask store assistant..."
        />
        <button onClick={handleSend} disabled={isTyping || !input.trim()}>Send</button>
      </div>
    </div>
  )
}
