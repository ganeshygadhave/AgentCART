import React, { useState } from 'react'
import useAuthStore from '../../store/authStore'
import './LoginModal.css'

export default function LoginModal({ onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('email') // 'email' | 'otp'
  
  // Email form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  // OTP form
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpHint, setOtpHint] = useState(null)
  
  const [error, setError] = useState(null)
  
  const login = useAuthStore(state => state.login)
  const sendOtp = useAuthStore(state => state.sendOtp)
  const verifyOtp = useAuthStore(state => state.verifyOtp)
  const isLoading = useAuthStore(state => state.isLoading)

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const user = await login(email, password)
      if (onSuccess) onSuccess(user)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await sendOtp('+91' + phone.replace(/^\+91/, ''))
      setOtpSent(true)
      if (res.otp_hint) setOtpHint(res.otp_hint)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const user = await verifyOtp('+91' + phone.replace(/^\+91/, ''), otp)
      if (onSuccess) onSuccess(user)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="login-modal-overlay">
      <div className="login-modal">
        {onClose && (
          <button className="login-modal-close" onClick={onClose}>&times;</button>
        )}
        
        <h2 className="login-modal-title">Sign in to continue</h2>
        <p className="login-modal-subtitle">Access your global AgentCART profile across all stores</p>

        <div className="login-modal-tabs">
          <button 
            className={`login-modal-tab ${activeTab === 'email' ? 'active' : ''}`}
            onClick={() => setActiveTab('email')}
          >
            Email & Password
          </button>
          <button 
            className={`login-modal-tab ${activeTab === 'otp' ? 'active' : ''}`}
            onClick={() => setActiveTab('otp')}
          >
            Phone OTP
          </button>
        </div>

        {error && <div className="login-modal-error">{error}</div>}

        <div className="login-modal-content">
          {activeTab === 'email' && (
            <form onSubmit={handleEmailSubmit} className="login-modal-form">
              <div className="login-modal-field">
                <label>EMAIL ADDRESS</label>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="you@example.com"
                />
              </div>
              <div className="login-modal-field">
                <label>PASSWORD</label>
                <input 
                  type="password" 
                  required 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className="login-modal-btn primary" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In with Password'}
              </button>
            </form>
          )}

          {activeTab === 'otp' && (
            <div className="login-modal-form">
              {!otpSent ? (
                <form onSubmit={handleSendOtp}>
                  <div className="login-modal-field">
                    <label>PHONE NUMBER</label>
                    <div className="phone-input-group">
                      <span className="phone-prefix">+91</span>
                      <input 
                        type="tel" 
                        required 
                        value={phone} 
                        onChange={e => setPhone(e.target.value)} 
                        placeholder="9876543210"
                      />
                    </div>
                  </div>
                  <button type="submit" className="login-modal-btn primary" disabled={isLoading}>
                    {isLoading ? 'Sending...' : 'Send OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <div className="login-modal-field">
                    <label>ENTER OTP</label>
                    <input 
                      type="text" 
                      required 
                      value={otp} 
                      onChange={e => setOtp(e.target.value)} 
                      placeholder="123456"
                    />
                    {otpHint && <div className="otp-hint">Dev OTP: {otpHint}</div>}
                  </div>
                  <button type="submit" className="login-modal-btn primary" disabled={isLoading}>
                    {isLoading ? 'Verifying...' : 'Verify'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
