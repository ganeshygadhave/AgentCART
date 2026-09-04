/**
 * AgentCART — Utility Helpers
 */

/** Format paise integer to Indian Rupee string */
export function formatPrice(paise) {
  if (paise == null) return '₹0.00'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100)
}

/** Format a price in rupees (float) */
export function formatRupees(rupees) {
  if (rupees == null) return '₹0.00'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees)
}

/** Calculate discount percentage */
export function discountPercent(original, current) {
  if (!original || original <= current) return null
  return Math.round(((original - current) / original) * 100)
}

/** Generate a random session ID */
export function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substr(2, 16)
}

/** Format a star rating (e.g. 4.7 → "4.7") */
export function formatRating(rating) {
  if (!rating) return null
  return rating.toFixed(1)
}

/** Truncate text to N characters */
export function truncate(text, maxLen = 80) {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trim() + '…'
}

/** Format a date as "27 Aug 2026" */
export function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Format a date as "27 Aug 2026, 1:05 PM" */
export function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Clamp a number between min and max */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/** Parse JSON tags from product */
export function parseTags(tagsJson) {
  try {
    return JSON.parse(tagsJson || '[]')
  } catch {
    return []
  }
}
