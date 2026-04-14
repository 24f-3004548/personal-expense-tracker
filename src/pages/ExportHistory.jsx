import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { formatCurrencyFull, getTransactionsInRange, supabase } from '../lib/supabase'
import { buildTransactionReportHtml, buildTransactionWorkbookBase64 } from '../lib/transactionExport'

const today = new Date()
const defaultStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const defaultEndDate = today.toISOString().split('T')[0]

const formatLongDate = (dateStr) => new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export default function ExportHistory() {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    if (!user?.id || !startDate || !endDate || startDate > endDate) {
      setTransactions([])
      setLoading(false)
      return
    }

    let active = true

    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const data = await getTransactionsInRange(user.id, startDate, endDate)
        if (active) setTransactions(data)
      } catch (requestError) {
        console.error(requestError)
        if (active) {
          setTransactions([])
          setLoadError('Unable to load the selected range right now.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [user?.id, startDate, endDate])

  const summary = useMemo(() => {
    const totalIncome = transactions.filter((transaction) => transaction._type === 'income').reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
    const totalExpenses = transactions.filter((transaction) => transaction._type === 'expense').reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
    const net = totalIncome - totalExpenses

    return {
      totalIncome,
      totalExpenses,
      net,
      transactionCount: transactions.length,
      incomeCount: transactions.filter((transaction) => transaction._type === 'income').length,
      expenseCount: transactions.filter((transaction) => transaction._type === 'expense').length,
    }
  }, [transactions])

  const canExport = Boolean(user?.email) && startDate <= endDate && !loading && transactions.length > 0 && !exporting

  const handleExport = async () => {
    if (!canExport) return

    setExporting(true)
    setMessage('')
    setExportError('')

    try {
      const html = await buildTransactionReportHtml({
        userName: user?.user_metadata?.name || user?.email?.split('@')[0] || 'You',
        startDate,
        endDate,
        transactions,
      })
      const workbookBase64 = await buildTransactionWorkbookBase64(transactions, startDate, endDate)

      const { data, error: fnError } = await supabase.functions.invoke('resend-email', {
        body: {
          to: user.email,
          subject: 'Transaction Report - ' + formatLongDate(startDate) + ' to ' + formatLongDate(endDate),
          html,
          attachments: [
            {
              filename: `transaction-history-${startDate}-to-${endDate}.xlsx`,
              content: workbookBase64,
            },
          ],
        },
      })

      if (fnError) {
        throw new Error(fnError.message || 'Email function failed')
      }

      setMessage(`Report sent to ${user.email}.`)
    } catch (exportError) {
      console.error(exportError)
      setExportError(exportError?.message || 'We could not send the email. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center justify-between mb-6 animate-fade-up">
        <h1 className="text-base font-medium" style={{ color: 'var(--ink)' }}>Export history</h1>
        <span className="text-xs truncate max-w-[180px]" style={{ color: 'var(--ink-4)' }}>{user?.email || 'No email available'}</span>
      </div>

      <div className="rounded-2xl border p-4 mb-4 animate-fade-up stagger-1" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-xs uppercase tracking-[0.16em] mb-3" style={{ color: 'var(--ink-4)' }}>Date range</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-4)' }}>Start date</label>
            <input
              type="date"
              value={startDate}
              max={today.toISOString().split('T')[0]}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-4)' }}>End date</label>
            <input
              type="date"
              value={endDate}
              max={today.toISOString().split('T')[0]}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
          </div>
        </div>
        {startDate > endDate && (
          <p className="text-xs mt-3" style={{ color: 'var(--red)' }}>Start date must be before or equal to the end date.</p>
        )}
      </div>

      <div className="rounded-2xl border p-4 animate-fade-up stagger-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <h2 className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {formatLongDate(startDate)} - {formatLongDate(endDate)}
          </h2>
          <span className="text-xs font-mono" style={{ color: 'var(--ink-3)' }}>{summary.transactionCount} total</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--ink-4)' }}>Loading transactions...</div>
        ) : loadError ? (
          <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--red)', background: 'var(--red-light)', color: 'var(--red)' }}>{loadError}</div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--ink-4)' }}>No transactions found for this range.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { label: 'Income', value: formatCurrencyFull(summary.totalIncome), color: 'var(--green)' },
                { label: 'Expenses', value: formatCurrencyFull(summary.totalExpenses), color: 'var(--ink)' },
                { label: 'Net', value: formatCurrencyFull(summary.net), color: summary.net >= 0 ? 'var(--green)' : 'var(--red)' },
                { label: 'Transactions', value: summary.transactionCount, color: 'var(--ink)' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--ink-4)' }}>{stat.label}</p>
                  <p className="text-lg font-mono font-medium" style={{ color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border px-3 py-2.5 mb-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              {[
                { label: 'Transactions', value: summary.transactionCount },
                { label: 'Expense entries', value: summary.expenseCount },
                { label: 'Income entries', value: summary.incomeCount },
              ].map((row, index) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-1.5 text-sm"
                  style={{
                    color: 'var(--ink-3)',
                    borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <span>{row.label}</span>
                  <span className="font-mono" style={{ color: 'var(--ink)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {message && (
          <div className="rounded-xl border p-3 mb-3 text-sm" style={{ borderColor: 'var(--green)', background: 'var(--green-light)', color: 'var(--green)' }}>
            {message}
          </div>
        )}
        {exportError && !loading && transactions.length > 0 && (
          <div className="rounded-xl border p-3 mb-3 text-sm" style={{ borderColor: 'var(--red)', background: 'var(--red-light)', color: 'var(--red)' }}>
            {exportError}
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={!canExport}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all"
          style={{
            background: canExport ? 'var(--ink)' : 'var(--surface-3)',
            color: canExport ? 'var(--surface)' : 'var(--ink-4)',
          }}
        >
          {exporting ? 'Sending report...' : 'Email transaction report'}
        </button>
      </div>
    </div>
  )
}
