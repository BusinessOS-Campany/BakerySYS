"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Download, FileText, Printer } from "lucide-react";
import { apiFetch, L, numericLocale, type Locale } from "./shared";
import { formatDate, formatMoney } from "@/lib/i18n/dictionary";
import { ReportSheet, type ReportData } from "./report-sheet";

export type Period = "day" | "week" | "month";
type Insight = { kind: string; title: string; body: string; metric?: number; link?: string };

const TABS: { key: Period; href: string; ar: string; en: string }[] = [
  { key: "day", href: "/reports/daily", ar: "يومي", en: "Daily" },
  { key: "week", href: "/reports/weekly", ar: "أسبوعي", en: "Weekly" },
  { key: "month", href: "/reports/monthly", ar: "شهري", en: "Monthly" },
];

const DAY_MS = 86_400_000;

function dateKeyInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function mondayOfKey(key: string) {
  const date = new Date(`${key}T00:00:00.000Z`);
  const weekday = date.getUTCDay() || 7;
  return new Date(date.getTime() - (weekday - 1) * DAY_MS);
}

function weekValueFromKey(key: string) {
  const monday = mondayOfKey(key);
  const thursday = new Date(monday.getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Weekday = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (jan4Weekday - 1) * DAY_MS);
  const week = Math.floor((monday.getTime() - week1Monday.getTime()) / (7 * DAY_MS)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function keyFromWeekValue(value: string, fallback: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return fallback;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return fallback;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Weekday = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (jan4Weekday - 1) * DAY_MS);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * DAY_MS).toISOString().slice(0, 10);
}

