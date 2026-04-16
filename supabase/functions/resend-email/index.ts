import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

const GMAIL_USER = Deno.env.get("GMAIL_USER");
const GMAIL_PASS = Deno.env.get("GMAIL_PASS");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QUICKCHART_SRC_REGEX = /src=(['"])(https:\/\/[^'"\s>]*quickchart\.io[^'"\s>]*)\1/gi;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CATEGORIES = [
  { name: "Food", icon: "🍜", color: "#f97316" },
  { name: "Transport", icon: "🚌", color: "#3b82f6" },
  { name: "Shopping", icon: "🛍️", color: "#a855f7" },
  { name: "Health", icon: "💊", color: "#ef4444" },
  { name: "Bills", icon: "📄", color: "#64748b" },
  { name: "Entertainment", icon: "🎬", color: "#ec4899" },
  { name: "Education", icon: "📚", color: "#06b6d4" },
  { name: "Other", icon: "📦", color: "#84cc16" },
];

type TransactionPayload = {
  date: string;
  category: string;
  amount: number | string;
  note?: string | null;
  _type: "expense" | "income";
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const compactEmailHtml = (html: string) => html
  .replace(/\r?\n/g, "")
  .replace(/>\s+</g, "><")
  .replace(/\s{2,}/g, " ")
  .trim();

const formatCurrencyFull = (amount: number | string, currency = "₹") => {
  const num = Number(amount) || 0;
  return `${currency}${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const formatPrettyDate = (dateStr: string) => {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getCategoryMeta = (name: string) =>
  DEFAULT_CATEGORIES.find((category) => category.name === name) || { name, icon: "📦", color: "#84cc16" };

const buildDailyBuckets = (transactions: TransactionPayload[], startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
  const buckets: Array<{ date: Date; label: string; income: number; expenses: number }> = [];

  for (let i = 0; i < totalDays; i += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const label = i % 5 === 0
      ? current.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      : "";

    buckets.push({ date: current, label, income: 0, expenses: 0 });
  }

  transactions.forEach((transaction) => {
    const transactionDate = new Date(`${transaction.date}T00:00:00`);
    const index = Math.floor((transactionDate.getTime() - start.getTime()) / DAY_MS);

    if (index >= 0 && index < buckets.length) {
      const amount = Number(transaction.amount) || 0;
      if (transaction._type === "income") buckets[index].income += amount;
      else buckets[index].expenses += amount;
    }
  });

  return buckets;
};

const buildCategoryBreakdown = (transactions: TransactionPayload[]) => {
  const totals: Record<string, number> = {};

  transactions.forEach((transaction) => {
    if (transaction._type !== "expense") return;
    const amount = Number(transaction.amount) || 0;
    totals[transaction.category] = (totals[transaction.category] || 0) + amount;
  });

  return Object.entries(totals)
    .map(([name, amount]) => {
      const meta = getCategoryMeta(name);
      return { name, amount, icon: meta.icon, color: meta.color };
    })
    .sort((a, b) => b.amount - a.amount);
};

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
  });

  if (!response.ok) {
    throw new Error(`QuickChart create failed (${response.status})`);
  }

  const payload = await response.json();
  if (!payload?.url) {
    throw new Error("QuickChart create did not return a URL");
  }

  return payload.url as string;
};

const buildDualAxisLineChartBlock = async (
  title: string,
  subtitle: string,
  buckets: Array<{ date: Date; label: string; income: number; expenses: number }>,
) => {
  const width = 600;
  const maxPoints = 25;
  const step = Math.max(1, Math.ceil(buckets.length / maxPoints));

  const sampled = buckets.filter((_, i) => i % step === 0);
  const labels = sampled.map((bucket) => (
    bucket.label || bucket.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  ));

  const incomeMax = Math.max(1, ...buckets.map((bucket) => Number(bucket.income) || 0));
  const expenseMax = Math.max(1, ...buckets.map((bucket) => Number(bucket.expenses) || 0));

  const incomeData = sampled.map((bucket) => Number(bucket.income) || 0);
  const expenseData = sampled.map((bucket) => Number(bucket.expenses) || 0);

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
  };

  let chart = "";
  try {
    const chartUrl = await getChartUrl(chartConfig);
    chart = `
      <img
        src="${escapeHtml(chartUrl)}"
        width="${width}"
        style="display:block;margin:16px auto;border-radius:8px;align:center;"
        alt="Cash flow chart"
      />
    `;
  } catch {
    chart = '<div style="margin-top:16px;font-size:12px;color:#6b7280;">Chart unavailable in this email send. Please check the app preview for chart details.</div>';
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
  `;
};

const buildTransactionReportHtml = async ({
  userName,
  startDate,
  endDate,
  transactions,
}: {
  userName: string;
  startDate: string;
  endDate: string;
  transactions: TransactionPayload[];
}) => {
  const totalIncome = transactions
    .filter((transaction) => transaction._type === "income")
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
  const totalExpenses = transactions
    .filter((transaction) => transaction._type === "expense")
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
  const incomeCount = transactions.filter((transaction) => transaction._type === "income").length;
  const expenseCount = transactions.filter((transaction) => transaction._type === "expense").length;

  const categories = buildCategoryBreakdown(transactions).slice(0, 4);
  const buckets = buildDailyBuckets(transactions, startDate, endDate);
  const net = totalIncome - totalExpenses;
  const chartBlock = await buildDualAxisLineChartBlock(
    "Cash flow by range",
    "Income and expenses grouped across the selected period.",
    buckets,
  );

  const categoryRows = categories.length > 0
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:separate;border-spacing:0;">
        <tr>
          <td style="padding-bottom:10px;">
            <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
              <tr>
                ${categories.map((category) => {
                  const percent = totalExpenses > 0 ? (category.amount / totalExpenses) * 100 : 0;
                  return `<td style="height:10px;background:${category.color};width:${Math.max(percent, 1)}%;font-size:0;line-height:0;">&nbsp;</td>`;
                }).join("")}
              </tr>
            </table>
          </td>
        </tr>
        ${categories.map((category) => {
          const percent = totalExpenses > 0 ? Math.round((category.amount / totalExpenses) * 100) : 0;
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
          `;
        }).join("")}
      </table>
    `
    : '<div style="font-size:13px;color:#6b7280;padding:6px;">No expense categories in this range.</div>';

  return `
    <div style="margin:0;padding:0;background:#fafaf8;color:#111827;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:760px;margin:0 auto;padding:24px;">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:24px;box-shadow:0 12px 40px rgba(15,15,15,0.06);">
          <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;width:100%;">
            <tr>
              <td style="vertical-align:top;">
                <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Transaction report</div>
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#111827;">Your selected history</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#4b5563;">Prepared for ${escapeHtml(userName || "you")} from ${escapeHtml(formatPrettyDate(startDate))} to ${escapeHtml(formatPrettyDate(endDate))}.</p>
              </td>
              <td style="vertical-align:top;text-align:right;white-space:nowrap;padding-left:12px;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-left:auto;">
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding:0 8px 4px 0;">Transactions</td>
                    <td style="font-size:12px;color:#111827;font-weight:700;text-align:right;padding:0 0 4px;">${escapeHtml(transactions.length)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding:0 8px 4px 0;">Expenses</td>
                    <td style="font-size:12px;color:#111827;font-weight:700;text-align:right;padding:0 0 4px;">${escapeHtml(expenseCount)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding:0 8px 0 0;">Income entries</td>
                    <td style="font-size:12px;color:#111827;font-weight:700;text-align:right;padding:0;">${escapeHtml(incomeCount)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin-top:22px;border-collapse:separate;border-spacing:8px;">
            <tr>
              ${[
                { label: "Income", value: formatCurrencyFull(totalIncome), color: "#16a34a" },
                { label: "Expenses", value: formatCurrencyFull(totalExpenses), color: "#111827" },
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

          <div style="margin-top:20px;padding-top:14px;border-top:1px solid #f3f4f6;text-align:center;">
            <div style="font-size:12px;color:#111827;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Spendly</div>
            <div style="margin-top:4px;font-size:11px;color:#6b7280;">Your personal expense tracker</div>
          </div>

        </div>
      </div>
    </div>
  `;
};

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

async function inlineQuickChartImages(html: string) {
  let nextHtml = html;
  const inlineAttachments: Array<{
    filename: string;
    content: string;
    encoding: "base64";
    cid: string;
    contentType: string;
    contentDisposition: "inline";
  }> = [];

  const processed = new Map<string, string>();
  const urls = Array.from(new Set(Array.from(html.matchAll(QUICKCHART_SRC_REGEX), (match) => match[2])));

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    if (!url) continue;

    let cid = processed.get(url);

    if (!cid) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;

        const contentType = response.headers.get("content-type") || "image/png";
        const bytes = new Uint8Array(await response.arrayBuffer());
        cid = `chart-inline-${i + 1}-${crypto.randomUUID()}@spendly`;

        inlineAttachments.push({
          filename: `chart-inline-${i + 1}.png`,
          content: uint8ToBase64(bytes),
          encoding: "base64",
          cid,
          contentType,
          contentDisposition: "inline",
        });

        processed.set(url, cid);
      } catch {
        continue;
      }
    }

    if (cid) {
      nextHtml = nextHtml
        .replaceAll(`src="${url}"`, `src="cid:${cid}"`)
        .replaceAll(`src='${url}'`, `src='cid:${cid}'`);
    }
  }

  return { html: nextHtml, inlineAttachments };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!GMAIL_USER || !GMAIL_PASS) {
    return jsonResponse({ error: "Missing Gmail credentials" }, 500);
  }

  // Require user auth token.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  // Validate user from token.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "Invalid user" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid or empty JSON body" }, 400);
  }

  const { subject, html, attachments, template, data } = payload ?? {};

  let resolvedSubject = typeof subject === "string" ? subject.trim() : "";
  let resolvedHtml = typeof html === "string" ? html : "";

  if (!resolvedHtml && template === "transaction-report") {
    const typedData = data as {
      userName?: string;
      startDate?: string;
      endDate?: string;
      transactions?: TransactionPayload[];
    };

    if (!typedData?.startDate || !typedData?.endDate || !Array.isArray(typedData?.transactions)) {
      return jsonResponse({ error: "Missing transaction-report data: startDate, endDate, transactions" }, 400);
    }

    resolvedHtml = await buildTransactionReportHtml({
      userName: typedData.userName || user.email?.split("@")[0] || "You",
      startDate: typedData.startDate,
      endDate: typedData.endDate,
      transactions: typedData.transactions,
    });

    if (!resolvedSubject) {
      resolvedSubject = `Transaction Report - ${typedData.startDate} to ${typedData.endDate}`;
    }
  }

  if (!resolvedSubject || !resolvedHtml) {
    return jsonResponse({ error: "Missing required fields. Provide subject+html or template+data" }, 400);
  }

  // Send only to the authenticated user's email.
  const to = user.email;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  });

  try {
    const compactHtml = compactEmailHtml(String(resolvedHtml));
    const { html: emailHtml, inlineAttachments } = await inlineQuickChartImages(compactHtml);
    const finalHtml = compactEmailHtml(emailHtml);

    await transporter.sendMail({
      from: `"Spendly" <${GMAIL_USER}>`,
      to,
      subject: resolvedSubject,
      html: finalHtml,
      attachments: [
        ...(Array.isArray(attachments)
          ? attachments.map((a: any) => ({
              filename: a.filename,
              content: a.content,
              encoding: "base64",
            }))
          : []),
        ...inlineAttachments,
      ],
    });
  } catch (err) {
    return jsonResponse({ error: "Gmail send failed", details: String(err) }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});