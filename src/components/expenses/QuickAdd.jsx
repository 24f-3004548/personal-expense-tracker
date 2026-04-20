import { useState, useRef } from 'react'
import { DEFAULT_CATEGORIES, addExpense } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import DateInput from '../DateInput'
import CategoryIcon from '../CategoryIcon'
import { evaluateAmountExpression, formatAmountForInput } from '../../lib/amountExpression'

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000]

export default function QuickAdd({ onAdded }) {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [focused, setFocused] = useState(false)
  const amountRef = useRef(null)
  const evaluatedAmount = evaluateAmountExpression(amount)
  const hasValidAmount = typeof evaluatedAmount === 'number' && evaluatedAmount > 0

  const submit = async (overrideAmount) => {
    const candidate = overrideAmount ?? evaluatedAmount
    const val = Number(candidate)
    if (!val || val <= 0) {
      amountRef.current?.focus()
      return
    }
    setLoading(true)
    try {
      await addExpense(user.id, {
        amount: val,
        category,
        note: note.trim(),
        date,
      })
      setAmount('')
      setNote('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 1500)
      onAdded?.()
      amountRef.current?.focus()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') submit()
  }

  const handleAmountBlur = () => {
    if (evaluatedAmount === null) return
    setAmount(formatAmountForInput(evaluatedAmount))
  }

  return (
    <div
      className="rounded-xl border p-4 animate-fade-up min-w-0"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Add expense</span>
        {success && (
          <span className="text-xs animate-fade-in" style={{ color: 'var(--green)' }}>
            ✓ Added
          </span>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2" style={{border: `1.5px solid ${focused ? 'var(--ink)' : 'var(--border)'}`, borderRadius: '10px', padding: '10px 12px', transition: 'border-color 0.15s ease',}}>
          <span className="text-lg font-mono" style={{ color: 'var(--ink)' }}>₹</span>
          <input
            ref={amountRef}
            type="text"
            inputMode="text"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={handleKey}
            onBlur={() => {
              handleAmountBlur()
              setFocused(false)
            }}
            onFocus={() => setFocused(true)}
            className="flex-1 text-2xl font-mono font-medium bg-transparent outline-none"
            style={{ color: 'var(--ink)', outline: 'none', boxShadow: 'none' }}
          />
        </div>
        <p className="text-[11px] leading-snug mb-2" style={{ color: 'var(--ink-4)', textAlign: 'center' }}>
          Input supports both simple values or excel like formulas.
        </p>
        <div className="flex flex-wrap gap-1.5 align-center justify-center">
          {QUICK_AMOUNTS.map(q => (
            <button
              key={q}
              onClick={() => setAmount(String(q))}
              className="px-2.5 py-1 text-xs rounded-md transition-all"
              style={{
                background: amount === String(q) ? 'var(--ink)' : 'var(--surface-2)',
                color: amount === String(q) ? 'var(--surface)' : 'var(--ink-3)',
                border: `1px solid ${amount === String(q) ? 'var(--ink)' : 'var(--border)'}`,
              }}
            >
              +{q}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs mb-2" style={{ color: 'var(--ink-4)' }}>Category</p>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_CATEGORIES.map(cat => (
            <button
              key={cat.name}
              onClick={() => setCategory(cat.name)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: category === cat.name ? cat.color + '18' : 'var(--surface-2)',
                color: category === cat.name ? cat.color : 'var(--ink-3)',
                border: `1px solid ${category === cat.name ? 'var(--ink)' : 'var(--border-strong)'}`,
                fontWeight: category === cat.name ? '500' : '400',
              }}
            >
              <CategoryIcon name={cat.name} className="w-3.5 h-3.5" />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={handleKey}
          className="basis-full sm:basis-0 flex-1 min-w-[140px] px-3 py-2 text-sm rounded-lg border outline-none"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border)',
            color: 'var(--ink)',
          }}
        />
        <DateInput
          value={date}
          onChange={setDate}
          max={new Date().toISOString().split('T')[0]}
          containerClassName="basis-full sm:basis-0 flex-1 min-w-[150px]"
          className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border)',
            color: 'var(--ink)',
            textAlign: 'center',
          }}
        />
      </div>

      <button
        onClick={() => submit()}
        disabled={loading || !hasValidAmount}
        className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all ${loading ? 'font-mono' : ''}`}
        style={{
          background: hasValidAmount && !loading ? 'var(--ink)' : 'var(--surface-3)',
          color: hasValidAmount && !loading ? 'var(--surface)' : 'var(--ink-4)',
          cursor: hasValidAmount && !loading ? 'pointer' : 'not-allowed',
        }}
      >
        {loading
          ? 'Adding...'
          : hasValidAmount
            ? `Add ₹${evaluatedAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            : 'Enter amount'}
      </button>
    </div>
  )
}
