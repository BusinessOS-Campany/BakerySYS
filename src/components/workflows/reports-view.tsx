"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { apiFetch, L, type Locale } from "./shared";
import { formatDate, formatMoney } from "@/lib/i18n/dictionary";

type ReportData = {
  period: { days: number; since: string; generatedAt: string };
  summary: {
    revenue: number; cogs: number; grossProfit: number; tax: number; expenses: number;
    netProfit: number; rawStockValue: number; finishedStockValue: number; receivables: number; payables: number;
  };
  salesByProduct: { productId: string; name: string; nameAr: string; sku: string; revenue: number; cogs: number; profit: number; quantity: number }[];
  trialBalance: { code: string; name: string; debit: number; credit: number }[];
  journalEntries: { id: string; entryNumber: string; date: string; description: string }[];
};
type Insight = { kind: string; title: string; body: string; metric?: number; link?: string };

export function ReportsPage({ locale, canExport, currency, decimalPlaces }: {
  locale: Locale;
  canExport: boolean;
  currency: string;
  decimalPlaces: number;
}) {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<ReportData | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [provider, setProvider] = useState("");
  const [error, setError] = useState("");
  const money = (value: number) => formatMoney(value, locale, currency, decimalPlaces);

  const load = useCallback(async () => {
    setError("");
    try {
      const [data, ai] = await Promise.all([
        apiFetch<ReportData>(`/api/reports?days=${days}`, locale),
        apiFetch<{ provider: string; insights: Insight[] }>(`/api/ai/insights?days=${days}`, locale),
      ]);
      setReport(data);
      setInsights(ai.insights);
      setProvider(ai.provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [days, locale]);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv() {
    setError("");
    try {
      const csv = await apiFetch<string>("/api/reports", locale, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bakery-report-${days}d.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const cards = report ? [
    { label: L(locale, "الإيرادات", "Revenue"), value: money(report.summary.revenue) },
    { label: L(locale, "تكلفة المبيعات", "COGS"), value: money(report.summary.cogs) },
    { label: L(locale, "الربح الإجمالي", "Gross profit"), value: money(report.summary.grossProfit) },
    { label: L(locale, "المصروفات", "Expenses"), value: money(report.summary.expenses) },
    { label: L(locale, "صافي الربح", "Net profit"), value: money(report.summary.netProfit) },
    { label: L(locale, "قيمة المخزون الخام", "Raw stock value"), value: money(report.summary.rawStockValue) },
    { label: L(locale, "قيمة المخزون التام", "Finished stock value"), value: money(report.summary.finishedStockValue) },
    { label: L(locale, "المدينون", "Receivables"), value: money(report.summary.receivables) },
    { label: L(locale, "الدائنون", "Payables"), value: money(report.summary.payables) },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{L(locale, "التقارير والتحليلات", "Reports & analytics")}</h1>
          <p className="muted mt-1 text-sm">
            {report
              ? `${formatDate(report.period.since, locale)} — ${formatDate(report.period.generatedAt, locale)}`
              : L(locale, "بيانات مالية وتشغيلية من قاعدة البيانات", "Financial and operational data from the database")}
          </p>
        </div>
        <div className="flex gap-2">
          <select className="input w-auto" onChange={(event) => setDays(Number(event.target.value))} value={days}>
            <option value={7}>{L(locale, "7 أيام", "7 days")}</option>
            <option value={30}>{L(locale, "30 يوم", "30 days")}</option>
            <option value={90}>{L(locale, "90 يوم", "90 days")}</option>
            <option value={365}>{L(locale, "سنة", "1 year")}</option>
          </select>
          {canExport ? (
            <button className="btn btn-primary" onClick={() => void exportCsv()} type="button">
              <Download className="h-4 w-4" /> {L(locale, "تصدير CSV", "Export CSV")}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div className="card p-4" key={card.label}>
            <div className="muted text-xs">{card.label}</div>
            <div className="mt-2 text-lg font-bold tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{L(locale, "رؤى ذكية", "AI insights")}</h2>
          <span className="muted text-xs">{provider || "—"}</span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {insights.map((insight) => (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3" key={`${insight.kind}-${insight.title}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{insight.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${insight.kind === "RISK" ? "bg-red-100 text-red-700" : insight.kind === "ACTION" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {insight.kind}
                </span>
              </div>
              <p className="muted mt-2 text-xs leading-relaxed">{insight.body}</p>
              {insight.metric !== undefined ? <p className="mt-2 text-sm font-bold tabular-nums">{insight.metric}</p> : null}
            </div>
          ))}
          {insights.length === 0 ? <p className="muted text-sm">{L(locale, "لا توجد رؤى للفترة المحددة", "No insights for this period")}</p> : null}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-[var(--border)] p-4 text-base font-bold">{L(locale, "المبيعات حسب المنتج", "Sales by product")}</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{L(locale, "المنتج", "Product")}</th>
                  <th>{L(locale, "الكمية", "Qty")}</th>
                  <th>{L(locale, "الإيراد", "Revenue")}</th>
                  <th>{L(locale, "الربح", "Profit")}</th>
                </tr>
              </thead>
              <tbody>
                {(report?.salesByProduct ?? []).map((row) => (
                  <tr key={row.productId}>
                    <td>{locale === "ar" ? row.nameAr : row.name}</td>
                    <td>{row.quantity}</td>
                    <td>{money(row.revenue)}</td>
                    <td>{money(row.profit)}</td>
                  </tr>
                ))}
                {!report?.salesByProduct.length ? (
                  <tr><td className="muted p-6 text-center" colSpan={4}>{L(locale, "لا توجد مبيعات", "No sales")}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-[var(--border)] p-4 text-base font-bold">{L(locale, "ميزان المراجعة", "Trial balance")}</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{L(locale, "الحساب", "Account")}</th>
                  <th>{L(locale, "مدين", "Debit")}</th>
                  <th>{L(locale, "دائن", "Credit")}</th>
                </tr>
              </thead>
              <tbody>
                {(report?.trialBalance ?? []).map((row) => (
                  <tr key={row.code}>
                    <td>{row.code} · {row.name}</td>
                    <td>{money(row.debit)}</td>
                    <td>{money(row.credit)}</td>
                  </tr>
                ))}
                {!report?.trialBalance.length ? (
                  <tr><td className="muted p-6 text-center" colSpan={3}>{L(locale, "لا توجد قيود", "No posted journals")}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
