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
  const width = 600
  const labels = buckets.map(b => b.label)
  const incomeMax = Math.max(1, ...buckets.map((bucket) => Number(bucket.income) || 0))
  const expenseMax = Math.max(1, ...buckets.map((bucket) => Number(bucket.expenses) || 0))

  const incomeData = buckets.map(b => Number(b.income) || 0)
  const expenseData = buckets.map(b => Number(b.expenses) || 0)

  const chartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: '#16a34a',
          fill: false,
        },
        {
          label: 'Expenses',
          data: expenseData,
          borderColor: '#111827',
          fill: false,
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { display: true },
        y: { display: true }
      }
    }
  }

  const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`

  const chart = `
    <img 
      src="${chartUrl}" 
      width="${width}" 
      style="display:block;margin-top:16px;border-radius:8px;"
      alt="Cash flow chart"
    />
  `

  return `
    <div style="margin-top:24px;">
      <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;width:100%;">
        <tr>
          <td style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(title)}</td>
          <td style="font-size:12px;color:#6b7280;text-align:right;white-space:nowrap;">Dual axis</td>
        </tr>
        <tr>
          <td colspan="2" style="font-size:12px;color:#6b7280;padding-top:2px;">${escapeHtml(subtitle)}</td>
        </tr>
      </table>

      <div style="margin-top:12px;border:1px solid #e5e7eb;border-radius:16px;padding:12px;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">
          Income max: ${escapeHtml(formatCurrencyFull(incomeMax))} · 
          Expenses max: ${escapeHtml(formatCurrencyFull(expenseMax))}
        </div>
        ${chart}
      </div>
    </div>
  `
}

export const buildTransactionReportHtml = ({ userName, startDate, endDate, transactions }) => {
  const summary = buildTransactionSummary(transactions)
  const categories = buildCategoryBreakdown(transactions).slice(0, 6)
  const buckets = buildDailyBuckets(transactions, startDate, endDate)
  const net = summary.totalIncome - summary.totalExpenses

  const categoryRows = categories.length > 0
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="padding-bottom:10px;">
            <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
              <tr>
                ${categories.map((category) => {
                  const percent = summary.totalExpenses > 0 ? (category.amount / summary.totalExpenses) * 100 : 0
                  return `<td style="height:10px;background:${category.color};width:${Math.max(percent, 1)}%;font-size:0;line-height:0;">&nbsp;</td>`
                }).join('')}
              </tr>
            </table>
          </td>
        </tr>
        ${categories.map((category) => {
          const percent = summary.totalExpenses > 0 ? Math.round((category.amount / summary.totalExpenses) * 100) : 0
          return `
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
                <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;">
                  <tr>
                    <td style="font-size:12px;color:#111827;">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${category.color};margin-right:6px;"></span>
                      ${escapeHtml(category.icon)} ${escapeHtml(category.name)}
                    </td>
                    <td style="font-size:11px;font-family:monospace;color:#4b5563;text-align:right;white-space:nowrap;">
                      ${escapeHtml(formatCurrencyFull(category.amount))} · ${percent}%
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `
        }).join('')}
      </table>
    `
    : '<div style="font-size:13px;color:#6b7280;">No expense categories in this range.</div>'

  return `
    <div style="margin:0;padding:0;background:#fafaf8;color:#111827;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:760px;margin:0 auto;padding:24px;">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:24px;box-shadow:0 12px 40px rgba(15,15,15,0.06);">
          <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;width:100%;">
            <tr>
              <td style="vertical-align:top;">
                <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Transaction report</div>
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#111827;">Your selected history</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#4b5563;">Prepared for ${escapeHtml(userName || 'you')} from ${escapeHtml(formatPrettyDate(startDate))} to ${escapeHtml(formatPrettyDate(endDate))}.</p>
              </td>
              <td style="vertical-align:top;text-align:right;white-space:nowrap;padding-left:12px;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-left:auto;">
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding:0 8px 4px 0;">Transactions</td>
                    <td style="font-size:12px;color:#111827;font-weight:700;text-align:right;padding:0 0 4px;">${escapeHtml(transactions.length)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding:0 8px 4px 0;">Expenses</td>
                    <td style="font-size:12px;color:#111827;font-weight:700;text-align:right;padding:0 0 4px;">${escapeHtml(summary.expenseCount)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding:0 8px 0 0;">Income entries</td>
                    <td style="font-size:12px;color:#111827;font-weight:700;text-align:right;padding:0;">${escapeHtml(summary.incomeCount)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-top:22px;border-collapse:separate;border-spacing:8px;">
            <tr>
              ${[
                { label: 'Income', value: formatCurrencyFull(summary.totalIncome), color: '#16a34a' },
                { label: 'Expenses', value: formatCurrencyFull(summary.totalExpenses), color: '#111827' },
              ].map((stat) => `
                <td style="border:1px solid #e5e7eb;border-radius:14px;padding:12px 14px;background:#fafaf8;">
                  <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">${escapeHtml(stat.label)}</div>
                  <div style="font-size:20px;line-height:1.1;font-weight:700;color:${stat.color};font-family:monospace;">${escapeHtml(stat.value)}</div>
                </td>
              `).join('')}
            </tr>
            <tr>
              ${[
                { label: 'Net', value: formatCurrencyFull(net), color: net >= 0 ? '#16a34a' : '#dc2626' },
                { label: 'Transactions', value: String(transactions.length), color: '#111827' },
              ].map((stat) => `
                <td style="border:1px solid #e5e7eb;border-radius:14px;padding:12px 14px;background:#fafaf8;">
                  <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">${escapeHtml(stat.label)}</div>
                  <div style="font-size:20px;line-height:1.1;font-weight:700;color:${stat.color};font-family:monospace;">${escapeHtml(stat.value)}</div>
                </td>
              `).join('')}
            </tr>
          </table>

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
