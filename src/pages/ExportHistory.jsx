import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { formatCurrencyFull, getTransactionsInRange, supabase } from '../lib/supabase'
import { buildTransactionReportHtml, buildTransactionWorkbookBase64 } from '../lib/transactionExport'
import DateInput from '../components/DateInput'

const today = new Date()
const defaultStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const defaultEndDate = today.toISOString().split('T')[0]

const toInputDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeDate = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const getRollingMonthRange = (months, now) => {
  const end = normalizeDate(now)
  const start = new Date(end)
  start.setMonth(start.getMonth() - months)
  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  }
}

const getCurrentFinancialYearRange = (now) => {
  const end = normalizeDate(now)
  const currentYear = end.getFullYear()
  const financialYearStartYear = end.getMonth() >= 3 ? currentYear : currentYear - 1
  const start = new Date(financialYearStartYear, 3, 1)

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  }
}

const buildQuickRanges = (now) => {
  const end = normalizeDate(now)
  const currentMonthStart = new Date(end.getFullYear(), end.getMonth(), 1)

  return [
    {
      id: 'current-month',
      label: 'Current month',
      startDate: toInputDate(currentMonthStart),
      endDate: toInputDate(end),
    },
    {
      id: 'last-1-month',
      label: 'Last one month',
      ...getRollingMonthRange(1, end),
    },
    {
      id: 'last-3-months',
      label: 'Last 3 months',
      ...getRollingMonthRange(3, end),
    },
    {
      id: 'last-6-months',
      label: 'Last 6 months',
      ...getRollingMonthRange(6, end),
    },
    {
      id: 'last-12-months',
      label: 'Last 12 months',
      ...getRollingMonthRange(12, end),
    },
    {
      id: 'current-financial-year',
      label: 'Current financial year',
      ...getCurrentFinancialYearRange(end),
    },
  ]
}

const formatDisplayDate = (dateStr) => {
  const [year, month, day] = String(dateStr || '').split('-')
  if (!year || !month || !day) return dateStr
  return `${day}/${month}/${year}`
}

export default function ExportHistory() {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [isQuickRangeOpen, setIsQuickRangeOpen] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [exportError, setExportError] = useState('')
  const quickRangeRef = useRef(null)

  const quickRanges = useMemo(() => buildQuickRanges(new Date()), [])

  const activeQuickRangeId = useMemo(
    () => quickRanges.find((range) => range.startDate === startDate && range.endDate === endDate)?.id ?? null,
    [quickRanges, startDate, endDate],
  )

  useEffect(() => {
    if (!isQuickRangeOpen) return

    const handlePointerDown = (event) => {
      if (!quickRangeRef.current?.contains(event.target)) {
        setIsQuickRangeOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsQuickRangeOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isQuickRangeOpen])

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

  const handleQuickRangeSelect = (range) => {
    setStartDate(range.startDate)
    setEndDate(range.endDate)
    setIsQuickRangeOpen(false)
  }

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
          subject: 'Transaction Report - ' + formatDisplayDate(startDate) + ' to ' + formatDisplayDate(endDate),
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

      <div
        className="rounded-2xl border p-4 mb-4 animate-fade-up stagger-1 relative"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
          zIndex: isQuickRangeOpen ? 20 : 'auto',
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--ink-4)' }}>Date range</p>
          <div className="relative" ref={quickRangeRef}>
            <button
              type="button"
              onClick={() => setIsQuickRangeOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--ink-2)',
                background: isQuickRangeOpen ? 'var(--surface-2)' : 'var(--surface)',
              }}
              aria-haspopup="menu"
              aria-expanded={isQuickRangeOpen}
            >
              Quick ranges
              <span className="font-mono" style={{ color: 'var(--ink-4)' }}>{isQuickRangeOpen ? '▴' : '▾'}</span>
            </button>

            {isQuickRangeOpen && (
              <div
                className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border p-2 shadow-lg"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                role="menu"
              >
                {quickRanges.map((range) => {
                  const isActive = activeQuickRangeId === range.id

                  return (
                    <button
                      key={range.id}
                      type="button"
                      onClick={() => handleQuickRangeSelect(range)}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm"
                      style={{
                        color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                        background: isActive ? 'var(--surface-2)' : 'transparent',
                      }}
                      role="menuitem"
                    >
                      <div>{range.label}</div>
                      <div className="text-xs font-mono" style={{ color: 'var(--ink-4)' }}>
                        <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--ink-4)' }}>Quick Summary</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-4)' }}>Start date</label>
            <DateInput
              value={startDate}
              max={today.toISOString().split('T')[0]}
              onChange={setStartDate}
              className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-4)' }}>End date</label>
            <DateInput
              value={endDate}
              max={today.toISOString().split('T')[0]}
              onChange={setEndDate}
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
            {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}
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
          {exporting ? 'Sending report...' : 'Get transaction report'}
        </button>
      </div>
    </div>
  )
}
