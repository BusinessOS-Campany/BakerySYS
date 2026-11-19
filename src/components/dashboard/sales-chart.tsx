"use client";

import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatMoney, type Locale } from "@/lib/i18n/dictionary";

export type SalesPoint = { date: string; label: string; revenue: number; profit: number };

export function SalesChart({
  data,
  locale,
  currency,
  dp,
}: {
  data: SalesPoint[];
  locale: Locale;
  currency: string;
  dp: number;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#e98213" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#e98213" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#16a34a" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            width={58}
            tickFormatter={(value: number) => formatMoney(value, locale, currency, 0)}
          />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
            formatter={(value, name) => [
              formatMoney(Number(value ?? 0), locale, currency, dp),
              name === "revenue" ? (locale === "ar" ? "المبيعات" : "Revenue") : (locale === "ar" ? "الربح" : "Profit"),
            ]}
          />
          <Legend
            formatter={(value: string) => value === "revenue" ? (locale === "ar" ? "المبيعات" : "Revenue") : (locale === "ar" ? "الربح" : "Profit")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#e98213" strokeWidth={2} fill="url(#revenueFill)" />
          <Area type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={2} fill="url(#profitFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