export function ReportsPage({ locale, canExport, currency, decimalPlaces, period, tenantName, timezone }: {
  locale: Locale;
  canExport: boolean;
  currency: string;
  decimalPlaces: number;
  period: Period;
  tenantName: string;
  timezone: string;
}) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [anchor, setAnchor] = useState(() => dateKeyInZone(new Date(), timezone));
  const [insights, setInsights] = useState<Insight[]>([]);
  const [provider, setProvider] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const tab = TABS.find((item) => item.key === period)!;
  const periodTitle = L(locale, tab.ar, tab.en);
  const money = (value: number) => formatMoney(value, locale, currency, decimalPlaces);
  const selectorLabel = period === "day"
    ? L(locale, "اختر اليوم", "Select day")
    : period === "week"
      ? L(locale, "اختر الأسبوع", "Select week")
      : L(locale, "اختر الشهر", "Select month");
  const selectorType = period === "day" ? "date" : period === "week" ? "week" : "month";
  const selectorValue = period === "week" ? weekValueFromKey(anchor) : period === "month" ? anchor.slice(0, 7) : anchor;
  const selectedRange = report
    ? `${formatDate(report.period.from, locale)} — ${formatDate(new Date(Date.parse(report.period.to) - DAY_MS), locale)}`
    : "";
  const cards = report ? [
    { key: "revenue", label: L(locale, "الإيرادات", "Revenue"), value: money(report.summary.revenue), tone: "text-[var(--primary)]" },
    { key: "profit", label: L(locale, "الربح الإجمالي", "Gross profit"), value: money(report.summary.grossProfit), tone: "text-emerald-500" },
    { key: "expenses", label: L(locale, "المصروفات", "Expenses"), value: money(report.summary.expenses), tone: "text-[var(--danger)]" },
    { key: "net", label: L(locale, "صافي الربح", "Net profit"), value: money(report.summary.netProfit), tone: report.summary.netProfit >= 0 ? "text-emerald-500" : "text-[var(--danger)]" },
    { key: "receivables", label: L(locale, "المدينون", "Receivables"), value: money(report.summary.receivables), tone: "text-amber-500" },
    {
      key: "meals",
      label: L(locale, "الوجبات المقدمة", "Meals served"),
      value: `${new Intl.NumberFormat(numericLocale(locale), { maximumFractionDigits: 3 }).format(report.summary.mealsTotalKg)} kg`,
      tone: "text-sky-500",
    },
  ] : [];

  const load = useCallback(async () => {
    setError("");
    try {
      const query = new URLSearchParams({ period, date: anchor });
      const [data, ai] = await Promise.all([
        apiFetch<ReportData>(`/api/reports?${query}`, locale),
        apiFetch<{ provider: string; insights: Insight[] }>(`/api/ai/insights?${query}`, locale),
      ]);
      setReport(data);
      setInsights(ai.insights);
      setProvider(ai.provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [period, locale, anchor]);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv() {
    setError("");
    try {
      const csv = await apiFetch<string>("/api/reports", locale, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, date: anchor }),
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bakery-report-${period}-${anchor}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function downloadPdf() {
    const node = sheetRef.current;
    if (!node) return;
    setBusy(true);
    setError("");
    try {
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false, windowWidth: 1123,
      });
      const pageWidth = 794;
      const pageHeight = 1123;
      const ratio = canvas.width / pageWidth;
      const imageHeight = canvas.height / ratio;
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [pageWidth, pageHeight], compress: true });
      let offset = 0;
      let page = 0;
      while (offset < imageHeight) {
        const sliceHeight = Math.min(pageHeight, imageHeight - offset);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.round(sliceHeight * ratio);
        const context = slice.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, slice.width, slice.height);
        context.drawImage(canvas, 0, Math.round(offset * ratio), canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        if (page > 0) pdf.addPage([pageWidth, pageHeight], "portrait");
        pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pageWidth, sliceHeight);
        offset += pageHeight;
        page += 1;
      }
      pdf.save(`bakery-report-${period}-${anchor}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{L(locale, "التقارير والتحليلات", "Reports & analytics")}</h1>
          <p className="muted mt-1 text-sm">
            {report
              ? `${L(locale, "الفترة", "Period")}: ${periodTitle}`
              : L(locale, "بيانات مالية وتشغيلية من قاعدة البيانات", "Financial and operational data from the database")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1">
            <label className="text-xs font-semibold" htmlFor="report-period-selector">{selectorLabel}</label>
            <input
              className="input h-8 w-auto min-w-[10rem] text-xs"
              id="report-period-selector"
              onChange={(event) => {
                const raw = event.target.value;
                if (!raw) return;
                if (period === "week") setAnchor(keyFromWeekValue(raw, anchor));
                else if (period === "month") setAnchor(`${raw}-01`);
                else setAnchor(raw);
              }}
              title={L(locale, "تُستخدم هذه الفترة للطباعة وملف CSV", "This period is used for printing and CSV")}
              type={selectorType}
              value={selectorValue}
            />
            {selectedRange ? <span className="muted hidden text-[11px] tabular-nums lg:inline">{selectedRange}</span> : null}
          </div>
          {canExport ? (
            <>
              <button className="btn btn-secondary" disabled={busy || !report} onClick={() => void exportCsv()} type="button">
                <Download className="h-4 w-4" /> {L(locale, "تصدير CSV", "Export CSV")}
              </button>
              <button className="btn btn-secondary" disabled={busy || !report} onClick={() => void downloadPdf()} type="button">
                <FileText className="h-4 w-4" /> {busy ? L(locale, "جارٍ التجهيز...", "Preparing...") : L(locale, "تحميل PDF", "Download PDF")}
              </button>
            </>
          ) : null}
          <button className="btn btn-primary" disabled={!report} onClick={() => window.print()} type="button">
            <Printer className="h-4 w-4" /> {L(locale, "طباعة / حفظ PDF", "Print / Save PDF")}
          </button>
        </div>
      </div>

      <nav className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1">
        {TABS.map((tab) => (
          <Link
            className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold transition-colors ${tab.key === period ? "bg-[var(--primary)] text-white" : "hover:bg-[var(--surface)]"}`}
            href={tab.href}
            key={tab.key}
          >
            {L(locale, tab.ar, tab.en)}
          </Link>
        ))}
      </nav>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {cards.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {cards.map((card) => (
            <div className="card p-4 transition-shadow hover:shadow-md" key={card.key}>
              <div className="muted text-xs">{card.label}</div>
              <div className={`mt-2 text-xl font-bold tabular-nums ${card.tone}`}>{card.value}</div>
              <div className="muted mt-1 text-[11px]">{periodTitle}</div>
            </div>
          ))}
        </section>
      ) : null}

      {insights.length > 0 ? (
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
          </div>
        </section>
      ) : null}

      <div className="report-print-root mx-auto w-full max-w-[210mm] overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        {report ? (
          <ReportSheet
            currency={currency}
            decimalPlaces={decimalPlaces}
            locale={locale}
            periodTitle={periodTitle}
            ref={sheetRef}
            report={report}
            tenantName={tenantName}
            timezone={timezone}
          />
        ) : (
          <p className="muted p-10 text-center text-sm">{L(locale, "جارٍ تحميل التقرير...", "Loading report...")}</p>
        )}
      </div>
    </div>
  );
}
