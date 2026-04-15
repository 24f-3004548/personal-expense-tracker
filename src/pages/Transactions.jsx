import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import DateInput from '../components/DateInput'
import {
  getExpenses, getIncome, deleteExpense, updateExpense, deleteIncome, updateIncome,
  DEFAULT_CATEGORIES, getCategoryMeta, formatCurrencyFull, formatDate, formatTime, MONTH_NAMES
} from '../lib/supabase'

const now = new Date()

export default function Transactions() {
  const { user } = useAuth()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [expenses, setExpenses] = useState([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [expData, incData] = await Promise.all([
        getExpenses(user.id, month, year),
        getIncome(user.id, month, year),
      ])
      const combined = [
        ...expData.map(e => ({ ...e, _type: 'expense' })),
        ...incData.map(i => ({ ...i, _type: 'income', category: 'Income', note: i.note || 'Income' })),
      ].sort((a, b) => {
        const at = new Date(a.created_at || `${a.date}T00:00:00`).getTime()
        const bt = new Date(b.created_at || `${b.date}T00:00:00`).getTime()
        return bt - at
      })
      setExpenses(combined)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [user.id, month, year])

  useEffect(() => { load() }, [load])

  const handleDelete = async (item) => {
    const isIncome = item._type === 'income'
    if (!confirm(`Delete this ${isIncome ? 'income entry' : 'expense'}?`)) return
    try {
      if (isIncome) await deleteIncome(item.id)
      else await deleteExpense(item.id)

      setExpenses(prev => prev.filter(e => !(e.id === item.id && e._type === item._type)))
    } catch (e) {
      console.error(e)
      alert(`Couldn't delete ${isIncome ? 'income entry' : 'expense'}. Please try again.`)
    }
  }

  const startEdit = (item) => {
    setEditing(`${item._type}-${item.id}`)
    setEditForm({
      amount: item.amount,
      category: item.category,
      note: item.note || '',
      date: item.date,
    })
  }

  const saveEdit = async (item) => {
    const amount = Number(editForm.amount)
    if (!amount || amount <= 0 || !editForm.date) {
      alert('Enter a valid amount and date.')
      return
    }

    const isIncome = item._type === 'income'
    const payload = isIncome
      ? {
          amount,
          note: editForm.note,
          date: editForm.date,
        }
      : {
          amount,
          category: editForm.category,
          note: editForm.note,
          date: editForm.date,
        }

    setSaving(true)
    try {
      if (isIncome) await updateIncome(item.id, payload)
      else await updateExpense(item.id, payload)

      setExpenses(prev => prev.map(e => (
        e.id === item.id && e._type === item._type
          ? { ...e, ...payload, category: isIncome ? 'Income' : payload.category }
          : e
      )))
      setEditing(null)
    } catch (e) {
      console.error(e)
      alert(`Couldn't save ${isIncome ? 'income entry' : 'expense'}. If this continues, run the latest Supabase schema policies.`)
    } finally {
      setSaving(false)
    }
  }

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const filtered = filter === 'All' ? expenses : expenses.filter(e => e.category === filter)
  const total = filtered.filter(i => i._type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
  const grouped = {}
  filtered.forEach((item) => {
    if (!grouped[item.date]) grouped[item.date] = []
    grouped[item.date].push(item)
  })
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-up">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="text-sm" style={{ color: 'var(--ink-3)' }}>‹</button>
          <h1 className="text-base font-medium" style={{ color: 'var(--ink)' }}>
            {MONTH_NAMES[month]} {year !== now.getFullYear() ? year : ''}
          </h1>
          <button onClick={nextMonth}
            disabled={month === now.getMonth() && year === now.getFullYear()}
            className="text-sm" style={{ color: 'var(--ink-3)' }}>›</button>
        </div>
        <span className="text-sm font-mono" style={{ color: 'var(--ink-3)' }}>
          {formatCurrencyFull(total)}
        </span>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap mb-4 animate-fade-up stagger-1">
        {['All', ...DEFAULT_CATEGORIES.map(c => c.name), 'Income'].map(cat => {
          const meta = cat !== 'All' ? getCategoryMeta(cat) : null
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg transition-all border"
              style={{
                background: filter === cat ? (meta ? meta.color + '18' : 'var(--ink)') : 'var(--surface)',
                color: filter === cat ? (meta ? meta.color : 'var(--surface)') : 'var(--ink-3)',
                borderColor: filter === cat ? (meta ? meta.color + '40' : 'var(--ink)') : 'var(--border)',
              }}
            >
              {meta && <span>{meta.icon}</span>}
              {cat}
            </button>
          )
        })}
      </div>

      {/* Transactions */}
      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--ink-4)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No transactions found</p>
        </div>
      ) : (
        <div className="animate-fade-up stagger-2">
          {sortedDates.map(date => (
            <div key={date} className="mb-3">
              <p className="text-xs px-1 mb-1.5" style={{ color: 'var(--ink-4)' }}>{formatDate(date)}</p>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {grouped[date].map(item => {
            const meta = item._type === 'income'
              ? { icon: '💰', color: 'var(--green)' }
              : getCategoryMeta(item.category)
            const isEdit = editing === `${item._type}-${item.id}`

            if (isEdit) {
              return (
                <div key={`${item._type}-${item.id}`} className="p-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--ink-4)' }}>Amount</label>
                      <input
                        type="number"
                        value={editForm.amount}
                        onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full px-2.5 py-2 text-sm rounded-lg border outline-none"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--ink-4)' }}>Date</label>
                      <DateInput
                        value={editForm.date}
                        onChange={(value) => setEditForm(f => ({ ...f, date: value }))}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-2.5 py-2 text-sm rounded-lg border outline-none"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-xs block mb-1" style={{ color: 'var(--ink-4)' }}>Note</label>
                    <input
                      type="text"
                      value={editForm.note}
                      onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                      className="w-full px-2.5 py-2 text-sm rounded-lg border outline-none"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
                    />
                  </div>
                  {item._type === 'expense' && (
                    <div className="mb-3">
                      <label className="text-xs block mb-1" style={{ color: 'var(--ink-4)' }}>Category</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DEFAULT_CATEGORIES.map(cat => (
                          <button
                            key={cat.name}
                            onClick={() => setEditForm(f => ({ ...f, category: cat.name }))}
                            className="px-2 py-1 text-xs rounded-lg border transition-all"
                            style={{
                              background: editForm.category === cat.name ? cat.color + '18' : 'var(--surface)',
                              color: editForm.category === cat.name ? cat.color : 'var(--ink-4)',
                              borderColor: editForm.category === cat.name ? 'var(--ink)' : 'var(--border-strong)',
                            }}
                          >
                            {cat.icon} {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(item)} disabled={saving}
                      className="flex-1 py-2 text-xs font-medium rounded-lg"
                      style={{ background: 'var(--ink)', color: 'var(--surface)' }}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditing(null)} className="px-4 py-2 text-xs rounded-lg border"
                      style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div key={`${item._type}-${item.id}`}
                className="group flex items-center gap-3 px-4 py-3 border-b last:border-0 transition-colors"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                  style={{ background: item._type === 'income' ? 'var(--green-light)' : meta.color + '15' }}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--ink)' }}>
                    {item.note || item.category}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
                    {item.category} · {formatTime(item.created_at)}
                  </p>
                </div>
                <p className="text-sm font-mono font-medium shrink-0" style={{ color: item._type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                  {item._type === 'income' ? '+' : '−'}{formatCurrencyFull(item.amount)}
                </p>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(item)}
                    className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded text-xs"
                    style={{ color: 'var(--ink-4)' }} title="Edit">
                    ✎
                  </button>
                  <button onClick={() => handleDelete(item)}
                    className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded text-xs"
                    style={{ color: 'var(--red)' }} title="Delete">
                    ×
                  </button>
                </div>
              </div>
            )
          })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
