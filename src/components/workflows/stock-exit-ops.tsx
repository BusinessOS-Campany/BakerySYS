"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, LogOut, Package, RefreshCw } from "lucide-react";
import { apiFetch, apiSend, L, numericLocale, type Locale } from "./shared";

type IngredientLot = {
  id: string;
  warehouseId: string;
  ingredientId: string;
  lotNumber: string;
  quantity: string | number;
  unitCost: string | number;
  receivedAt: string;
};

type IngredientOption = { id: string; nameAr: string; nameEn: string; sku: string };
type WarehouseOption = { id: string; nameAr?: string | null; nameEn?: string | null };

type InventoryPayload = {
  ingredientLots: IngredientLot[];
  ingredients: IngredientOption[];
  warehouses: WarehouseOption[];
};

/** Whole numbers show without a trailing ".00"; fractions keep up to 2 decimals. */
function formatAmount(value: number | string, locale: Locale): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(numericLocale(locale), {
    numberingSystem: "latn",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function StockExitPage({
  locale,
  canManage,
  selectedLotId = "",
}: {
  locale: Locale;
  canManage: boolean;
  selectedLotId?: string;
}) {
  const [data, setData] = useState<InventoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lotId, setLotId] = useState(selectedLotId);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<InventoryPayload>("/api/inventory", locale));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { void load(); }, [load]);

  const lots = useMemo(
    () => [...(data?.ingredientLots ?? [])].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
    ),
    [data],
  );

  useEffect(() => {
    if (selectedLotId && lots.some((lot) => lot.id === selectedLotId)) {
      setLotId((current) => current || selectedLotId);
    }
  }, [selectedLotId, lots]);

  function ingredientName(id: string) {
    const item = data?.ingredients.find((entry) => entry.id === id);
    if (!item) return "—";
    return locale === "ar" ? item.nameAr : item.nameEn;
  }

  function warehouseName(id: string) {
    const item = data?.warehouses.find((entry) => entry.id === id);
    if (!item) return L(locale, "مخزن غير معروف", "Unknown warehouse");
    return locale === "ar" ? item.nameAr ?? item.nameEn : item.nameEn ?? item.nameAr;
  }

  const selectedLot = lots.find((lot) => lot.id === lotId) ?? null;
  const amount = Number(quantity);
  const remainingPreview = selectedLot && Number.isFinite(amount) && amount > 0
    ? Math.max(0, Number(selectedLot.quantity) - amount)
    : Number(selectedLot?.quantity ?? 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLot) {
      setError(L(locale, "اختر دفعة للمصروف", "Select a batch to issue"));
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(L(locale, "أدخل كمية صحيحة", "Enter a valid quantity"));
      return;
    }
    if (amount > Number(selectedLot.quantity) + 1e-9) {
      setError(L(locale, "الكمية أكبر من المتاح في الدفعة", "Quantity exceeds the batch balance"));
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiSend<{ remaining: string | number }>(
        `/api/inventory/lots/${selectedLot.id}/exit`,
        "POST",
        { quantity: amount, note: note.trim() || undefined },
        locale,
      );
      setMessage(
        `${L(locale, "تم الصرف", "Stock issued")}: ${formatAmount(amount, locale)} · ${L(locale, "المتبقي", "Remaining")}: ${formatAmount(result.remaining, locale)}`,
      );
      setQuantity("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {L(locale, "المصروف من المخزن", "Stock issued")}
          </h1>
          <p className="muted mt-1 text-sm">
            {L(locale, "صرف كمية من دفعة مخزون مع حفظ سجل الحركة", "Issue a quantity from a stock batch while keeping movement history")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" disabled={loading || saving} onClick={() => void load()} type="button">
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
      {message ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
          <Check className="h-4 w-4" /> {message}
        </div>
      ) : null}

      <section className="card p-4">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <LogOut className="h-4 w-4" /> {L(locale, "صرف من دفعة", "Issue from a batch")}
          </h2>
        </div>
        {!canManage ? (
          <p className="muted mt-2 text-xs">
            {L(locale, "ليست لديك صلاحية الصرف من المخزون.", "You do not have permission to issue stock.")}
          </p>
        ) : null}
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <label className="block text-xs font-medium sm:col-span-2">
            {L(locale, "دفعة المخزون", "Stock batch")}
            <select
              className="input mt-1"
              disabled={loading || saving}
              onChange={(event) => {
                setLotId(event.target.value);
                setQuantity("");
                setError("");
                setMessage("");
              }}
              value={lotId}
            >
              <option value="">{L(locale, "— اختر الدفعة —", "— Select a batch —")}</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {ingredientName(lot.ingredientId)} · {lot.lotNumber} · {formatAmount(lot.quantity, locale)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium">
            {L(locale, "الكمية المصروفة", "Exit quantity")}
            <input
              className="input mt-1"
              disabled={loading || saving || !selectedLot}
              max={Number(selectedLot?.quantity ?? 0)}
              min="0"
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="0"
              step="any"
              type="number"
              value={quantity}
            />
          </label>
          <label className="block text-xs font-medium">
            {L(locale, "ملاحظة (اختياري)", "Note (optional)")}
            <input
              className="input mt-1"
              disabled={loading || saving || !selectedLot}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>

          {selectedLot ? (
            <div className="muted rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs sm:col-span-2">
              <Package className="me-1 inline h-3.5 w-3.5" />
              {ingredientName(selectedLot.ingredientId)} · {selectedLot.lotNumber} · {warehouseName(selectedLot.warehouseId)}
              <span className="mx-2">·</span>
              {L(locale, "المتاح", "Available")}: <strong className="font-semibold">{formatAmount(selectedLot.quantity, locale)}</strong>
              <span className="mx-2">·</span>
              {L(locale, "المتبقي بعد الصرف", "Remaining after exit")}:{" "}
              <strong className="font-semibold">{formatAmount(remainingPreview, locale)}</strong>
            </div>
          ) : null}

          <div className="flex items-end gap-2 sm:col-span-2">
            <button
              className="btn btn-primary"
              disabled={!canManage || saving || loading || !selectedLot}
              type="submit"
            >
              <LogOut className="h-4 w-4" />
              {saving
                ? L(locale, "جارٍ الصرف...", "Issuing...")
                : L(locale, "تأكيد الصرف", "Confirm exit")}
            </button>
            <Link className="btn btn-secondary" href="/inventory">
              {L(locale, "إلغاء", "Cancel")}
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
