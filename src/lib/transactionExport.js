import { formatCurrencyFull, getCategoryMeta } from './supabase'

const DAY_MS = 24 * 60 * 60 * 1000

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const toDateKey = (dateStr) => dateStr

const formatPrettyDate = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const buildTransactionSummary = (transactions) => {
  const summary = {
    totalIncome: 0,
    totalExpenses: 0,
    incomeCount: 0,
    expenseCount: 0,
    categoryTotals: {},
    bucketTotals: new Map(),
  }

  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount) || 0
    const dateKey = toDateKey(transaction.date)

    if (!summary.bucketTotals.has(dateKey)) {
      summary.bucketTotals.set(dateKey, { date: dateKey, income: 0, expenses: 0 })
    }

    const bucket = summary.bucketTotals.get(dateKey)
    if (transaction._type === 'income') {
      summary.totalIncome += amount
      summary.incomeCount += 1
      bucket.income += amount
      return
    }

    summary.totalExpenses += amount
    summary.expenseCount += 1
    bucket.expenses += amount

    if (!summary.categoryTotals[transaction.category]) {
      summary.categoryTotals[transaction.category] = 0
    }
    summary.categoryTotals[transaction.category] += amount
  })

  return summary
}

const buildDailyBuckets = (transactions, startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const totalDays = Math.max(1, Math.round((end - start) / DAY_MS) + 1)
  const bucketSize = Math.max(1, Math.ceil(totalDays / 12))
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

const buildDualAxisLineChartBlock = (title, subtitle, buckets) => {
  const chartWidth = 680
  const chartHeight = 220
  const topPad = 18
  const bottomPad = 24
  const sidePad = 26
  const incomeMax = Math.max(1, ...buckets.map((bucket) => Number(bucket.income) || 0))
  const expenseMax = Math.max(1, ...buckets.map((bucket) => Number(bucket.expenses) || 0))
  const steps = Math.max(1, buckets.length - 1)

  const incomePoints = buckets.map((bucket, index) => {
    const x = sidePad + ((chartWidth - sidePad * 2) * index) / steps
    const y = topPad + ((chartHeight - topPad - bottomPad) * (1 - (Number(bucket.income) || 0) / incomeMax))
    return { x, y, label: bucket.label }
  })

  const expensePoints = buckets.map((bucket, index) => {
    const x = sidePad + ((chartWidth - sidePad * 2) * index) / steps
    const y = topPad + ((chartHeight - topPad - bottomPad) * (1 - (Number(bucket.expenses) || 0) / expenseMax))
    return { x, y, label: bucket.label }
  })

  const incomePath = incomePoints.map((point) => `${point.x},${point.y}`).join(' ')
  const expensePath = expensePoints.map((point) => `${point.x},${point.y}`).join(' ')

  return `
    <div style="margin-top:24px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:12px;">
        <div>
          <div style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(title)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">${escapeHtml(subtitle)}</div>
        </div>
        <div style="font-size:12px;color:#6b7280;white-space:nowrap;">Dual axis</div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:16px;padding:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;color:#6b7280;margin-bottom:6px;">
          <span>Income max: ${escapeHtml(formatCurrencyFull(incomeMax))}</span>
          <span>Expenses max: ${escapeHtml(formatCurrencyFull(expenseMax))}</span>
        </div>

        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" width="100%" height="220" role="img" aria-label="Income and expenses line chart">
          ${[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = topPad + (chartHeight - topPad - bottomPad) * ratio
            return `<line x1="${sidePad}" x2="${chartWidth - sidePad}" y1="${y}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="4 4" />`
          }).join('')}

          <polyline fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${incomePath}" />
          <polyline fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${expensePath}" />

          ${incomePoints.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#16a34a" />`).join('')}
          ${expensePoints.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#111827" />`).join('')}
        </svg>

        <div style="display:grid;grid-template-columns:repeat(${buckets.length},minmax(0,1fr));gap:8px;margin-top:4px;">
          ${buckets.map((bucket) => `<div style="font-size:10px;line-height:1.2;color:#6b7280;text-align:center;">${escapeHtml(bucket.label)}</div>`).join('')}
        </div>

        <div style="display:flex;justify-content:center;gap:16px;margin-top:8px;font-size:12px;color:#6b7280;">
          <span style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:999px;background:#16a34a;display:inline-block;"></span>Income</span>
          <span style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:999px;background:#111827;display:inline-block;"></span>Expenses</span>
        </div>
      </div>
    </div>
  `
}

export const buildTransactionReportHtml = ({ userName, startDate, endDate, transactions }) => {
  const summary = buildTransactionSummary(transactions)
  const categories = buildCategoryBreakdown(transactions).slice(0, 6)
  const buckets = buildDailyBuckets(transactions, startDate, endDate)
  const net = summary.totalIncome - summary.totalExpenses
  const topTransactions = transactions.slice(0, 8)
  const transactionRows = topTransactions.length > 0
    ? topTransactions.map((transaction) => `
        <tr>
          <td style="padding:10px 12px;border-top:1px solid #e5e7eb;">${escapeHtml(formatPrettyDate(transaction.date))}</td>
          <td style="padding:10px 12px;border-top:1px solid #e5e7eb;">${escapeHtml(transaction.category)}</td>
          <td style="padding:10px 12px;border-top:1px solid #e5e7eb;text-align:right;font-family:monospace;">${transaction._type === 'income' ? '+' : '−'}${escapeHtml(formatCurrencyFull(transaction.amount))}</td>
          <td style="padding:10px 12px;border-top:1px solid #e5e7eb;">${escapeHtml(transaction.note || '')}</td>
        </tr>
      `).join('')
    : `
        <tr>
          <td colspan="4" style="padding:18px 12px;border-top:1px solid #e5e7eb;color:#6b7280;">No transactions were found in this range.</td>
        </tr>
      `

  const categoryRows = categories.length > 0
    ? `
      <div style="height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;display:flex;">
        ${categories.map((category) => {
          const percent = summary.totalExpenses > 0 ? (category.amount / summary.totalExpenses) * 100 : 0
          return `<span title="${escapeHtml(category.name)}" style="height:100%;width:${Math.max(percent, 1)}%;background:${category.color};display:block;"></span>`
        }).join('')}
      </div>

      <div style="margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
        ${categories.map((category) => {
          const percent = summary.totalExpenses > 0 ? Math.round((category.amount / summary.totalExpenses) * 100) : 0
          return `
            <div style="border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px;display:flex;justify-content:space-between;gap:10px;align-items:center;">
              <span style="font-size:12px;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                <span style="width:8px;height:8px;border-radius:999px;background:${category.color};display:inline-block;margin-right:6px;"></span>
                ${escapeHtml(category.icon)} ${escapeHtml(category.name)}
              </span>
              <span style="font-size:11px;font-family:monospace;color:#4b5563;white-space:nowrap;">${escapeHtml(formatCurrencyFull(category.amount))} · ${percent}%</span>
            </div>
          `
        }).join('')}
      </div>
    `
    : '<div style="font-size:13px;color:#6b7280;">No expense categories in this range.</div>'

  return `
    <div style="margin:0;padding:0;background:#fafaf8;color:#111827;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:760px;margin:0 auto;padding:24px;">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:24px;box-shadow:0 12px 40px rgba(15,15,15,0.06);">
          <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
            <div>
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Transaction report</div>
              <h1 style="margin:0;font-size:26px;line-height:1.2;color:#111827;">Your selected history</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#4b5563;">Prepared for ${escapeHtml(userName || 'you')} from ${escapeHtml(formatPrettyDate(startDate))} to ${escapeHtml(formatPrettyDate(endDate))}.</p>
            </div>
            <div style="font-size:12px;color:#6b7280;text-align:right;">
              <div>${escapeHtml(transactions.length)} transactions</div>
              <div>${escapeHtml(summary.expenseCount)} expenses</div>
              <div>${escapeHtml(summary.incomeCount)} income entries</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:22px;">
            ${[
              { label: 'Income', value: formatCurrencyFull(summary.totalIncome), color: '#16a34a' },
              { label: 'Expenses', value: formatCurrencyFull(summary.totalExpenses), color: '#111827' },
              { label: 'Net', value: formatCurrencyFull(net), color: net >= 0 ? '#16a34a' : '#dc2626' },
              { label: 'Transactions', value: String(transactions.length), color: '#111827' },
            ].map((stat) => `
              <div style="border:1px solid #e5e7eb;border-radius:18px;padding:14px 16px;background:#fafaf8;">
                <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">${escapeHtml(stat.label)}</div>
                <div style="font-size:20px;line-height:1.1;font-weight:700;color:${stat.color};font-family:monospace;">${escapeHtml(stat.value)}</div>
              </div>
            `).join('')}
          </div>

          ${buildDualAxisLineChartBlock(
            'Cash flow by range',
            'Income and expenses grouped across the selected period.',
            buckets,
          )}

          <div style="margin-top:24px;">
            <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:4px;">Expense breakdown</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:14px;">The categories below are based on expense transactions only.</div>
            ${categoryRows}
          </div>

          <div style="margin-top:24px;">
            <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:8px;">Latest transactions</div>
            <div style="border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;width:100%;font-size:13px;">
                <thead>
                  <tr style="background:#f9fafb;color:#6b7280;text-align:left;">
                    <th style="padding:10px 12px;font-weight:600;">Date</th>
                    <th style="padding:10px 12px;font-weight:600;">Category</th>
                    <th style="padding:10px 12px;font-weight:600;text-align:right;">Amount</th>
                    <th style="padding:10px 12px;font-weight:600;">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${transactionRows}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

export const buildTransactionWorkbookBase64 = async (transactions, startDate, endDate) => {
  const xlsxModule = await import('xlsx')
  const XLSX = xlsxModule.default ?? xlsxModule

  const transactionRows = [
    ['Date', 'Category', 'Amount', 'Notes'],
    ...transactions.map((transaction) => ([
      transaction.date,
      transaction.category,
      Number(transaction.amount) || 0,
      transaction.note || '',
    ])),
  ]

  const summaryRows = [
    ['Field', 'Value'],
    ['Start date', startDate],
    ['End date', endDate],
    ['Transactions', transactions.length],
    ['Income entries', transactions.filter((transaction) => transaction._type === 'income').length],
    ['Expense entries', transactions.filter((transaction) => transaction._type === 'expense').length],
  ]

  const workbook = XLSX.utils.book_new()
  const transactionsSheet = XLSX.utils.aoa_to_sheet(transactionRows)
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)

  XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transactions')
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' })
}
