import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getDashboardData, getMonthlyTrend, formatCurrency, formatCurrencyFull,
  formatDate, formatTime, getCategoryMeta, MONTH_NAMES
} from '../lib/supabase'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip
} from 'recharts'
import QuickAdd from '../components/expenses/QuickAdd'
import AddIncomeModal from '../components/income/AddIncomeModal'
import CategoryIcon from '../components/CategoryIcon'

const now = new Date()

export default function Dashboard() {
  const { user } = useAuth()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState(null)
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [showIncome, setShowIncome] = useState(false)
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, trendData] = await Promise.all([
        getDashboardData(user.id, month, year),
        getMonthlyTrend(user.id),
      ])
      setData(dash)
      setTrend(trendData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user.id, month, year])

  useEffect(() => { load() }, [load])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  const canGoNext = !(month === now.getMonth() && year === now.getFullYear())

  const currentTrend = trend.find(t => t.month === month && t.year === year)
  const prevTrend = (() => {
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    return trend.find(t => t.month === pm && t.year === py)
  })()

  const expenseDelta = prevTrend && currentTrend
    ? (currentTrend.expenses - prevTrend.expenses)
    : null

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const { name, amount } = payload[0].payload
    return (
      <div className="px-3 py-2 rounded-lg shadow-sm border text-xs"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <span className="inline-flex items-center gap-1">
          <CategoryIcon name={name} className="w-3.5 h-3.5" />
          {name}
        </span>
        <span className="ml-2 font-mono font-medium">{formatCurrencyFull(amount)}</span>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm font-mono" style={{ color: 'var(--ink-4)' }}>loading...</div>
      </div>
    )
  }

  const savings = data?.savings ?? 0
  const savingsRate = data?.totalIncome ? Math.round((savings / data.totalIncome) * 100) : 0
  const budgetAmount = data?.budget?.amount || 0
  const totalExpenses = data?.totalExpenses || 0
  const budgetPct = budgetAmount > 0 ? (totalExpenses / budgetAmount) * 100 : 0
  const isOver = budgetPct > 100
  const topCategory = data?.categoryBreakdown?.length
    ? data.categoryBreakdown.reduce((max, category) => (Number(category.amount) > Number(max.amount) ? category : max), data.categoryBreakdown[0])
    : null
  const recentTransactions = [
    ...(data?.expenses || []).map(e => ({ ...e, _type: 'expense' })),
    ...(data?.income || []).map(i => ({ ...i, _type: 'income', category: 'Income', note: i.note || 'Income' })),
  ]
    .sort((a, b) => {
      const at = new Date(a.created_at || `${a.date}T00:00:00`).getTime()
      const bt = new Date(b.created_at || `${b.date}T00:00:00`).getTime()
      return bt - at
    })
    .slice(0, 5)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      <div className="flex items-center justify-between mb-6 animate-fade-up">
        <div>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded transition-colors text-sm"
              style={{ color: 'var(--ink-3)' }}>‹</button>
            <h1 className="text-base font-medium" style={{ color: 'var(--ink)' }}>
              {MONTH_NAMES[month]} {year !== now.getFullYear() ? year : ''}
            </h1>
            <button onClick={nextMonth} disabled={!canGoNext}
              className="w-6 h-6 flex items-center justify-center rounded transition-colors text-sm"
              style={{ color: canGoNext ? 'var(--ink-3)' : 'var(--border)' }}>›</button>
          </div>
          {expenseDelta !== null && prevTrend?.expenses > 0 && (
            <p className="text-xs mt-0.5" style={{ color: expenseDelta > 0 ? 'var(--red)' : 'var(--green)' }}>
              {expenseDelta > 0 ? '↑' : '↓'} {formatCurrencyFull(Math.abs(expenseDelta))} vs last month
            </p>
          )}
          {prevTrend?.expenses === 0 && currentTrend?.expenses > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-4)' }}>No data for last month</p>
          )}
        </div>
        <button
          onClick={() => setShowIncome(true)}
          className="px-3 py-1.5 text-xs rounded-lg border transition-all"
          style={{ borderColor: 'var(--border)', color: 'var(--ink-2)', background: 'var(--surface)' }}
        >
          + Income
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up stagger-1">
        {[
          {
            label: 'Spent',
            value: formatCurrency(data?.totalExpenses),
            sub: (data?.budget?.amount || 0) > 0
              ? `of ${formatCurrency(data?.budget?.amount)} budget`
              : 'No budget set',
            color: 'var(--ink)',
          },
          { label: 'Earned', value: formatCurrency(data?.totalIncome), color: 'var(--green)' },
          { label: 'Saved', value: formatCurrency(Math.abs(savings)), sub: savings >= 0 ? `${savingsRate}% saved of income` : 'over budget,', color: savings >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border p-3 md:p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <p className="text-xs mb-1.5" style={{ color: 'var(--ink-4)' }}>{stat.label}</p>
            <p className="text-lg md:text-xl font-mono font-medium leading-none" style={{ color: stat.color }}>
              {stat.value}
            </p>
            {stat.sub && <p className="text-xs mt-1" style={{ color: 'var(--ink-4)' }}>{stat.sub}</p>}
          </div>
        ))}
      </div>

      {budgetAmount > 0 && (
        <div className="mb-6 animate-fade-up stagger-2">
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-xs shrink-0" style={{ color: 'var(--ink-4)' }}>Budget used:</span>
                <p className="text-xs truncate" style={{ color: 'var(--ink-4)' }}>
                  {Math.round(budgetPct)}% 
                  {isOver && <span style={{ color: 'var(--red)' }}> — budget exceeded</span>}
                  {!isOver && budgetPct >= 80 && <span style={{ color: 'var(--amber)' }}> — close to limit</span>}
                </p>
              </div>
              <span className="text-xs font-mono shrink-0" style={{ color: 'var(--ink-3)' }}>
                {formatCurrencyFull(totalExpenses)} / {formatCurrencyFull(budgetAmount)}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
              {(() => {
                const pct = Math.min(budgetPct, 100)
                return (
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--green)',
                    }}
                  />
                )
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-4 mb-6">
        <div className="md:col-span-2 animate-fade-up stagger-2">
          {isCurrentMonth && <QuickAdd onAdded={load} />}
          {!isCurrentMonth && (
            <div className="rounded-xl border p-4 h-full flex items-center justify-center"
              style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Viewing past month</p>
            </div>
          )}
        </div>

        <div className="md:col-span-3 rounded-xl border p-4 animate-fade-up stagger-3"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p className="text-xs mb-3" style={{ color: 'var(--ink-4)' }}>Spending by category</p>
          {data?.categoryBreakdown?.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="relative" style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={data.categoryBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={78}
                    >
                      {data.categoryBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={getCategoryMeta(entry.name).color} />
                      ))}
                    </Pie>
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                      <tspan
                        x="50%"
                        dy="-1.3em"
                        style={{ fontSize: '10px', fill: 'var(--ink-4)', fontFamily: 'DM Sans' }}
                      >
                        Top Category:
                      </tspan>
                      <tspan
                        x="50%"
                        dy="1.6em"
                        style={{ fontSize: '13px', fontWeight: '500', fill: 'var(--ink)', fontFamily: 'DM Sans' }}
                      >
                        {topCategory?.name || 'No expenses'}
                      </tspan>
                      <tspan
                        x="50%"
                        dy="1.6em"
                        style={{ fontSize: '12px', fill: 'var(--ink-3)', fontFamily: 'DM Mono' }}
                      >
                        {topCategory ? formatCurrency(topCategory.amount) : ' '}
                      </tspan>
                    </text>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {data.categoryBreakdown.slice(0, 5).map((cat) => {
                  const meta = getCategoryMeta(cat.name)
                  const pct = data.totalExpenses ? Math.round((cat.amount / data.totalExpenses) * 100) : 0
                  return (
                    <div key={cat.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                      <span className="text-xs flex-1 truncate" style={{ color: 'var(--ink-2)' }}>{cat.name}</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--ink-3)' }}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs" style={{ color: 'var(--ink-4)' }}>No expenses yet</p>
            </div>
          )}
        </div>
      </div>

      {recentTransactions.length > 0 && (
        <div className="rounded-xl border animate-fade-up stagger-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Recent</p>
            <Link to="/expenses" className="text-xs" style={{ color: 'var(--ink-4)' }}>View all →</Link>
          </div>
          <div>
            {recentTransactions.map((item) => {
              const meta = item._type === 'income'
                ? { color: 'var(--green)' }
                : getCategoryMeta(item.category)
              return (
                <div key={`${item._type}-${item.id}`}
                  className="flex items-center gap-3 px-4 py-3 border-b last:border-0"
                  style={{ borderColor: 'var(--border)' }}>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: item._type === 'income' ? 'var(--green-light)' : meta.color + '15' }}
                  >
                    {item._type === 'income' ? '💰' : <CategoryIcon name={item.category} className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--ink)' }}>
                      {item.note || item.category}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
                      {item.category} · {formatDate(item.date)} · {formatTime(item.created_at)}
                    </p>
                  </div>
                  <p className="text-sm font-mono font-medium shrink-0" style={{ color: item._type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                    {item._type === 'income' ? '+' : '−'}{formatCurrencyFull(item.amount)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {data?.expenses?.length === 0 && (
        <div className="text-center py-16 animate-fade-in">
          <p className="text-2xl mb-2">₹</p>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-2)' }}>No expenses this month</p>
          <p className="text-xs" style={{ color: 'var(--ink-4)' }}>Add your first expense above to get started</p>
        </div>
      )}

      {showIncome && (
        <AddIncomeModal
          onClose={() => setShowIncome(false)}
          onAdded={load}
          month={month}
          year={year}
        />
      )}
    </div>
  )
}
