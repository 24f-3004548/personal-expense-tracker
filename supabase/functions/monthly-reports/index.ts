import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "npm:nodemailer"
import xlsx from "npm:xlsx"

type AuthUser = {
  id: string
  email?: string | null
  user_metadata?: {
    name?: string
  }
}

type Transaction = {
  date: string
  category: string
  amount: number | string
  note?: string | null
  created_at?: string | null
  _type: "expense" | "income"
}

type Summary = {
  totalIncome: number
  totalExpenses: number
  incomeCount: number
  expenseCount: number
  categoryTotals: Record<string, number>
}

const DAY_MS = 24 * 60 * 60 * 1000

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const GMAIL_USER = Deno.env.get("GMAIL_USER")
const GMAIL_PASS = Deno.env.get("GMAIL_PASS")
const CRON_SECRET = Deno.env.get("CRON_SECRET")

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const DEFAULT_CATEGORIES = [
  { name: "Food", icon: "🍜", color: "#f97316" },
  { name: "Transport", icon: "🚌", color: "#3b82f6" },
  { name: "Shopping", icon: "🛍️", color: "#a855f7" },
  { name: "Health", icon: "💊", color: "#ef4444" },
  { name: "Bills", icon: "📄", color: "#64748b" },
  { name: "Entertainment", icon: "🎬", color: "#ec4899" },
  { name: "Education", icon: "📚", color: "#06b6d4" },
  { name: "Other", icon: "📦", color: "#84cc16" },
]

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const formatCurrencyFull = (amount: number | string, currency = "₹") => {
  const num = Number(amount) || 0
  return `${currency}${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

const formatPrettyDate = (dateStr: string) => {
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const formatMonthLabel = (dateStr: string) => {
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  })
}

const safeMonthToken = (monthLabel: string) =>
  monthLabel.toLowerCase().replaceAll(" ", "-")

const getCategoryMeta = (name: string) =>
  DEFAULT_CATEGORIES.find((c) => c.name === name) || { name, icon: "📦", color: "#84cc16" }

const getPreviousMonthRange = (now = new Date()) => {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
  const toISO = (date: Date) => date.toISOString().slice(0, 10)

  const startDate = toISO(start)
  const endDate = toISO(end)

  return {
    startDate,
    endDate,
    monthLabel: formatMonthLabel(startDate),
  }
}

const toTransactions = (expenses: any[], income: any[]) => {
  const mappedExpenses: Transaction[] = (expenses ?? []).map((item) => ({
    ...item,
    _type: "expense",
  }))

  const mappedIncome: Transaction[] = (income ?? []).map((item) => ({
    ...item,
    _type: "income",
    category: "Income",
    note: item.note || "Income",
  }))

  return [...mappedExpenses, ...mappedIncome].sort((a, b) => {
    const aTime = new Date(a.created_at || `${a.date}T00:00:00`).getTime()
    const bTime = new Date(b.created_at || `${b.date}T00:00:00`).getTime()
    return bTime - aTime
  })
}

const buildTransactionSummary = (transactions: Transaction[]): Summary => {
  const summary: Summary = {
    totalIncome: 0,
    totalExpenses: 0,
    incomeCount: 0,
    expenseCount: 0,
    categoryTotals: {},
  }

  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount) || 0

    if (transaction._type === "income") {
      summary.totalIncome += amount
      summary.incomeCount += 1
      return
    }

    summary.totalExpenses += amount
    summary.expenseCount += 1
    if (!summary.categoryTotals[transaction.category]) {
      summary.categoryTotals[transaction.category] = 0
    }
    summary.categoryTotals[transaction.category] += amount
  })

  return summary
}

const buildDailyBuckets = (transactions: Transaction[], startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1)
  const buckets: Array<{ date: Date; label: string; income: number; expenses: number }> = []

  for (let i = 0; i < totalDays; i += 1) {
    const current = new Date(start)
    current.setDate(start.getDate() + i)
    const label = i % 5 === 0
      ? current.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      : ""

    buckets.push({
      date: current,
      label,
      income: 0,
      expenses: 0,
    })
  }

  transactions.forEach((transaction) => {
    const transactionDate = new Date(`${transaction.date}T00:00:00`)
    const index = Math.floor((transactionDate.getTime() - start.getTime()) / DAY_MS)

    if (index >= 0 && index < buckets.length) {
      const amount = Number(transaction.amount) || 0
      if (transaction._type === "income") buckets[index].income += amount
      else buckets[index].expenses += amount
    }
  })

  return buckets
}

const buildCategoryBreakdown = (transactions: Transaction[]) => {
  const totals: Record<string, number> = {}

  transactions.forEach((transaction) => {
    if (transaction._type !== "expense") return
    const amount = Number(transaction.amount) || 0
    totals[transaction.category] = (totals[transaction.category] || 0) + amount
  })

  return Object.entries(totals)
    .map(([name, amount]) => {
      const meta = getCategoryMeta(name)
      return { name, amount, icon: meta.icon, color: meta.color }
    })
    .sort((a, b) => b.amount - a.amount)
}

const getChartUrl = async (chartConfig: unknown) => {
  const response = await fetch("https://quickchart.io/chart/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chart: chartConfig,
      width: 600,
      height: 300,
      backgroundColor: "white",
      format: "png",
      version: "4",
    }),
  })

  if (!response.ok) {
    throw new Error(`QuickChart create failed (${response.status})`)
  }

  const payload = await response.json()
  if (!payload?.url) {
    throw new Error("QuickChart create did not return a URL")
  }

  return payload.url as string
}

const buildDualAxisLineChartBlock = async (title: string, subtitle: string, buckets: Array<{ date: Date; label: string; income: number; expenses: number }>) => {
  const width = 600
  const maxPoints = 25
  const step = Math.max(1, Math.ceil(buckets.length / maxPoints))

  const sampled = buckets.filter((_, i) => i % step === 0)
  const labels = sampled.map((bucket) => (
    bucket.label || bucket.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  ))

  const incomeMax = Math.max(1, ...buckets.map((bucket) => Number(bucket.income) || 0))
  const expenseMax = Math.max(1, ...buckets.map((bucket) => Number(bucket.expenses) || 0))

  const incomeData = sampled.map((bucket) => Number(bucket.income) || 0)
  const expenseData = sampled.map((bucket) => Number(bucket.expenses) || 0)

  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Income",
          data: incomeData,
          borderColor: "#16a34a",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2,
          fill: false,
          yAxisID: "y1",
        },
        {
          label: "Expenses",
          data: expenseData,
          borderColor: "#111827",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2,
          fill: false,
          yAxisID: "y2",
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "#6b7280",
            boxWidth: 12,
            font: { size: 10 },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#9ca3af",
            font: { size: 9 },
            maxRotation: 45,
            minRotation: 45,
          },
          grid: {
            color: "rgba(0,0,0,0.04)",
          },
        },
        y1: {
          position: "left",
          suggestedMax: incomeMax,
          ticks: {
            color: "#16a34a",
            font: { size: 9 },
          },
          grid: {
            color: "rgba(0,0,0,0.04)",
          },
        },
        y2: {
          position: "right",
          suggestedMax: expenseMax,
          ticks: {
            color: "#111827",
            font: { size: 9 },
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
  }

  let chart = ""
  try {
    const chartUrl = await getChartUrl(chartConfig)
    chart = `
      <img
        src="${escapeHtml(chartUrl)}"
        width="${width}"
        style="display:block;margin:16px auto;border-radius:8px;align:center;"
        alt="Cash flow chart"
      />
    `
  } catch (_error) {
    chart = "<div style=\"margin-top:16px;font-size:12px;color:#6b7280;\">Chart unavailable in this email send. Please check the app preview for chart details.</div>"
  }

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

const buildReportHtml = async ({
  userName,
  monthLabel,
  startDate,
  endDate,
  transactions,
}: {
  userName: string
  monthLabel: string
  startDate: string
  endDate: string
  transactions: Transaction[]
}) => {
  const summary = buildTransactionSummary(transactions)
  const categories = buildCategoryBreakdown(transactions).slice(0, 6)
  const buckets = buildDailyBuckets(transactions, startDate, endDate)
  const net = summary.totalIncome - summary.totalExpenses

  const chartBlock = await buildDualAxisLineChartBlock(
    `Cash flow in ${monthLabel}`,
    `Income and expenses grouped across ${monthLabel}.`,
    buckets,
  )

  const categoryRows = categories.length > 0
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:separate;border-spacing:0;">
        <tr>
          <td style="padding-bottom:10px;">
            <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
              <tr>
                ${categories.map((category) => {
                  const percent = summary.totalExpenses > 0 ? (category.amount / summary.totalExpenses) * 100 : 0
                  return `<td style="height:10px;background:${category.color};width:${Math.max(percent, 1)}%;font-size:0;line-height:0;">&nbsp;</td>`
                }).join("")}
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
                    <td style="font-size:12px;color:#111827;padding:6px 0;">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${category.color};margin-right:6px;"></span>
                      ${escapeHtml(category.icon)} ${escapeHtml(category.name)}
                    </td>
                    <td style="font-size:11px;font-family:monospace;color:#4b5563;text-align:right;white-space:nowrap;padding:6px 0;">
                      ${escapeHtml(formatCurrencyFull(category.amount))} · ${percent}%
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `
        }).join("")}
      </table>
    `
    : "<div style=\"font-size:13px;color:#6b7280;padding:6px;\">No expense categories in this range.</div>"

  return `
    <div style="margin:0;padding:0;background:#fafaf8;color:#111827;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:760px;margin:0 auto;padding:24px;">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:24px;box-shadow:0 12px 40px rgba(15,15,15,0.06);">
          <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;width:100%;">
            <tr>
              <td style="vertical-align:top;">
                <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Transaction report</div>
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#111827;">${escapeHtml(monthLabel)} summary</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#4b5563;">Prepared for ${escapeHtml(userName || "you")} for ${escapeHtml(monthLabel)}.</p>
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
                { label: "Income", value: formatCurrencyFull(summary.totalIncome), color: "#16a34a" },
                { label: "Expenses", value: formatCurrencyFull(summary.totalExpenses), color: "#111827" },
              ].map((stat) => `
                <td style="border:1px solid #e5e7eb;border-radius:14px;padding:12px 14px;background:#fafaf8;">
                  <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">${escapeHtml(stat.label)}</div>
                  <div style="font-size:20px;line-height:1.1;font-weight:700;color:${stat.color};font-family:monospace;">${escapeHtml(stat.value)}</div>
                </td>
              `).join("")}
            </tr>
            <tr>
              ${[
                { label: "Net", value: formatCurrencyFull(net), color: net >= 0 ? "#16a34a" : "#dc2626" },
                { label: "Transactions", value: String(transactions.length), color: "#111827" },
              ].map((stat) => `
                <td style="border:1px solid #e5e7eb;border-radius:14px;padding:12px 14px;background:#fafaf8;">
                  <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">${escapeHtml(stat.label)}</div>
                  <div style="font-size:20px;line-height:1.1;font-weight:700;color:${stat.color};font-family:monospace;">${escapeHtml(stat.value)}</div>
                </td>
              `).join("")}
            </tr>
          </table>

          ${chartBlock}

          <div style="margin-top:24px;">
            <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:4px;">Expense breakdown</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:14px;">The categories below are based on expense transactions only.</div>
            <div style="margin-top:12px;border:1px solid #e5e7eb;border-radius:16px;padding:12px;">
              ${categoryRows}
            </div>
          </div>

          <p style="margin-top:16px;font-size:11px;color:#9ca3af;">
            Date range covered: ${escapeHtml(formatPrettyDate(startDate))} to ${escapeHtml(formatPrettyDate(endDate))}
          </p>

          <div style="margin-top:20px;padding-top:14px;border-top:1px solid #f3f4f6;text-align:center;">
            <div style="font-size:12px;color:#111827;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Spendly</div>
            <div style="margin-top:4px;font-size:11px;color:#6b7280;">Track smarter spending, one report at a time.</div>
          </div>
        </div>
      </div>
    </div>
  `
}

const buildWorkbookBase64 = (transactions: Transaction[], startDate: string, endDate: string, monthLabel: string) => {
  const transactionRows = [
    ["Date", "Type", "Category", "Amount", "Notes"],
    ...transactions.map((t) => [
      t.date,
      t._type,
      t.category,
      Number(t.amount) || 0,
      t.note || "",
    ]),
  ]

  const summaryRows = [
    ["Field", "Value"],
    ["Month", monthLabel],
    ["Start date", startDate],
    ["End date", endDate],
    ["Transactions", transactions.length],
    ["Income entries", transactions.filter((t) => t._type === "income").length],
    ["Expense entries", transactions.filter((t) => t._type === "expense").length],
  ]

  const workbook = xlsx.utils.book_new()
  const transactionsSheet = xlsx.utils.aoa_to_sheet(transactionRows)
  const summarySheet = xlsx.utils.aoa_to_sheet(summaryRows)

  xlsx.utils.book_append_sheet(workbook, transactionsSheet, "Transactions")
  xlsx.utils.book_append_sheet(workbook, summarySheet, "Summary")

  return xlsx.write(workbook, { bookType: "xlsx", type: "base64" })
}

const listAllUsers = async (supabase: ReturnType<typeof createClient>) => {
  const users: AuthUser[] = []
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error

    const batch = (data?.users ?? []) as AuthUser[]
    users.push(...batch)

    if (batch.length < 1000) break
    page += 1
  }

  return users
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405)
  }

  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing Supabase env vars." }, 500)
  }

  if (!GMAIL_USER || !GMAIL_PASS) {
    return jsonResponse({ error: "Missing Gmail credentials." }, 500)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  })

  try {
    const { startDate, endDate, monthLabel } = getPreviousMonthRange(new Date())

    const [{ data: prefRows, error: prefError }, users] = await Promise.all([
      supabase
        .from("user_email_preferences")
        .select("user_id, monthly_report_enabled")
        .eq("monthly_report_enabled", true),
      listAllUsers(supabase),
    ])

    if (prefError) throw prefError

    const enabledUserIds = new Set((prefRows ?? []).map((row: any) => row.user_id as string))
    const recipients = users.filter((user: AuthUser) => enabledUserIds.has(user.id) && Boolean(user.email))

    const BATCH_SIZE = 5
    const results: Array<{ userId: string; status: string; error?: string }> = []

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE)

      const batchResults = await Promise.all(
        batch.map(async (user: AuthUser) => {
          try {
            const [expenses, income] = await Promise.all([
              supabase
                .from("expenses")
                .select("*")
                .eq("user_id", user.id)
                .gte("date", startDate)
                .lte("date", endDate),
              supabase
                .from("income")
                .select("*")
                .eq("user_id", user.id)
                .gte("date", startDate)
                .lte("date", endDate),
            ])

            if (expenses.error) throw expenses.error
            if (income.error) throw income.error

            const transactions = toTransactions(expenses.data ?? [], income.data ?? [])

            if (transactions.length === 0) {
              return { userId: user.id, status: "skipped" }
            }

            const userName = user.user_metadata?.name || user.email?.split("@")[0] || "You"
            const html = await buildReportHtml({ userName, monthLabel, startDate, endDate, transactions })
            const workbookBase64 = buildWorkbookBase64(transactions, startDate, endDate, monthLabel)

            await transporter.sendMail({
              from: `"Spendly" <${GMAIL_USER}>`,
              to: user.email as string,
              subject: `Transaction Report - ${monthLabel}`,
              html,
              attachments: [
                {
                  filename: `transaction-history-${safeMonthToken(monthLabel)}.xlsx`,
                  content: workbookBase64,
                  encoding: "base64",
                },
              ],
            })

            return { userId: user.id, status: "sent" }
          } catch (error) {
            return {
              userId: user.id,
              status: "failed",
              error: error instanceof Error ? error.message : String(error),
            }
          }
        }),
      )

      results.push(...batchResults)
    }

    return jsonResponse({
      ok: true,
      range: { startDate, endDate, monthLabel },
      totalRecipients: recipients.length,
      results,
    })
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500)
  }
})
