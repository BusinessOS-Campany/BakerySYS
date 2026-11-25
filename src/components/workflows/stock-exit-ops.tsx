"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, LogOut, RefreshCw } from "lucide-react";
import { DataPanel, apiFetch, L, type Locale } from "./shared";
import { formatDateTime, formatNumber } from "@/lib/i18n/dictionary";

type MovementRow = {
  id: string;
  createdAt: string;
  ingredientId: string;
  warehouseId: string;
  movementType: string;
  referenceId: string | null;
  quantity: string | number;
  unitCost: string | number;
  note: string | null;
};

type InventoryPayload = {
  ingredients: { id: string; nameAr: string; nameEn: string }[];
  warehouses: { id: string; nameAr?: string | null; nameEn?: string | null }[];
};

type ExitRow = {
  id: string;
  createdAt: string;
  ingredient: string;
  lotNumber: string;
  warehouse: string;
  quantity: number;
  value: number;
  note: string;
};

export function StockExitPage({ locale, timezone }: { locale: Locale; timezone: string }) {
  const [rows, setRows] = useState<ExitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inventory, movements] = await Promise.all([
        apiFetch<InventoryPayload>("/api/inventory", locale),
        apiFetch<{ items?: MovementRow[] }>("/api/inventory/movements?type=RAW", locale),
      ]);
      const ingredientName = (id: string) => {
        const item = inventory.ingredients.find((entry) => entry.id === id);
        if (!item) return "—";
        return locale === "ar" ? item.nameAr : item.nameEn;
      };
      const warehouseName = (id: string) => {
        const item = inventory.warehouses.find((entry) => entry.id === id);
        if (!item) return L(locale, "مخزن غير معروف", "Unknown warehouse");
        const fallback = L(locale, "مخزن غير معروف", "Unknown warehouse");
        return locale === "ar" ? item.nameAr ?? item.nameEn ?? fallback : item.nameEn ?? item.nameAr ?? fallback;
      };
      setRows(
        (movements.items ?? [])
          .filter((row) => row.movementType === "MANUAL_STOCK_EXIT")
          .map((row) => ({
            id: row.id,
            createdAt: row.createdAt,
            ingredient: ingredientName(row.ingredientId),
            lotNumber: row.referenceId ?? "—",
            warehouse: warehouseName(row.warehouseId),
            quantity: Number(row.quantity),
            value: Number(row.quantity) * Number(row.unitCost),
            note: row.note ?? "",
          })),
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { void load(); }, [load]);

  const totalQuantity = useMemo(() => rows.reduce((sum, row) => sum + row.quantity, 0), [rows]);
  const totalValue = useMemo(() => rows.reduce((sum, row) => sum + row.value, 0), [rows]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{L(locale, "المصروف من المخزن", "Stock issued")}</h1>
          <p className="muted mt-1 text-sm">
            {L(locale, "سجل الكميات المصروفة من دفعات المخزون", "Record of quantities issued from stock batches")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" disabled={loading} onClick={() => void load()} type="button">
            <RefreshCw className="h-4 w-4" /> {L(locale, "تحديث", "Refresh")}
          </button>
          <Link className="btn btn-secondary" href="/inventory">
            <ArrowLeft className="h-4 w-4" /> {L(locale, "العودة للمخزون", "Back to inventory")}
          </Link>
        </div>
      </header>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      ) : null}

      <p className="muted rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs">
        <LogOut className="me-1 inline h-3.5 w-3.5" />
        {L(
          locale,
          "لإضافة مصروف جديد، اضغط زر «صرف» على بطاقة الدفعة في صفحة المخزون.",
          "To issue new stock, click «Exit» on a batch card in the Inventory page.",
        )}
      </p>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="muted text-xs">{L(locale, "عدد عمليات الصرف", "Exit operations")}</div>
          <div className="mt-2 text-xl font-bold tabular-nums">{formatNumber(rows.length, locale, 0)}</div>
        </div>
        <div className="card p-4">
          <div className="muted text-xs">{L(locale, "إجمالي الكمية المصروفة", "Total issued quantity")}</div>
          <div className="mt-2 text-xl font-bold tabular-nums text-[var(--primary)]">{formatNumber(totalQuantity, locale, 2)}</div>
        </div>
        <div className="card p-4">
          <div className="muted text-xs">{L(locale, "إجمالي قيمة المصروف", "Total issued value")}</div>
          <div className="mt-2 text-xl font-bold tabular-nums">{formatNumber(totalValue, locale, 2)}</div>
        </div>
      </section>

      <DataPanel<ExitRow>
        canManage={false}
        columns={[
          { key: "createdAt", label: L(locale, "التاريخ والوقت", "Date & time"), render: (row) => formatDateTime(row.createdAt, locale, timezone, false) },
          { key: "ingredient", label: L(locale, "المادة", "Ingredient") },
          { key: "lotNumber", label: L(locale, "الدفعة", "Batch") },
          { key: "warehouse", label: L(locale, "المخزن", "Warehouse") },
          { key: "quantity", label: L(locale, "الكمية", "Quantity"), render: (row) => formatNumber(row.quantity, locale, 2) },
          { key: "value", label: L(locale, "القيمة", "Value"), render: (row) => formatNumber(row.value, locale, 2) },
          { key: "note", label: L(locale, "ملاحظة", "Note"), render: (row) => row.note || "—" },
        ]}
        emptyLabel={L(locale, "لا توجد عمليات صرف بعد.", "No exit operations yet.")}
        locale={locale}
        loading={loading}
        reload={load}
        rows={rows}
        title={L(locale, "سجل المصروف من المخزن", "Stock issue register")}
      />
    </div>
  );
}
