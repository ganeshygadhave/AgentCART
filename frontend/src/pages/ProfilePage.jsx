import { useState, useEffect } from 'react'
import { usersApi } from '../services/api'
import useAuthStore from '../store/authStore'
import './ProfilePage.css'

export default function ProfilePage() {
  const { user } = useAuthStore()
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  const [formData, setFormData] = useState({
    label: 'Home',
    full_name: '',
    phone: '',
    street_address: '',
    landmark: '',
    city: '',
    state: '',
    pincode: ''
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const fetchAddresses = async () => {
    try {
      setLoading(true)
      const res = await usersApi.getAddresses()
      setAddresses(res.data?.addresses || res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAddresses()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await usersApi.addAddress(formData)
      setShowAddForm(false)
      setFormData({
        label: 'Home',
        full_name: '',
        phone: '',
        street_address: '',
        landmark: '',
        city: '',
        state: '',
        pincode: ''
      })
      fetchAddresses()
    } catch (err) {
      setError(err.message || 'Failed to save address')
    } finally {
      setSaving(false)
    }
  }

  // Generate initials for avatar
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <div className="profile-page">

      {/* ── Hero Banner ── */}
      <div className="profile-hero">
        <div className="profile-hero__avatar">{initials}</div>
        <div className="profile-hero__info">
          <h1 className="profile-hero__name">{user?.name || 'My Profile'}</h1>
          <p className="profile-hero__email">{user?.email || user?.phone || ''}</p>
        </div>
        {/* <div className="profile-hero__badge">
          <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
          Member
        </div> */}
      </div>

      {/* ── Account Details Card ── */}
      <div className="profile-card">
        <div className="profile-card__header">
          <h2 className="profile-card__title">
            <i className="fa-solid fa-id-card" />
            Account Details
          </h2>
        </div>
        <div className="profile-card__body">
          {user ? (
            <>
              <div className="detail-row">
                <div className="detail-row__left">
                  <div className="detail-row__icon">
                    <i className="fa-solid fa-user" />
                  </div>
                  <span className="detail-row__label">Full Name</span>
                </div>
                <span className="detail-row__value">{user.name}</span>
              </div>

              <div className="detail-row">
                <div className="detail-row__left">
                  <div className="detail-row__icon">
                    <i className="fa-solid fa-envelope" />
                  </div>
                  <span className="detail-row__label">Email Address</span>
                </div>
                <span className="detail-row__value">{user.email}</span>
              </div>

              <div className="detail-row">
                <div className="detail-row__left">
                  <div className="detail-row__icon">
                    <i className="fa-solid fa-phone" />
                  </div>
                  <span className="detail-row__label">Phone Number</span>
                </div>
                <span className={`detail-row__value ${!user.phone ? 'detail-row__value--muted' : ''}`}>
                  {user.phone || 'Not provided'}
                </span>
              </div>
            </>
          ) : (
            <p style={{ padding: '24px', color: 'var(--text)' }}>Not logged in.</p>
          )}
        </div>
      </div>

      {/* ── Saved Addresses Card ── */}
      <div className="profile-card" id="addresses">
        <div className="profile-card__header">
          <h2 className="profile-card__title">
            <i className="fa-solid fa-location-dot" />
            Saved Addresses
          </h2>
          {!showAddForm && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddForm(true)}
            >
              <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />
              Add New
            </button>
          )}
        </div>

        <div className="profile-card__body">
          {/* Add Address Form */}
          {showAddForm && (
            <div className="address-form-wrapper">
              <h3>New Address</h3>
              {error && <div className="error-message">{error}</div>}
              <form onSubmit={handleSubmit} className="address-form">
                <div className="form-group">
                  <label>Label (Home / Work)</label>
                  <input required name="label" value={formData.label} onChange={handleChange} placeholder="e.g. Home" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input required name="full_name" value={formData.full_name} onChange={handleChange} placeholder="Recipient's name" />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input required name="phone" value={formData.phone} onChange={handleChange} placeholder="+91 00000 00000" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Street Address</label>
                  <textarea required name="street_address" value={formData.street_address} onChange={handleChange} rows={3} placeholder="Flat / House No., Building, Street…" />
                </div>

                <div className="form-group">
                  <label>Landmark (Optional)</label>
                  <input name="landmark" value={formData.landmark} onChange={handleChange} placeholder="Near Metro Station, etc." />
                </div>

                <div className="form-row three-cols">
                  <div className="form-group">
                    <label>City</label>
                    <input required name="city" value={formData.city} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input required name="state" value={formData.state} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Pincode</label>
                    <input required name="pincode" value={formData.pincode} onChange={handleChange} />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Address'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Addresses Grid */}
          {!loading && addresses.length === 0 && !showAddForm ? (
            <div className="empty-address-state">
              <i className="fa-solid fa-map-location-dot" />
              <p>No saved addresses yet.</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(true)}>
                + Add your first address
              </button>
            </div>
          ) : (
            <div className="addresses-grid">
              {addresses.map(addr => (
                <div key={addr.id} className="address-item">
                  <div className="address-item__top">
                    <span className="address-item__label">{addr.label}</span>
                    {addr.is_default && (
                      <span className="address-item__default-badge">
                        <i className="fa-solid fa-check" style={{ marginRight: 4 }} />
                        Default
                      </span>
                    )}
                  </div>
                  <div className="address-item__name">{addr.full_name}</div>
                  <div className="address-item__phone">{addr.phone}</div>
                  <div className="address-item__address">
                    {addr.street_address}<br />
                    {addr.landmark && <>{addr.landmark}<br /></>}
                    {addr.city}, {addr.state} {addr.pincode}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
