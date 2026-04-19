import { useState } from 'react'
import { addIncome } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import DateInput from '../DateInput'

function toLocalDateInputValue(value) {
  const d = new Date(value)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AddIncomeModal({ onClose, onAdded, month, year }) {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const today = new Date()
  const defaultDate = new Date(year, month, Math.min(today.getDate(), new Date(year, month + 1, 0).getDate()))
  const [date, setDate] = useState(toLocalDateInputValue(defaultDate))
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    if (!amount || Number(amount) <= 0) return
    setLoading(true)
    try {
      await addIncome(user.id, { amount: Number(amount), note: note.trim(), date })
      onAdded?.()
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border p-5 animate-fade-up"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Add income</h3>
          <button onClick={onClose} style={{ color: 'var(--ink-4)' }}>✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-4)' }}>Amount</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <span className="font-mono text-sm" style={{ color: 'var(--ink-4)' }}>₹</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm font-mono font-medium"
                style={{ color: 'var(--ink)' }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-4)' }}>Note</label>
            <input
              type="text"
              placeholder="Salary, freelance..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--ink-4)' }}>Date</label>
            <DateInput
              value={date}
              onChange={setDate}
              max={toLocalDateInputValue(new Date())}
              className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={loading || !amount}
          className={`w-full mt-4 py-2.5 text-sm font-medium rounded-lg transition-all ${loading ? 'font-mono' : ''}`}
          style={{
            background: amount && !loading ? 'var(--green)' : 'var(--surface-3)',
            color: amount && !loading ? 'white' : 'var(--ink-4)',
          }}
        >
          {loading ? 'Adding...' : amount ? `Add ₹${Number(amount).toLocaleString('en-IN')}` : 'Enter amount'}
        </button>
      </div>
    </div>
  )
}
