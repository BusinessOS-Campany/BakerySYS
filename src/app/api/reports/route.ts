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
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
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
    const rows: (string | number)[][] = [
      ["Section", "Metric", "Value"],
      ["Period", periodLabel, `${data.period.from} — ${data.period.to}`],
      ["Summary", "Revenue", data.summary.revenue],
      ["Summary", "COGS", data.summary.cogs],
      ["Summary", "Gross profit", data.summary.grossProfit],
      ["Summary", "Tax", data.summary.tax],
      ["Summary", "Expenses", data.summary.expenses],
      ["Summary", "Net profit", data.summary.netProfit],
      ["Summary", "Raw stock value", data.summary.rawStockValue],
      ["Summary", "Finished stock value", data.summary.finishedStockValue],
      ["Summary", "Receivables", data.summary.receivables],
      ["Summary", "Payables", data.summary.payables],
      ...data.salesByProduct.map((row) => ["Sales by product", row.name, row.revenue] as (string | number)[]),
      ...data.trialBalance.map((row) => ["Trial balance", `${row.code} ${row.name}`, `${row.debit}/${row.credit}`] as (string | number)[]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bakery-report-${periodLabel}.csv"`,
      },
    });
  },
});
