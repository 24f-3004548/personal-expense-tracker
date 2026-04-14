import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { formatCurrencyFull, getCategoryMeta, getTransactionsInRange } from '../lib/supabase'
import { buildTransactionReportHtml, buildTransactionWorkbookBase64 } from '../lib/transactionExport'

const DAY_MS = 24 * 60 * 60 * 1000
const today = new Date()
const defaultStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const defaultEndDate = today.toISOString().split('T')[0]

const formatLongDate = (dateStr) => new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const buildTimelineBuckets = (transactions, startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const totalDays = Math.max(1, Math.round((end - start) / DAY_MS) + 1)
  const bucketSize = Math.max(1, Math.ceil(totalDays / 10))
  const buckets = []

  for (let offset = 0; offset < totalDays; offset += bucketSize) {
    const bucketStart = new Date(start)
    bucketStart.setDate(bucketStart.getDate() + offset)
    const bucketEnd = new Date(bucketStart)
    bucketEnd.setDate(bucketEnd.getDate() + bucketSize - 1)
    if (bucketEnd > end) bucketEnd.setTime(end.getTime())

    buckets.push({
      start: bucketStart,
      end: bucketEnd,
      label: bucketSize === 1
        ? bucketStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : `${bucketStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${bucketEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      income: 0,
      expenses: 0,
    })
  }

  transactions.forEach((transaction) => {
    const transactionDate = new Date(`${transaction.date}T00:00:00`)
    const offset = Math.max(0, Math.min(totalDays - 1, Math.floor((transactionDate - start) / DAY_MS)))
    const bucketIndex = Math.min(buckets.length - 1, Math.floor(offset / bucketSize))
    const bucket = buckets[bucketIndex]
    const amount = Number(transaction.amount) || 0
    if (transaction._type === 'income') bucket.income += amount
    else bucket.expenses += amount
  })

  return buckets
}

const buildCategoryBreakdown = (transactions) => {
  const totals = {}

  transactions.forEach((transaction) => {
    if (transaction._type !== 'expense') return
    const amount = Number(transaction.amount) || 0
    totals[transaction.category] = (totals[transaction.category] || 0) + amount
  })

  return Object.entries(totals)
    .map(([name, amount]) => ({ name, amount, ...getCategoryMeta(name) }))
    .sort((a, b) => b.amount - a.amount)
}

export default function ExportHistory() {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id || !startDate || !endDate || startDate > endDate) {
      setTransactions([])
      setLoading(false)
      return
    }

    let active = true

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getTransactionsInRange(user.id, startDate, endDate)
        if (active) setTransactions(data)
      } catch (requestError) {
        console.error(requestError)
        if (active) {
          setTransactions([])
          setError('Unable to load the selected range right now.')
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
    const categoryBreakdown = buildCategoryBreakdown(transactions)
    const timelineBuckets = buildTimelineBuckets(transactions, startDate, endDate)

    return {
      totalIncome,
      totalExpenses,
      net,
      transactionCount: transactions.length,
      incomeCount: transactions.filter((transaction) => transaction._type === 'income').length,
      expenseCount: transactions.filter((transaction) => transaction._type === 'expense').length,
      categoryBreakdown,
      timelineBuckets,
    }
  }, [transactions, startDate, endDate])

  const maxTimelineValue = useMemo(() => {
    return Math.max(1, ...summary.timelineBuckets.map((bucket) => Math.max(bucket.income, bucket.expenses)))
  }, [summary.timelineBuckets])

  const canExport = Boolean(user?.email) && startDate <= endDate && !loading && transactions.length > 0 && !exporting

  const handleExport = async () => {
    if (!canExport) return

    setExporting(true)
    setMessage('')
    setError('')

    try {
      const html = buildTransactionReportHtml({
        userName: user?.user_metadata?.name || user?.email?.split('@')[0] || 'You',
        startDate,
        endDate,
        transactions,
      })
      const workbookBase64 = await buildTransactionWorkbookBase64(transactions, startDate, endDate)

      await fetch('https://opuwlnvmaxdrssbzmqnz.supabase.co/functions/v1/resend-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: user.email,
          subject: 'Your Transaction Report',
          html,
          attachments: [
            {
              filename: `transaction-history-${startDate}-to-${endDate}.xlsx`,
              content: workbookBase64,
            },
          ],
        }),
      })

      setMessage(`Report sent to ${user.email}.`)
    } catch (exportError) {
      console.error(exportError)
      setError('We could not send the email. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
      <div className="relative overflow-hidden rounded-3xl border mb-5 animate-fade-up" style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)' }}>
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, transparent, var(--ink), transparent)', opacity: 0.08 }} />
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--ink-4)' }}>Export history</p>
              <h1 className="text-2xl md:text-3xl font-medium leading-tight" style={{ color: 'var(--ink)' }}>Send a transaction report by email</h1>
              <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--ink-3)' }}>
                Pick a date range, preview the totals, and email yourself an HTML report with charts plus an Excel workbook.
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3 min-w-[220px]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--ink-4)' }}>Recipient</p>
              <p className="text-sm font-medium break-all" style={{ color: 'var(--ink)' }}>{user?.email || 'No email available'}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
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
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-3xl border p-4 md:p-5 animate-fade-up stagger-1" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--ink-4)' }}>Preview</p>
                <h2 className="text-lg font-medium" style={{ color: 'var(--ink)' }}>{formatLongDate(startDate)} - {formatLongDate(endDate)}</h2>
              </div>
              <p className="text-xs font-mono" style={{ color: 'var(--ink-3)' }}>
                {summary.transactionCount} total
              </p>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm" style={{ color: 'var(--ink-4)' }}>Loading transactions...</div>
            ) : error ? (
              <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--red)' }}>{error}</div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No transactions found for this range.</p>
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Income', value: formatCurrencyFull(summary.totalIncome), color: 'var(--green)' },
                    { label: 'Expenses', value: formatCurrencyFull(summary.totalExpenses), color: 'var(--ink)' },
                    { label: 'Net', value: formatCurrencyFull(summary.net), color: summary.net >= 0 ? 'var(--green)' : 'var(--red)' },
                    { label: 'Count', value: summary.transactionCount, color: 'var(--ink)' },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--ink-4)' }}>{stat.label}</p>
                      <p className="text-xl font-mono font-medium" style={{ color: stat.color }}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border p-4 mb-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--ink-4)' }}>Timeline</p>
                    <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Income vs expenses by bucket</p>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(44px,1fr))] gap-2 items-end min-h-[220px]">
                    {summary.timelineBuckets.map((bucket) => {
                      const incomeHeight = Math.max(4, Math.round((bucket.income / maxTimelineValue) * 150))
                      const expenseHeight = Math.max(4, Math.round((bucket.expenses / maxTimelineValue) * 150))
                      return (
                        <div key={`${bucket.label}-${bucket.start.toISOString()}`} className="flex flex-col items-center gap-2 min-w-0">
                          <div className="flex items-end gap-1 h-[160px] w-full justify-center">
                            <div className="w-4 rounded-full" style={{ height: `${incomeHeight}px`, background: 'var(--green)' }} title="Income" />
                            <div className="w-4 rounded-full" style={{ height: `${expenseHeight}px`, background: 'var(--ink)' }} title="Expenses" />
                          </div>
                          <p className="text-[10px] text-center leading-tight" style={{ color: 'var(--ink-4)' }}>{bucket.label}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="flex items-baseline justify-between gap-3 mb-4">
                    <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--ink-4)' }}>Category breakdown</p>
                    <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Expense categories only</p>
                  </div>
                  {summary.categoryBreakdown.length > 0 ? (
                    <div className="space-y-3">
                      {summary.categoryBreakdown.map((category) => {
                        const percent = summary.totalExpenses > 0 ? Math.round((category.amount / summary.totalExpenses) * 100) : 0
                        return (
                          <div key={category.name}>
                            <div className="flex items-center justify-between gap-3 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span>{category.icon}</span>
                                <span className="text-sm truncate" style={{ color: 'var(--ink)' }}>{category.name}</span>
                              </div>
                              <p className="text-xs font-mono shrink-0" style={{ color: 'var(--ink-3)' }}>{formatCurrencyFull(category.amount)} · {percent}%</p>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.max(percent, 1)}%`, background: category.color }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No expense categories in this range.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border p-4 md:p-5 animate-fade-up stagger-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <p className="text-xs uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--ink-4)' }}>Send report</p>
            <p className="text-sm mb-4" style={{ color: 'var(--ink-3)' }}>The email will include the chart summary in HTML and an Excel workbook with every transaction in the selected range.</p>

            {message && (
              <div className="rounded-2xl border p-3 mb-4 text-sm" style={{ borderColor: 'var(--green)', background: 'var(--green-light)', color: 'var(--green)' }}>
                {message}
              </div>
            )}
            {error && !loading && (
              <div className="rounded-2xl border p-3 mb-4 text-sm" style={{ borderColor: 'var(--red)', background: 'var(--red-light)', color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={!canExport}
              className="w-full py-3 rounded-2xl text-sm font-medium transition-all"
              style={{
                background: canExport ? 'var(--ink)' : 'var(--surface-3)',
                color: canExport ? 'var(--surface)' : 'var(--ink-4)',
              }}
            >
              {exporting ? 'Sending report...' : 'Email transaction report'}
            </button>

            <div className="mt-4 space-y-2 text-xs" style={{ color: 'var(--ink-4)' }}>
              <p>Subject: Your Transaction Report</p>
              <p>Attachment: transaction-history-{startDate}-to-{endDate}.xlsx</p>
            </div>
          </div>

          <div className="rounded-3xl border p-4 md:p-5 animate-fade-up stagger-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <p className="text-xs uppercase tracking-[0.16em] mb-3" style={{ color: 'var(--ink-4)' }}>Latest rows</p>
            <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
              {transactions.slice(0, 8).map((transaction) => {
                const meta = transaction._type === 'income' ? { icon: '💰', color: 'var(--green)' } : getCategoryMeta(transaction.category)
                return (
                  <div key={`${transaction._type}-${transaction.id}`} className="flex items-center gap-3 rounded-2xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: transaction._type === 'income' ? 'var(--green-light)' : meta.color + '15' }}>
                      {meta.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate" style={{ color: 'var(--ink)' }}>{transaction.note || transaction.category}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--ink-4)' }}>{transaction.category} · {formatLongDate(transaction.date)}</p>
                    </div>
                    <p className="text-sm font-mono shrink-0" style={{ color: transaction._type === 'income' ? 'var(--green)' : 'var(--ink)' }}>
                      {transaction._type === 'income' ? '+' : '−'}{formatCurrencyFull(transaction.amount)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
