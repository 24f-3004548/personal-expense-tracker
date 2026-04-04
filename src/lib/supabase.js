import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// ─── Categories ───────────────────────────────────────────────
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
  DEFAULT_CATEGORIES.find((c) => c.name === name) || { name, icon: '📦', color: '#84cc16' }

// ─── Expense helpers ───────────────────────────────────────────
export const getExpenses = async (userId, month, year) => {
  const startDate = new Date(year, month, 1).toISOString().split('T')[0]
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('created_at', { ascending: false })
    .order('date', { ascending: false })

  if (error) throw error
  return data
}

export const addExpense = async (userId, expense) => {
  const { data, error } = await supabase
    .from('expenses')
    .insert([{ ...expense, user_id: userId }])
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateExpense = async (id, updates) => {
  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export const deleteExpense = async (id) => {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

// ─── Income helpers ────────────────────────────────────────────
export const getIncome = async (userId, month, year) => {
  const startDate = new Date(year, month, 1).toISOString().split('T')[0]
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('income')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('created_at', { ascending: false })
    .order('date', { ascending: false })

  if (error) throw error
  return data
}

export const addIncome = async (userId, income) => {
  const { data, error } = await supabase
    .from('income')
    .insert([{ ...income, user_id: userId }])
    .select()
    .single()

  if (error) throw error
  return data
}

// ─── Budget helpers ────────────────────────────────────────────
export const getBudget = async (userId, month, year) => {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export const upsertBudget = async (userId, month, year, amount) => {
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: userId, month, year, amount },
      { onConflict: 'user_id,month,year' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

// ─── Dashboard aggregation ────────────────────────────────────
export const getDashboardData = async (userId, month, year) => {
  const [expenses, income, budget] = await Promise.all([
    getExpenses(userId, month, year),
    getIncome(userId, month, year),
    getBudget(userId, month, year),
  ])

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const totalIncome = income.reduce((sum, i) => sum + Number(i.amount), 0)
  const savings = totalIncome - totalExpenses

  // Category breakdown
  const categoryMap = {}
  expenses.forEach((e) => {
    if (!categoryMap[e.category]) categoryMap[e.category] = 0
    categoryMap[e.category] += Number(e.amount)
  })

  const categoryBreakdown = Object.entries(categoryMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  return {
    expenses,
    income,
    totalExpenses,
    totalIncome,
    savings,
    categoryBreakdown,
    budget,
  }
}

// ─── 6-month trend ────────────────────────────────────────────
export const getMonthlyTrend = async (userId) => {
  const months = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ month: d.getMonth(), year: d.getFullYear() })
  }

  const results = await Promise.all(
    months.map(async ({ month, year }) => {
      const [expenses, income] = await Promise.all([
        getExpenses(userId, month, year),
        getIncome(userId, month, year),
      ])
      return {
        month,
        year,
        expenses: expenses.reduce((s, e) => s + Number(e.amount), 0),
        income: income.reduce((s, i) => s + Number(i.amount), 0),
      }
    })
  )

  return results
}

// ─── Format currency ──────────────────────────────────────────
export const formatCurrency = (amount, currency = '₹') => {
  const num = Number(amount) || 0
  if (num >= 100000) return `${currency}${(num / 100000).toFixed(1)}L`
  if (num >= 1000) return `${currency}${(num / 1000).toFixed(1)}k`
  return `${currency}${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export const formatCurrencyFull = (amount, currency = '₹') => {
  const num = Number(amount) || 0
  return `${currency}${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export const formatDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
