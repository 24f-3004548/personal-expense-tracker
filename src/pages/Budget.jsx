import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getBudget, upsertBudget, getExpenses,
  getCategoryMeta, formatCurrencyFull, DEFAULT_CATEGORIES, MONTH_NAMES
} from '../lib/supabase'

const now = new Date()

export default function Budget() {
  const { user } = useAuth()
  const [budget, setBudget] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, e] = await Promise.all([
        getBudget(user.id, now.getMonth(), now.getFullYear()),
        getExpenses(user.id, now.getMonth(), now.getFullYear()),
      ])
      setBudget(b)
      setInput(b?.amount?.toString() || '')
      setExpenses(e)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [user.id])

  useEffect(() => { load() }, [load])

  const saveBudget = async () => {
    if (!input || Number(input) <= 0) return
    setSaving(true)
    try {
      const b = await upsertBudget(user.id, now.getMonth(), now.getFullYear(), Number(input))
      setBudget(b)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const budgetAmount = budget?.amount || 0
  const remaining = budgetAmount - totalSpent
  const pct = budgetAmount ? Math.min((totalSpent / budgetAmount) * 100, 100) : 0
  const isOver = remaining < 0

  // Category breakdown
  const catMap = {}
  expenses.forEach(e => {
    if (!catMap[e.category]) catMap[e.category] = 0
    catMap[e.category] += Number(e.amount)
  })
  const cats = Object.entries(catMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  return (
    <div className="max-w-xl mx-auto px-4 py-6 md:py-8">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-base font-medium mb-0.5" style={{ color: 'var(--ink)' }}>Budget</h1>
        <p className="text-xs" style={{ color: 'var(--ink-4)' }}>{MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</p>
      </div>

      {/* Budget setter */}
      <div className="rounded-xl border p-4 mb-4 animate-fade-up stagger-1"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-xs mb-3" style={{ color: 'var(--ink-4)' }}>Monthly budget</p>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-lg border"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <span className="font-mono text-sm" style={{ color: 'var(--ink-4)' }}>₹</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="e.g. 30000"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveBudget()}
              className="flex-1 bg-transparent outline-none text-sm font-mono font-medium"
              style={{ color: 'var(--ink)' }}
            />
          </div>
          <button
            onClick={saveBudget}
            disabled={saving || !input}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              background: input ? 'var(--ink)' : 'var(--surface-3)',
              color: input ? 'var(--surface)' : 'var(--ink-4)',
            }}
          >
            {saved ? '✓' : saving ? '...' : 'Set'}
          </button>
        </div>
      </div>

      {/* Progress */}
      {budgetAmount > 0 && (
        <div className="rounded-xl border p-4 mb-4 animate-fade-up stagger-2"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex justify-between items-baseline mb-3">
            <div>
              <p className="text-2xl font-mono font-medium" style={{ color: isOver ? 'var(--red)' : 'var(--ink)' }}>
                {formatCurrencyFull(totalSpent)}
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
                of {formatCurrencyFull(budgetAmount)} budget
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono" style={{ color: isOver ? 'var(--red)' : 'var(--green)' }}>
                {isOver ? '-' : '+'}{formatCurrencyFull(Math.abs(remaining))}
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
                {isOver ? 'over' : 'remaining'}
              </p>
            </div>
          </div>

          <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--surface-3)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${pct}%`,
                background: pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--green)',
              }}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
            {Math.round(pct)}% used
            {isOver && <span style={{ color: 'var(--red)' }}> — budget exceeded</span>}
            {!isOver && pct >= 80 && <span style={{ color: 'var(--amber)' }}> — close to limit</span>}
          </p>
        </div>
      )}

      {/* Category breakdown */}
      {cats.length > 0 && (
        <div className="rounded-xl border overflow-hidden animate-fade-up stagger-3"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Spending by category</p>
          </div>
          {cats.map(cat => {
            const meta = getCategoryMeta(cat.name)
            const catPct = totalSpent ? (cat.amount / totalSpent) * 100 : 0
            return (
              <div key={cat.name} className="px-4 py-3 border-b last:border-0"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span>{meta.icon}</span>
                    <span className="text-sm" style={{ color: 'var(--ink)' }}>{cat.name}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs" style={{ color: 'var(--ink-4)' }}>{catPct.toFixed(0)}%</span>
                    <span className="text-sm font-mono" style={{ color: 'var(--ink)' }}>{formatCurrencyFull(cat.amount)}</span>
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${catPct}%`, background: meta.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && cats.length === 0 && budgetAmount === 0 && (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: 'var(--ink-4)' }}>Set a budget above to start tracking</p>
        </div>
      )}
    </div>
  )
}
