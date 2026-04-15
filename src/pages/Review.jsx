import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getDashboardData, getMonthlyTrend, getCategoryMeta, formatCurrency, formatCurrencyFull, formatDate, MONTH_NAMES, SHORT_MONTHS
} from '../lib/supabase'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

const now = new Date()

export default function Review() {
  const { user } = useAuth()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [compareMonth, setCompareMonth] = useState(now.getMonth() === 0 ? 11 : now.getMonth() - 1)
  const [compareYear, setCompareYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())
  const [data, setData] = useState(null)
  const [prevData, setPrevData] = useState(null)
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [curr, prev, trendData] = await Promise.all([
        getDashboardData(user.id, month, year),
        getDashboardData(user.id, compareMonth, compareYear),
        getMonthlyTrend(user.id),
      ])
      setData(curr)
      setPrevData(prev)
      setTrend(trendData)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [user.id, month, year, compareMonth, compareYear])

  useEffect(() => { load() }, [load])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const latestCompareMonth = month === 0 ? 11 : month - 1
  const latestCompareYear = month === 0 ? year - 1 : year

  useEffect(() => {
    const isBeyondLatest =
      compareYear > latestCompareYear ||
      (compareYear === latestCompareYear && compareMonth > latestCompareMonth)

    if (isBeyondLatest) {
      setCompareMonth(latestCompareMonth)
      setCompareYear(latestCompareYear)
    }
  }, [month, year, compareMonth, compareYear, latestCompareMonth, latestCompareYear])

  const decrementCompare = () => {
    if (compareMonth === 0) {
      setCompareMonth(11)
      setCompareYear(y => y - 1)
      return
    }
    setCompareMonth(m => m - 1)
  }

  const incrementCompare = () => {
    const isAtLatest = compareYear === latestCompareYear && compareMonth === latestCompareMonth
    if (isAtLatest) return
    if (compareMonth === 11) {
      const nextYear = compareYear + 1
      if (nextYear > latestCompareYear) return
      setCompareMonth(0)
      setCompareYear(nextYear)
      return
    }
    if (compareYear === latestCompareYear && compareMonth + 1 > latestCompareMonth) return
    setCompareMonth(m => m + 1)
  }

  const expenseDelta = prevData?.totalExpenses !== undefined && data?.totalExpenses !== undefined
    ? (data.totalExpenses - prevData.totalExpenses)
    : null

  const largestExpense = data?.expenses?.length
    ? data.expenses.reduce((max, e) => Number(e.amount) > Number(max.amount) ? e : max, data.expenses[0])
    : null

  const insights = []
  if (expenseDelta !== null) {
    if (Math.abs(expenseDelta) > 0) {
      insights.push({
        icon: expenseDelta > 0 ? '↑' : '↓',
        text: `You spent ${formatCurrencyFull(Math.abs(expenseDelta))} ${expenseDelta > 0 ? 'more' : 'less'} than last month`,
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

  const categoryShiftRows = (() => {
    if (!data?.categoryBreakdown || !prevData?.categoryBreakdown) return []

    const currentMap = new Map(data.categoryBreakdown.map((cat) => [cat.name, Number(cat.amount) || 0]))
    const previousMap = new Map(prevData.categoryBreakdown.map((cat) => [cat.name, Number(cat.amount) || 0]))
    const names = Array.from(new Set([...currentMap.keys(), ...previousMap.keys()]))

    return names
      .map((name) => {
        const currentAmount = currentMap.get(name) || 0
        const previousAmount = previousMap.get(name) || 0
        return {
          name,
          currentAmount,
          previousAmount,
          delta: currentAmount - previousAmount,
        }
      })
      .filter((row) => row.currentAmount > 0 || row.previousAmount > 0)
      .sort((a, b) => Math.max(b.currentAmount, b.previousAmount) - Math.max(a.currentAmount, a.previousAmount))
      .slice(0, 6)
  })()

  const spendByCategoryRows = (data?.categoryBreakdown || [])
    .map((row) => ({
      ...row,
      amount: Number(row.amount) || 0,
      ...getCategoryMeta(row.name),
    }))
    .filter((row) => row.amount > 0)

  const TrendTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="px-3 py-2 rounded-lg shadow-sm border text-xs"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <p className="mb-1" style={{ color: 'var(--ink-3)' }}>{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.name === 'expenses' ? 'var(--ink)' : 'var(--green)' }}>
            {entry.name === 'expenses' ? 'Spent' : 'Earned'}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    )
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

          {/* Spending by category */}
          {spendByCategoryRows.length > 0 && (
            <div className="rounded-xl border p-4 mb-4 animate-fade-up stagger-3"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Spending by category</p>
                <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Expense categories only</p>
              </div>

              <div className="h-2.5 rounded-full overflow-hidden flex mb-3" style={{ background: 'var(--surface-3)' }}>
                {spendByCategoryRows.map((category) => {
                  const percent = data.totalExpenses > 0 ? (category.amount / data.totalExpenses) * 100 : 0
                  return (
                    <div
                      key={`review-stack-${category.name}`}
                      title={`${category.name} ${percent.toFixed(1)}%`}
                      style={{
                        width: `${Math.max(percent, 1)}%`,
                        background: category.color,
                      }}
                    />
                  )
                })}
              </div>

              <div className="space-y-2">
                {spendByCategoryRows.map((category) => {
                  const percent = data.totalExpenses > 0 ? Math.round((category.amount / data.totalExpenses) * 100) : 0
                  return (
                    <div key={`review-row-${category.name}`} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: category.color }} />
                        <span className="text-xs truncate" style={{ color: 'var(--ink-2)' }}>{category.icon} {category.name}</span>
                      </div>
                      <span className="text-xs font-mono shrink-0" style={{ color: 'var(--ink-3)' }}>
                        {formatCurrencyFull(category.amount)} · {percent}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* vs last month */}
          {prevData && (
            <div className="rounded-xl border p-4 mb-4 animate-fade-up stagger-4"
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
                        mode: 'spending',
                      },
                      {
                        label: 'Savings',
                        curr: data?.savings,
                        prev: prevData?.savings,
                        mode: 'savings',
                      },
                    ].map(row => {
                      const hasPrev = row.prev !== undefined && row.prev !== null
                      const deltaAmount = hasPrev ? (row.curr - row.prev) : null
                      const increaseIsBad = row.mode === 'spending'
                      const deltaColor = deltaAmount === null || deltaAmount === 0
                        ? 'var(--ink-4)'
                        : ((deltaAmount > 0) === increaseIsBad ? 'var(--red)' : 'var(--green)')

                      return (
                        <div key={row.label} className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--ink-3)' }}>{row.label}</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-mono" style={{ color: 'var(--ink)' }}>
                              {formatCurrencyFull(row.curr)}
                            </span>
                            {deltaAmount !== null && (
                              <span className="text-xs font-mono" style={{ color: deltaColor }}>
                                {deltaAmount > 0 ? '+' : deltaAmount < 0 ? '−' : ''}
                                {formatCurrencyFull(Math.abs(deltaAmount))}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Category comparison */}
                  {categoryShiftRows.length > 0 && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-xs mb-3" style={{ color: 'var(--ink-4)' }}>Category shifts</p>

                      <div className="h-2.5 rounded-full overflow-hidden flex mb-3" style={{ background: 'var(--surface-3)' }}>
                        {categoryShiftRows.map((row) => {
                          const meta = getCategoryMeta(row.name)
                          const currentPct = data.totalExpenses > 0 ? (row.currentAmount / data.totalExpenses) * 100 : 0
                          return (
                            <div
                              key={`stack-${row.name}`}
                              title={`${row.name} ${currentPct.toFixed(1)}%`}
                              style={{
                                width: `${Math.max(1, currentPct)}%`,
                                background: meta.color,
                              }}
                            />
                          )
                        })}
                      </div>

                      <div className="flex items-center gap-3 text-[10px] mb-3" style={{ color: 'var(--ink-4)' }}>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--ink)' }} />{MONTH_NAMES[month]} spend</span>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--ink-4)' }} />vs {MONTH_NAMES[compareMonth]}</span>
                      </div>

                      {categoryShiftRows.map((row) => {
                        const meta = getCategoryMeta(row.name)
                        const deltaColor = row.delta > 0 ? 'var(--red)' : row.delta < 0 ? 'var(--green)' : 'var(--ink-4)'
                        const currentPct = data.totalExpenses > 0 ? Math.round((row.currentAmount / data.totalExpenses) * 100) : 0

                        return (
                          <div key={row.name} className="py-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{meta.icon}</span>
                                <span className="text-xs" style={{ color: 'var(--ink-2)' }}>{row.name}</span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>
                                  {currentPct}%
                                </span>
                                <span className="text-xs font-mono" style={{ color: 'var(--ink)' }}>
                                  {formatCurrencyFull(row.currentAmount)}
                                </span>
                                <span className="text-xs font-mono" style={{ color: deltaColor }}>
                                  {row.delta > 0 ? '+' : row.delta < 0 ? '−' : ''}{formatCurrencyFull(Math.abs(row.delta))}
                                </span>
                              </div>
                            </div>
                            <div className="text-[10px] font-mono" style={{ color: 'var(--ink-4)' }}>
                              {MONTH_NAMES[compareMonth]}: {formatCurrencyFull(row.previousAmount)}
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

          {/* 6-month overview */}
          {trend.length > 0 && (
            <div className="rounded-xl border p-4 mb-4 animate-fade-up stagger-5"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-xs" style={{ color: 'var(--ink-4)' }}>6-month overview</p>
                <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
                  <span style={{ color: 'var(--ink)' }}>▪</span> Spent &nbsp;
                  <span style={{ color: 'var(--green)' }}>▪</span> Earned
                </p>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={trend.map((t) => ({
                  name: SHORT_MONTHS[t.month],
                  expenses: t.expenses,
                  income: t.income,
                }))} barGap={2} barSize={12}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--ink-4)', fontFamily: 'DM Mono' }} />
                  <YAxis hide />
                  <Tooltip content={<TrendTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
                  <Bar dataKey="expenses" fill="var(--ink)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="income" fill="var(--green)" radius={[3, 3, 0, 0]} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Largest expense */}
          {largestExpense && (
            <div className="rounded-xl border p-4 animate-fade-up stagger-6"
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
