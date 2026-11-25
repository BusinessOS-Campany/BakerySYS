"use client";

import { useState } from "react";
import { DataPanel, L, numericLocale, useList, type Locale } from "./shared";
import { formatDate } from "@/lib/i18n/dictionary";

type MealRow = {
  id: string;
  servedAt: string;
  name: string;
  quantityKg: string | number;
  note: string | null;
  branchId: string | null;
};

export function MealsPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const meals = useList<MealRow>("/api/meals", undefined, locale, refresh);
  const today = new Date().toISOString().slice(0, 10);
  const totalKg = meals.rows.reduce((sum, row) => sum + Number(row.quantityKg), 0);
  const todayKg = meals.rows
    .filter((row) => new Date(row.servedAt).toISOString().slice(0, 10) === today)
    .reduce((sum, row) => sum + Number(row.quantityKg), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "الوجبات المقدمة", "Meals served")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "سجل يومي للوجبات وكمياتها بالكيلوغرام", "Daily log of meals and their quantities in kilograms")}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="muted text-xs">{L(locale, "كمية اليوم", "Today's quantity")}</div>
          <div className="mt-2 text-xl font-bold tabular-nums text-[var(--primary)]">
            {new Intl.NumberFormat(numericLocale(locale), { maximumFractionDigits: 3 }).format(todayKg)} kg
          </div>
        </div>
        <div className="card p-4">
          <div className="muted text-xs">{L(locale, "الإجمالي العام", "All-time total")}</div>
          <div className="mt-2 text-xl font-bold tabular-nums">
            {new Intl.NumberFormat(numericLocale(locale), { maximumFractionDigits: 3 }).format(totalKg)} kg
          </div>
        </div>
        <div className="card p-4">
          <div className="muted text-xs">{L(locale, "عدد السجلات", "Entries")}</div>
          <div className="mt-2 text-xl font-bold tabular-nums">{meals.rows.length}</div>
        </div>
      </section>

      <DataPanel<MealRow>
        endpoint="/api/meals"
        extract={(payload) => (payload as { items?: MealRow[] }).items ?? []}
        title={L(locale, "سجل الوجبات", "Meal register")}
        description={L(locale, "مثال: الوجبة الأولى 50 كيلو، الوجبة الثانية 40 كيلو", "Example: first meal 50 kg, second meal 40 kg")}
        rows={meals.rows}
        loading={meals.loading}
        reload={meals.reload}
        refreshKey={refresh}
        locale={locale}
        canManage={canManage}
        columns={[
          { key: "servedAt", label: L(locale, "التاريخ", "Date"), render: (row) => formatDate(row.servedAt, locale) },
          { key: "name", label: L(locale, "الوجبة", "Meal") },
          {
            key: "quantityKg",
            label: L(locale, "الكمية (كجم)", "Quantity (kg)"),
            render: (row) => `${new Intl.NumberFormat(numericLocale(locale), { maximumFractionDigits: 3 }).format(Number(row.quantityKg))} kg`,
          },
          { key: "note", label: L(locale, "ملاحظة", "Note"), render: (row) => row.note ?? "—" },
        ]}
        form={{
          title: L(locale, "وجبة جديدة", "New meal"),
          editTitle: L(locale, "تعديل الوجبة", "Edit meal"),
          endpoint: "/api/meals",
          itemEndpoint: (row) => `/api/meals/${row.id}`,
          itemMethod: "PATCH",
          enabled: canManage,
          initialFromRow: (row) => ({
            servedAt: new Date(row.servedAt).toISOString().slice(0, 10),
            name: row.name,
            quantityKg: String(row.quantityKg),
            note: row.note ?? "",
          }),
          fields: [
            { name: "servedAt", label: L(locale, "التاريخ", "Date"), type: "date", defaultValue: today, required: true },
            { name: "name", label: L(locale, "اسم الوجبة", "Meal name"), type: "text", required: true, placeholder: L(locale, "مثال: الوجبة الأولى", "e.g. First meal") },
            { name: "quantityKg", label: L(locale, "الكمية بالكيلو", "Quantity (kg)"), type: "number", required: true },
            { name: "note", label: L(locale, "ملاحظة", "Note"), type: "textarea" },
          ],
          build: (values) => ({
            servedAt: new Date(`${String(values.servedAt || today)}T12:00:00.000Z`).toISOString(),
            name: String(values.name ?? "").trim(),
            quantityKg: Number(values.quantityKg),
            note: String(values.note ?? "") || null,
          }),
          afterSave: () => setRefresh((value) => value + 1),
        }}
        rowActions={[
          { label: L(locale, "تعديل", "Edit"), kind: "edit", tone: "secondary", requiresManage: true },
          {
            label: L(locale, "حذف", "Delete"),
            kind: "delete",
            tone: "danger",
            requiresManage: true,
            confirm: L(locale, "هل تريد حذف هذه الوجبة؟", "Delete this meal?"),
          },
        ]}
      />
    </div>
  );
}
