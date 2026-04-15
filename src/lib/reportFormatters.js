export const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: '🍜', color: '#f97316' },
  { name: 'Transport', icon: '🚌', color: '#3b82f6' },
  { name: 'Shopping', icon: '🛍️', color: '#a855f7' },
  { name: 'Health', icon: '💊', color: '#ef4444' },
  { name: 'Bills', icon: '📄', color: '#64748b' },
  { name: 'Entertainment', icon: '🎬', color: '#ec4899' },
  { name: 'Education', icon: '📚', color: '#06b6d4' },
  { name: 'Other', icon: '📦', color: '#84cc16' },
]

export const getCategoryMeta = (name) =>
  DEFAULT_CATEGORIES.find((category) => category.name === name) || { name, icon: '📦', color: '#84cc16' }

export const formatCurrencyFull = (amount, currency = '₹') => {
  const num = Number(amount) || 0
  return `${currency}${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}