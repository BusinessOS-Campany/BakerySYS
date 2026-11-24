"use client";

import { forwardRef, type CSSProperties } from "react";
import { formatDate, formatMoney } from "@/lib/i18n/dictionary";
import { L, type Locale } from "./shared";

export type ReportData = {
  period: { period: "day" | "week" | "month" | "custom"; days?: number; from: string; to: string; generatedAt: string };
  summary: {
    revenue: number; cogs: number; grossProfit: number; tax: number; expenses: number;
    netProfit: number; rawStockValue: number; finishedStockValue: number; receivables: number; payables: number;
  };
  salesByProduct: { productId: string; name: string; nameAr: string; sku: string; revenue: number; cogs: number; profit: number; quantity: number }[];
  trialBalance: { code: string; name: string; debit: number; credit: number }[];
  journalEntries: { id: string; entryNumber: string; date: string; description: string }[];
};

const sheetStyle: CSSProperties = {
  boxSizing: "border-box",
  background: "#fff",
  color: "#141414",
  fontFamily: '"Noto Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif',
  fontSize: "10pt",
  lineHeight: 1.5,
  width: "210mm",
  maxWidth: "100%",
  minHeight: "297mm",
  padding: "14mm",
  boxShadow: "0 10px 40px rgba(0,0,0,.12)",
};

const sectionTitle: CSSProperties = {
  fontSize: "11pt",
  fontWeight: 700,
  margin: "14px 0 6px",
  paddingBottom: 4,
  borderBottom: "2px solid #c8a45c",
};

const thStyle: CSSProperties = {
  background: "#f2f3f5",
  borderBottom: "1px solid #d5d8dc",
  padding: "5px 7px",
  textAlign: "inherit",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = { borderBottom: "1px solid #ececec", padding: "5px 7px" };

type Props = {
  report: ReportData;
  locale: Locale;
  currency: string;
  decimalPlaces: number;
  periodTitle: string;
  tenantName: string;
};

export const ReportSheet = forwardRef<HTMLDivElement, Props>(function ReportSheet(
  { report, locale, currency, decimalPlaces, periodTitle, tenantName }, ref,
) {
  const rtl = locale === "ar";
  const align: CSSProperties = { textAlign: rtl ? "right" : "left" };
  const money = (value: number) => formatMoney(value, locale, currency, decimalPlaces);
  const end = new Date(Date.parse(report.period.to) - 86_400_000);
  const kpis: { label: string; value: number }[] = [
    { label: L(locale, "الإيرادات", "Revenue"), value: report.summary.revenue },
    { label: L(locale, "تكلفة المبيعات", "COGS"), value: report.summary.cogs },
    { label: L(locale, "الربح الإجمالي", "Gross profit"), value: report.summary.grossProfit },
    { label: L(locale, "المصروفات", "Expenses"), value: report.summary.expenses },
    { label: L(locale, "صافي الربح", "Net profit"), value: report.summary.netProfit },
    { label: L(locale, "الضريبة", "Tax"), value: report.summary.tax },
    { label: L(locale, "المخزون الخام", "Raw stock"), value: report.summary.rawStockValue },
    { label: L(locale, "المخزون التام", "Finished stock"), value: report.summary.finishedStockValue },
    { label: L(locale, "المدينون", "Receivables"), value: report.summary.receivables },
    { label: L(locale, "الدائنون", "Payables"), value: report.summary.payables },
  ];

  const table = (headers: string[], rows: (string | number)[][]) => (
    <table style={{ width: "100%", borderCollapse: "collapse", ...align }}>
      <thead><tr>{headers.map((header) => <th key={header} style={thStyle}>{header}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} style={tdStyle}>{cell}</td>)}</tr>
        ))}
        {rows.length === 0 ? (
          <tr><td style={{ ...tdStyle, color: "#777", padding: "10px" }} colSpan={headers.length}>
            {L(locale, "لا توجد بيانات", "No data")}
          </td></tr>
        ) : null}
      </tbody>
    </table>
  );

  return (
    <div dir={rtl ? "rtl" : "ltr"} lang={locale} ref={ref} style={sheetStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, borderBottom: "3px solid #c8a45c", paddingBottom: 10 }}>
        <div style={align}>
          <div style={{ fontSize: "16pt", fontWeight: 800 }}>{tenantName}</div>
          <div style={{ color: "#666", fontSize: "9pt" }}>{L(locale, "التقارير والتحليلات", "Reports & analytics")}</div>
        </div>
        <div style={{ textAlign: rtl ? "left" : "right" }}>
          <div style={{ fontSize: "13pt", fontWeight: 700 }}>{periodTitle}</div>
          <div style={{ color: "#555", fontSize: "9pt" }}>
            {formatDate(report.period.from, locale)} — {formatDate(end, locale)}
          </div>
        </div>
      </div>

      <h2 style={sectionTitle}>{L(locale, "ملخص الفترة", "Period summary")}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={{ border: "1px solid #e3e3e3", borderRadius: 6, padding: "6px 8px", background: "#fafafa" }}>
            <div style={{ color: "#666", fontSize: "8pt" }}>{kpi.label}</div>
            <div style={{ fontWeight: 700, fontSize: "10pt" }}>{money(kpi.value)}</div>
          </div>
        ))}
      </div>

      <h2 style={sectionTitle}>{L(locale, "المبيعات حسب المنتج", "Sales by product")}</h2>
      {table(
        [L(locale, "المنتج", "Product"), L(locale, "الكمية", "Qty"), L(locale, "الإيراد", "Revenue"), L(locale, "التكلفة", "COGS"), L(locale, "الربح", "Profit")],
        report.salesByProduct.map((row) => [
          rtl ? row.nameAr : row.name,
          row.quantity,
          money(row.revenue),
          money(row.cogs),
          money(row.profit),
        ]),
      )}

      <h2 style={sectionTitle}>{L(locale, "ميزان المراجعة", "Trial balance")}</h2>
      {table(
        [L(locale, "الحساب", "Account"), L(locale, "مدين", "Debit"), L(locale, "دائن", "Credit")],
        report.trialBalance.map((row) => [`${row.code} · ${row.name}`, money(row.debit), money(row.credit)]),
      )}

      <h2 style={sectionTitle}>{L(locale, "قيود اليومية", "Journal entries")}</h2>
      {table(
        [L(locale, "الرقم", "Number"), L(locale, "التاريخ", "Date"), L(locale, "البيان", "Description")],
        report.journalEntries.map((row) => [row.entryNumber, formatDate(row.date, locale), row.description]),
      )}

      <div style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #ddd", color: "#777", fontSize: "8pt", display: "flex", justifyContent: "space-between" }}>
        <span>{L(locale, "أنشئ في", "Generated at")}: {formatDate(report.period.generatedAt, locale, true)}</span>
        <span>{currency}</span>
      </div>
    </div>
  );
});
