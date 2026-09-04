import React from 'react'
import './OrderStepper.css'

export default function OrderStepper({ status, tracking_link, tracking_carrier, shipped_at, delivered_at }) {
  const steps = [
    { id: 'placed', label: 'Placed', matches: ['pending', 'confirmed', 'payment_initiated', 'paid', 'shipped', 'in_transit', 'delivered'] },
    { id: 'paid', label: 'Paid', matches: ['paid', 'shipped', 'in_transit', 'delivered'] },
    { id: 'shipped', label: 'Shipped', matches: ['shipped', 'in_transit', 'delivered'] },
    { id: 'in_transit', label: 'In-Transit', matches: ['in_transit', 'delivered'] },
    { id: 'delivered', label: 'Delivered', matches: ['delivered'] },
  ]

  const getStepStatus = (matches) => {
    return matches.includes(status) ? 'completed' : 'pending'
  }

  // Find the index of the last completed step to correctly draw the lines
  const currentStepIndex = steps.map(s => getStepStatus(s.matches)).lastIndexOf('completed')

  return (
    <div className="order-stepper-container">
      <div className="order-stepper">
        {steps.map((step, index) => {
          const isCompleted = getStepStatus(step.matches) === 'completed'
          const isLast = index === steps.length - 1
          const lineCompleted = index < currentStepIndex
          
          return (
            <div key={step.id} className={`stepper-item ${isCompleted ? 'completed' : ''}`}>
              <div className="stepper-indicator-container">
                <div className={`stepper-icon ${isCompleted ? 'active' : ''}`}>
                  {isCompleted ? '✓' : '○'}
                </div>
                {!isLast && (
                  <div className={`stepper-line ${lineCompleted ? 'active' : ''}`}></div>
                )}
              </div>
              <div className="stepper-label">{step.label}</div>
            </div>
          )
        })}
      </div>

      {(tracking_link || tracking_carrier) && (
        <div className="tracking-info">
          {tracking_link && (
            <a href={tracking_link} target="_blank" rel="noopener noreferrer" className="tracking-link">
              🔗 Track Package
            </a>
          )}
          {tracking_carrier && (
            <span className="tracking-carrier"> via {tracking_carrier}</span>
          )}
        </div>
      )}
    </div>
  )
}
