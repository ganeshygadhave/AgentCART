import React, { useEffect, useState } from 'react'
import { usersApi } from '../../services/api'
import './AddressSelector.css'

export default function AddressSelector({ userId, onConfirm }) {
  const [addresses, setAddresses] = useState([])
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form state
  const [formData, setFormData] = useState({
    label: '',
    full_name: '',
    phone: '',
    street_address: '',
    city: '',
    state: '',
    pincode: ''
  })

  useEffect(() => {
    fetchAddresses()
  }, [])

  const fetchAddresses = async () => {
    try {
      setLoading(true)
      const res = await usersApi.getAddresses()
      setAddresses(res.data)
      if (res.data.length > 0) {
        setSelectedAddress(res.data[0])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await usersApi.addAddress(formData)
      const newAddress = res.data
      setAddresses([...addresses, newAddress])
      setSelectedAddress(newAddress)
      setShowAddForm(false)
      setFormData({ label: '', full_name: '', phone: '', street_address: '', city: '', state: '', pincode: '' })
    } catch (err) {
      console.error(err)
    }
  }

  const handleConfirm = () => {
    if (selectedAddress && onConfirm) {
      onConfirm(selectedAddress)
    }
  }

  if (loading) {
    return <div className="address-selector loading">Loading addresses...</div>
  }

  return (
    <div className="address-selector">
      <div className="address-selector-header">
        📍 SELECT DELIVERY ADDRESS
      </div>

      <div className="address-list">
        {addresses.map((addr) => (
          <div 
            key={addr.id} 
            className={`address-row ${selectedAddress?.id === addr.id ? 'selected' : ''}`}
            onClick={() => setSelectedAddress(addr)}
          >
            <div className="address-label-badge">{addr.label || 'OTHER'}</div>
            <div className="address-details">
              <div className="address-name">{addr.full_name} <span className="address-phone">{addr.phone}</span></div>
              <div className="address-street">{addr.street_address}</div>
              <div className="address-city">{addr.city}, {addr.state} {addr.pincode}</div>
            </div>
            <div className={`address-radio ${selectedAddress?.id === addr.id ? 'active' : ''}`}></div>
          </div>
        ))}
      </div>

      {!showAddForm ? (
        <button className="btn-add-address" onClick={() => setShowAddForm(true)}>
          + Add New Address
        </button>
      ) : (
        <form className="add-address-form" onSubmit={handleAddSubmit}>
          <div className="form-group">
            <label>LABEL (E.G. HOME, WORK)</label>
            <input required type="text" name="label" value={formData.label} onChange={handleFormChange} />
          </div>
          <div className="form-group">
            <label>FULL NAME</label>
            <input required type="text" name="full_name" value={formData.full_name} onChange={handleFormChange} />
          </div>
          <div className="form-group">
            <label>PHONE</label>
            <input required type="tel" name="phone" value={formData.phone} onChange={handleFormChange} />
          </div>
          <div className="form-group">
            <label>STREET ADDRESS</label>
            <input required type="text" name="street_address" value={formData.street_address} onChange={handleFormChange} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>CITY</label>
              <input required type="text" name="city" value={formData.city} onChange={handleFormChange} />
            </div>
            <div className="form-group">
              <label>STATE</label>
              <input required type="text" name="state" value={formData.state} onChange={handleFormChange} />
            </div>
            <div className="form-group">
              <label>PINCODE</label>
              <input required type="text" name="pincode" value={formData.pincode} onChange={handleFormChange} />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button type="submit" className="btn-save">Save Address</button>
          </div>
        </form>
      )}

      {addresses.length > 0 && !showAddForm && (
        <button className="btn-confirm-address" onClick={handleConfirm} disabled={!selectedAddress}>
          Confirm Address
        </button>
      )}
    </div>
  )
}
