import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { getReportData } from "@/lib/reports/service";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "reports.view",
  handler: async (_input, auth, req) => {
    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30), 1), 365);
    const data = await getReportData(db, auth.user.tenantId, days);
    return serialize(data);
  },
});

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export const POST = apiRoute({
  permission: "reports.export",
  handler: async (_input, auth, req) => {
    const body = await req.json().catch(() => ({})) as { days?: number };
    const days = Math.min(Math.max(Number(body.days ?? 30), 1), 365);
    const data = await getReportData(db, auth.user.tenantId, days);
    const rows: (string | number)[][] = [
      ["Section", "Metric", "Value"],
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
        "Content-Disposition": `attachment; filename="bakery-report-${days}d.csv"`,
      },
    });
  },
});
