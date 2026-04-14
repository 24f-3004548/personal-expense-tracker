import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { formatCurrencyFull, getCategoryMeta, getTransactionsInRange, supabase } from '../lib/supabase'
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
    return {
      income: Math.max(1, ...summary.timelineBuckets.map((bucket) => bucket.income)),
      expenses: Math.max(1, ...summary.timelineBuckets.map((bucket) => bucket.expenses)),
    }
  }, [summary.timelineBuckets])

  const timelineGeometry = useMemo(() => {
    const chartWidth = 920
    const chartHeight = 220
    const topPad = 18
    const bottomPad = 26
    const sidePad = 24
    const steps = Math.max(1, summary.timelineBuckets.length - 1)

    const toX = (index) => sidePad + ((chartWidth - sidePad * 2) * index) / steps
    const toYIncome = (value) => topPad + ((chartHeight - topPad - bottomPad) * (1 - value / maxTimelineValue.income))
    const toYExpenses = (value) => topPad + ((chartHeight - topPad - bottomPad) * (1 - value / maxTimelineValue.expenses))

    const incomePoints = summary.timelineBuckets.map((bucket, index) => ({
      x: toX(index),
      y: toYIncome(bucket.income),
      value: bucket.income,
      label: bucket.label,
    }))

    const expensePoints = summary.timelineBuckets.map((bucket, index) => ({
      x: toX(index),
      y: toYExpenses(bucket.expenses),
      value: bucket.expenses,
      label: bucket.label,
    }))

    return {
      chartWidth,
      chartHeight,
      topPad,
      bottomPad,
      sidePad,
      incomePoints,
      expensePoints,
      incomePath: incomePoints.map((point) => `${point.x},${point.y}`).join(' '),
      expensePath: expensePoints.map((point) => `${point.x},${point.y}`).join(' '),
    }
  }, [summary.timelineBuckets, maxTimelineValue.income, maxTimelineValue.expenses])

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

      const { data, error: fnError } = await supabase.functions.invoke('resend-email', {
        body: {
          to: user.email,
          subject: 'Your Transaction Report',
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
                Pick a date range and preview the totals.
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
                    <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Dual-axis line chart</p>
                  </div>
                  <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <div className="flex items-center justify-between text-[10px] mb-2" style={{ color: 'var(--ink-4)' }}>
                      <span>Income axis max: {formatCurrencyFull(maxTimelineValue.income)}</span>
                      <span>Expenses axis max: {formatCurrencyFull(maxTimelineValue.expenses)}</span>
                    </div>
                    <svg viewBox={`0 0 ${timelineGeometry.chartWidth} ${timelineGeometry.chartHeight}`} className="w-full h-[220px]">
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                        const y = timelineGeometry.topPad + (timelineGeometry.chartHeight - timelineGeometry.topPad - timelineGeometry.bottomPad) * ratio
                        return (
                          <line
                            key={`grid-${ratio}`}
                            x1={timelineGeometry.sidePad}
                            x2={timelineGeometry.chartWidth - timelineGeometry.sidePad}
                            y1={y}
                            y2={y}
                            stroke="var(--border)"
                            strokeDasharray="4 4"
                          />
                        )
                      })}

                      <polyline
                        fill="none"
                        stroke="var(--green)"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={timelineGeometry.incomePath}
                      />
                      <polyline
                        fill="none"
                        stroke="var(--ink)"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={timelineGeometry.expensePath}
                      />

                      {timelineGeometry.incomePoints.map((point) => (
                        <circle key={`income-${point.label}`} cx={point.x} cy={point.y} r="4" fill="var(--green)" />
                      ))}
                      {timelineGeometry.expensePoints.map((point) => (
                        <circle key={`expense-${point.label}`} cx={point.x} cy={point.y} r="4" fill="var(--ink)" />
                      ))}
                    </svg>

                    <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: `repeat(${summary.timelineBuckets.length}, minmax(0, 1fr))` }}>
                      {summary.timelineBuckets.map((bucket) => (
                        <p key={`tick-${bucket.label}`} className="text-[10px] leading-tight text-center" style={{ color: 'var(--ink-4)' }}>
                          {bucket.label}
                        </p>
                      ))}
                    </div>

                    <div className="flex items-center justify-center gap-4 mt-3 text-xs" style={{ color: 'var(--ink-3)' }}>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)' }} />Income</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--ink)' }} />Expenses</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="flex items-baseline justify-between gap-3 mb-4">
                    <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--ink-4)' }}>Category breakdown</p>
                    <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Expense categories only</p>
                  </div>
                  {summary.categoryBreakdown.length > 0 ? (
                    <div>
                      <div className="h-3 rounded-full overflow-hidden flex mb-4" style={{ background: 'var(--surface-3)' }}>
                        {summary.categoryBreakdown.map((category) => {
                          const percent = summary.totalExpenses > 0 ? (category.amount / summary.totalExpenses) * 100 : 0
                          return (
                            <div
                              key={`bar-${category.name}`}
                              title={`${category.name} ${percent.toFixed(1)}%`}
                              style={{
                                width: `${Math.max(percent, 1)}%`,
                                background: category.color,
                              }}
                            />
                          )
                        })}
                      </div>

                      <div className="grid sm:grid-cols-2 gap-2.5">
                        {summary.categoryBreakdown.map((category) => {
                          const percent = summary.totalExpenses > 0 ? Math.round((category.amount / summary.totalExpenses) * 100) : 0
                          return (
                            <div key={`legend-${category.name}`} className="flex items-center justify-between gap-3 rounded-xl border px-2.5 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: category.color }} />
                                <span className="text-sm truncate" style={{ color: 'var(--ink)' }}>{category.icon} {category.name}</span>
                              </div>
                              <p className="text-xs font-mono shrink-0" style={{ color: 'var(--ink-3)' }}>{formatCurrencyFull(category.amount)} · {percent}%</p>
                            </div>
                          )
                        })}
                      </div>
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
          </div>

          <div className="rounded-3xl border p-4 md:p-5 animate-fade-up stagger-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <p className="text-xs uppercase tracking-[0.16em] mb-3" style={{ color: 'var(--ink-4)' }}>Recent Transactions</p>
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
