import { Link, useParams } from 'react-router-dom'

export default function OrderConfirmationPage() {
  const { orderId } = useParams()
  return (
    <div className="container" style={{ padding: '48px 48px', display:'flex', flexDirection:'column', gap:16 }}>
      <div className="badge badge-signal" style={{ alignSelf:'flex-start' }}>✓ Order Confirmed</div>
      <h1 className="headline-md">Order Placed</h1>
      <p className="truth-sm text-ink-ghost">Order #{orderId}</p>
      <p className="body-sm text-ink-soft">Payment verified successfully in Razorpay Test Mode.</p>
      <Link to="/" className="btn btn-ghost btn-sm" style={{ alignSelf:'flex-start' }}>← Back to Home</Link>
    </div>
  )
}
