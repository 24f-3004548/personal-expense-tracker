import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getDashboardData, getCategoryMeta, formatCurrencyFull, formatDate, MONTH_NAMES
} from '../lib/supabase'

const now = new Date()

export default function Review() {
  const { user } = useAuth()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [compareMonth, setCompareMonth] = useState(now.getMonth() === 0 ? 11 : now.getMonth() - 1)
  const [compareYear, setCompareYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())
  const [data, setData] = useState(null)
  const [prevData, setPrevData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [curr, prev] = await Promise.all([
        getDashboardData(user.id, month, year),
        getDashboardData(user.id, compareMonth, compareYear),
      ])
      setData(curr)
      setPrevData(prev)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [user.id, month, year, compareMonth, compareYear])

  useEffect(() => { load() }, [month, year])
  useEffect(() => { load() }, [compareMonth, compareYear])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const decrementCompare = () => {
    if (compareMonth === 0) {
      setCompareMonth(11)
      setCompareYear(y => y - 1)
      return
    }
    setCompareMonth(m => m - 1)
  }

  const incrementCompare = () => {
    const isAtCurrent = compareYear === year && compareMonth === month
    if (isAtCurrent) return
    if (compareMonth === 11) {
      const nextYear = compareYear + 1
      if (nextYear > year) return
      setCompareMonth(0)
      setCompareYear(nextYear)
      return
    }
    if (compareYear === year && compareMonth + 1 > month) return
    setCompareMonth(m => m + 1)
  }

  const expenseDelta = prevData?.totalExpenses && data?.totalExpenses !== undefined
    ? ((data.totalExpenses - prevData.totalExpenses) / (prevData.totalExpenses || 1)) * 100
    : null

  const savingsDelta = prevData?.savings !== undefined && data?.savings !== undefined
    ? data.savings - prevData.savings
    : null

  const largestExpense = data?.expenses?.length
    ? data.expenses.reduce((max, e) => Number(e.amount) > Number(max.amount) ? e : max, data.expenses[0])
    : null

  const insights = []
  if (expenseDelta !== null) {
    if (Math.abs(expenseDelta) > 2) {
      insights.push({
        icon: expenseDelta > 0 ? '↑' : '↓',
        text: `You spent ${Math.abs(expenseDelta).toFixed(0)}% ${expenseDelta > 0 ? 'more' : 'less'} than last month`,
        positive: expenseDelta <= 0,
      })
    } else {
      insights.push({ icon: '→', text: 'Spending similar to last month', positive: true })
    }
  }
  if (data?.categoryBreakdown?.[0]) {
    insights.push({
      icon: getCategoryMeta(data.categoryBreakdown[0].name).icon,
      text: `${data.categoryBreakdown[0].name} is your highest category (${formatCurrencyFull(data.categoryBreakdown[0].amount)})`,
      positive: false,
    })
  }
  if (data?.savings !== undefined && data.savings > 0) {
    const rate = data.totalIncome ? Math.round((data.savings / data.totalIncome) * 100) : 0
    insights.push({ icon: '✓', text: `Saved ${rate}% of income this month`, positive: true })
  }
  if (data?.savings !== undefined && data.savings < 0) {
    insights.push({ icon: '!', text: `Spent ${formatCurrencyFull(Math.abs(data.savings))} more than earned`, positive: false })
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-up">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="text-sm" style={{ color: 'var(--ink-3)' }}>‹</button>
          <h1 className="text-base font-medium" style={{ color: 'var(--ink)' }}>
            {MONTH_NAMES[month]} {year}
          </h1>
          <button onClick={nextMonth}
            disabled={month === now.getMonth() && year === now.getFullYear()}
            className="text-sm" style={{ color: 'var(--ink-3)' }}>›</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--ink-4)' }}>Loading...</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 mb-4 animate-fade-up stagger-1">
            {[
              { label: 'Total income', value: formatCurrencyFull(data?.totalIncome), color: 'var(--green)' },
              { label: 'Total spent', value: formatCurrencyFull(data?.totalExpenses), color: 'var(--ink)' },
              { label: 'Saved', value: formatCurrencyFull(data?.savings), color: data?.savings >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Transactions', value: data?.expenses?.length || 0, color: 'var(--ink)', mono: false },
            ].map(s => (
              <div key={s.label} className="rounded-xl border p-4"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--ink-4)' }}>{s.label}</p>
                <p className={`text-xl font-medium ${s.mono !== false ? 'font-mono' : ''}`} style={{ color: s.color }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="rounded-xl border p-4 mb-4 space-y-2 animate-fade-up stagger-2"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <p className="text-xs mb-3" style={{ color: 'var(--ink-4)' }}>Insights</p>
              {insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1">
                  <span className="text-sm shrink-0" style={{ color: ins.positive ? 'var(--green)' : 'var(--ink-2)' }}>
                    {ins.icon}
                  </span>
                  <p className="text-sm" style={{ color: 'var(--ink-2)' }}>{ins.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* vs last month */}
          {prevData && (
            <div className="rounded-xl border p-4 mb-4 animate-fade-up stagger-3"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Compare to</p>
                <button onClick={decrementCompare} style={{ color: 'var(--ink-3)' }}>‹</button>
                <span className="text-xs" style={{ color: 'var(--ink-2)' }}>{MONTH_NAMES[compareMonth]} {compareYear}</span>
                <button onClick={incrementCompare} style={{ color: 'var(--ink-3)' }}>›</button>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--ink-4)' }}>
                vs {MONTH_NAMES[compareMonth]}
              </p>
              {prevData?.totalExpenses === 0 && prevData?.totalIncome === 0 ? (
                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  <p className="text-xs" style={{ color: 'var(--ink-4)' }}>No data for {MONTH_NAMES[compareMonth]} {compareYear}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {[
                      {
                        label: 'Spending',
                        curr: data?.totalExpenses,
                        prev: prevData?.totalExpenses,
                        lowerBetter: true,
                      },
                      {
                        label: 'Savings',
                        curr: data?.savings,
                        prev: prevData?.savings,
                        lowerBetter: false,
                      },
                    ].map(row => {
                      const delta = row.prev ? ((row.curr - row.prev) / Math.abs(row.prev)) * 100 : null
                      const isPositive = row.lowerBetter ? delta <= 0 : delta >= 0
                      return (
                        <div key={row.label} className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--ink-3)' }}>{row.label}</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-mono" style={{ color: 'var(--ink)' }}>
                              {formatCurrencyFull(row.curr)}
                            </span>
                            {delta !== null && (
                              <span className="text-xs font-mono" style={{ color: isPositive ? 'var(--green)' : 'var(--red)' }}>
                                {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Category comparison */}
                  {data?.categoryBreakdown?.length > 0 && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-xs mb-3" style={{ color: 'var(--ink-4)' }}>Category shifts</p>
                      {data.categoryBreakdown.slice(0, 4).map(cat => {
                        const prevCat = prevData?.categoryBreakdown?.find(c => c.name === cat.name)
                        const catDelta = prevCat ? cat.amount - prevCat.amount : null
                        const meta = getCategoryMeta(cat.name)
                        return (
                          <div key={cat.name} className="flex items-center justify-between py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{meta.icon}</span>
                              <span className="text-xs" style={{ color: 'var(--ink-2)' }}>{cat.name}</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-mono" style={{ color: 'var(--ink)' }}>
                                {formatCurrencyFull(cat.amount)}
                              </span>
                              {catDelta !== null && (
                                <span className="text-xs" style={{ color: catDelta > 0 ? 'var(--red)' : 'var(--green)' }}>
                                  {catDelta > 0 ? '+' : ''}{formatCurrencyFull(catDelta)}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Largest expense */}
          {largestExpense && (
            <div className="rounded-xl border p-4 animate-fade-up stagger-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <p className="text-xs mb-3" style={{ color: 'var(--ink-4)' }}>Largest single expense</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: getCategoryMeta(largestExpense.category).color + '15' }}>
                  {getCategoryMeta(largestExpense.category).icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>
                    {largestExpense.note || largestExpense.category}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
                    {largestExpense.category} · {formatDate(largestExpense.date)}
                  </p>
                </div>
                <p className="text-sm font-mono font-medium" style={{ color: 'var(--ink)' }}>
                  {formatCurrencyFull(largestExpense.amount)}
                </p>
              </div>
            </div>
          )}

          {!data?.expenses?.length && (
            <div className="text-center py-16">
              <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No data for this month</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
