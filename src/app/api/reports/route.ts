import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { getReportData, resolveReportRange } from "@/lib/reports/service";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "reports.view",
  handler: async (_input, auth, req) => {
    const url = new URL(req.url);
    const { range, meta } = resolveReportRange({
      period: url.searchParams.get("period") ?? undefined,
      days: url.searchParams.get("days") ?? undefined,
    }, auth.tenant.timezone);
    return serialize(await getReportData(db, auth.user.tenantId, range, meta));
  },
});

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const POST = apiRoute({
  permission: "reports.export",
  schema: z.object({
    period: z.enum(["day", "week", "month"]).optional(),
    days: z.number().optional(),
  }),
  handler: async (input, auth) => {
    const { range, meta } = resolveReportRange(input, auth.tenant.timezone);
    const data = await getReportData(db, auth.user.tenantId, range, meta);
    const periodLabel = meta.period === "custom" ? `${meta.days}d` : meta.period;
    const periodTitle = { day: "Daily", week: "Weekly", month: "Monthly", custom: `${meta.days ?? 30} days` }[meta.period];
    const rows: (string | number)[][] = [
      [auth.tenant.nameEn || "Bakery ERP", "Reports & analytics"],
      ["Period", periodTitle, `${data.period.from} — ${data.period.to}`],
      ["Generated at", data.period.generatedAt],
      [],
      ["Summary", "Value"],
      ["Revenue", data.summary.revenue],
      ["COGS", data.summary.cogs],
      ["Gross profit", data.summary.grossProfit],
      ["Tax", data.summary.tax],
      ["Expenses", data.summary.expenses],
      ["Net profit", data.summary.netProfit],
      ["Raw stock value", data.summary.rawStockValue],
      ["Finished stock value", data.summary.finishedStockValue],
      ["Receivables", data.summary.receivables],
      ["Payables", data.summary.payables],
      [],
      ["Sales by product", "Qty", "Revenue", "COGS", "Profit"],
      ...data.salesByProduct.map((row) => [row.name, row.quantity, row.revenue, row.cogs, row.profit] as (string | number)[]),
      [],
      ["Trial balance", "Debit", "Credit"],
      ...data.trialBalance.map((row) => [`${row.code} ${row.name}`, row.debit, row.credit] as (string | number)[]),
      [],
      ["Journal entries", "Number", "Date", "Description"],
      ...data.journalEntries.map((row) => [row.entryNumber, row.date, row.description] as (string | number)[]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bakery-report-${periodLabel}-${data.period.generatedAt.slice(0, 10)}.csv"`,
      },
    });
  },
});
