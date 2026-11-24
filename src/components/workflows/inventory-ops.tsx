"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle, Boxes, Check, Layers, LogOut, Package, PackagePlus, Pencil,
  Plus, RefreshCw, Trash2, Wheat, X,
} from "lucide-react";
import { useDialog } from "@/components/ui/dialog";
import { apiFetch, apiSend, L } from "./shared";
import { numericLocale, type Locale } from "@/lib/i18n/dictionary";

type IngredientLot = {
  id: string;
  warehouseId: string;
  ingredientId: string;
  lotNumber: string;
  quantity: string | number;
  initialQty: string | number;
  unitCost: string | number;
  itemState?: string;
  cleaned?: boolean;
  receivedAt: string;
  expiryDate: string | null;
};

type IngredientOption = { id: string; nameAr: string; nameEn: string; sku: string; currentCost: string | number };
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

export function InventoryPage({
  locale,
  canManage,
  selectedIngredientId = "",
}: {
  locale: Locale;
  canManage: boolean;
  selectedIngredientId?: string;
}) {
  const { confirm } = useDialog();
  const [data, setData] = useState<InventoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [ingredientId, setIngredientId] = useState(selectedIngredientId);
  const [quantity, setQuantity] = useState("");
  const [itemState, setItemState] = useState<"GRAINS" | "GROUND">("GRAINS");
  const [cleaned, setCleaned] = useState(false);
  const [saving, setSaving] = useState(false);

  const [exitLot, setExitLot] = useState<IngredientLot | null>(null);
  const [exitQuantity, setExitQuantity] = useState("");
  const [exitNote, setExitNote] = useState("");
  const [exitError, setExitError] = useState("");
  const [exitBusy, setExitBusy] = useState(false);

  const [editLot, setEditLot] = useState<IngredientLot | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editState, setEditState] = useState<"GRAINS" | "GROUND">("GRAINS");
  const [editCleaned, setEditCleaned] = useState(false);
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [deletingLotId, setDeletingLotId] = useState("");

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

  useEffect(() => {
    if (selectedIngredientId && data?.ingredients.some((entry) => entry.id === selectedIngredientId)) {
      setIngredientId((current) => current || selectedIngredientId);
    }
  }, [selectedIngredientId, data]);

  const lots = useMemo(
    () => [...(data?.ingredientLots ?? [])].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
    ),
    [data],
  );
  const totalQuantity = lots.reduce((sum, lot) => sum + Number(lot.quantity), 0);
  const grainsCount = lots.filter((lot) => (lot.itemState ?? "GRAINS") === "GRAINS").length;
  const groundCount = lots.length - grainsCount;
  const cleanedCount = lots.filter((lot) => lot.cleaned).length;
  const selectedProduct = data?.ingredients.find((item) => item.id === ingredientId);
  const unitPrice = Number(selectedProduct?.currentCost ?? 0);
  const enteredQuantity = Number(quantity);
  const previewTotal = Number.isFinite(enteredQuantity) && enteredQuantity > 0
    ? unitPrice * enteredQuantity
    : 0;

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const amount = Number(quantity);
    if (!ingredientId) { setError(L(locale, "اختر اسم المنتج", "Select a product")); return; }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(L(locale, "أدخل كمية صحيحة", "Enter a valid quantity"));
      return;
    }
    setSaving(true);
    try {
      await apiSend("/api/inventory/add-stock", "POST", {
        ingredientId, quantity: amount, itemState, cleaned,
      }, locale);
      setMessage(L(locale, "تمت إضافة الكمية إلى المخزون", "Stock added"));
      setQuantity("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function openExit(lot: IngredientLot) {
    setExitLot(lot);
    setExitQuantity("");
    setExitNote("");
    setExitError("");
    setError("");
    setMessage("");
  }

  async function submitExit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exitLot) return;
    const amount = Number(exitQuantity);
    if (!Number.isFinite(amount) || amount <= 0) {
      setExitError(L(locale, "أدخل كمية صحيحة", "Enter a valid quantity"));
      return;
    }
    if (amount > Number(exitLot.quantity) + 1e-9) {
      setExitError(L(locale, "الكمية أكبر من المتاح في الدفعة", "Quantity exceeds the batch balance"));
      return;
    }
    setExitBusy(true);
    setExitError("");
    try {
      const result = await apiSend<{ remaining: string | number }>(
        `/api/inventory/lots/${exitLot.id}/exit`,
        "POST",
        { quantity: amount, note: exitNote.trim() || undefined },
        locale,
      );
      setExitLot(null);
      setMessage(
        `${L(locale, "تم الصرف", "Exited")}: ${formatAmount(amount, locale)} · ${L(locale, "المتبقي", "Remaining")}: ${formatAmount(result.remaining, locale)}`,
      );
      await load();
    } catch (err) {
      setExitError(err instanceof Error ? err.message : String(err));
    } finally {
      setExitBusy(false);
    }
  }

  function openEdit(lot: IngredientLot) {
    setEditLot(lot);
    setEditQuantity(String(Number(lot.quantity)));
    setEditCost(String(Number(lot.unitCost)));
    setEditState(lot.itemState === "GROUND" ? "GROUND" : "GRAINS");
    setEditCleaned(Boolean(lot.cleaned));
    setEditError("");
    setError("");
    setMessage("");
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editLot) return;
    const amount = Number(editQuantity);
    const cost = Number(editCost);
    if (!Number.isFinite(amount) || amount < 0) {
      setEditError(L(locale, "أدخل كمية صحيحة", "Enter a valid quantity"));
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setEditError(L(locale, "أدخل سعراً صحيحاً", "Enter a valid price"));
      return;
    }
    setEditBusy(true);
    setEditError("");
    try {
      await apiSend(`/api/inventory/lots/${editLot.id}`, "PATCH", {
        quantity: amount,
        unitCost: cost,
        itemState: editState,
        cleaned: editCleaned,
      }, locale);
      setEditLot(null);
      setMessage(L(locale, "تم تعديل الدفعة", "Stock batch updated"));
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditBusy(false);
    }
  }

  async function remove(lot: IngredientLot) {
    const ok = await confirm({
      title: L(locale, "حذف دفعة المخزون", "Delete stock batch"),
      message: L(
        locale,
        `سيتم صرف الكمية المتبقية (${formatAmount(lot.quantity, locale)}) من الدفعة «${lot.lotNumber}» وإزالة البطاقة. سيبقى سجل الحركة محفوظاً.`,
        `The remaining quantity (${formatAmount(lot.quantity, locale)}) of batch "${lot.lotNumber}" will be exited and the card removed. The movement history is kept.`,
      ),
      confirmLabel: L(locale, "حذف", "Delete"),
      tone: "danger",
    });
    if (!ok) return;
    setDeletingLotId(lot.id);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/api/inventory/lots/${lot.id}`, locale, { method: "DELETE" });
      setMessage(L(locale, "تم حذف الدفعة", "Stock batch deleted"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingLotId("");
    }
  }

  const exitPreview = Number(exitQuantity) > 0
    ? Math.max(0, Number(exitLot?.quantity ?? 0) - Number(exitQuantity))
    : Number(exitLot?.quantity ?? 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{L(locale, "المخزون", "Inventory")}</h1>
          <p className="muted mt-1 text-sm">
            {L(locale, "دفعات المواد الخام وبطاقاتها", "Raw material batches and their cards")}
          </p>
        </div>
        <button className="btn btn-secondary" disabled={loading} onClick={() => void load()} type="button">
          <RefreshCw className="h-4 w-4" /> {L(locale, "تحديث", "Refresh")}
        </button>
      </header>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
          {message}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={Boxes}
          label={L(locale, "إجمالي الكمية", "Total quantity")}
          value={formatAmount(totalQuantity, locale)}
        />
        <SummaryCard
          icon={Layers}
          label={L(locale, "عدد الدفعات", "Batches")}
          value={formatAmount(lots.length, locale)}
        />
        <SummaryCard
          icon={Wheat}
          label={L(locale, "حبوب / مطحون", "Grains / Ground")}
          value={`${formatAmount(grainsCount, locale)} / ${formatAmount(groundCount, locale)}`}
        />
        <SummaryCard
          icon={Check}
          label={L(locale, "تم التنقيه", "Cleaned")}
          value={formatAmount(cleanedCount, locale)}
        />
      </section>

      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Plus className="h-4 w-4" /> {L(locale, "إضافة إلى المخزون", "Add to stock")}
          </h2>
          <Link className="text-xs text-[var(--primary)] hover:underline" href="/stock-products">
            {L(locale, "+ إضافة منتج جديد", "+ Add new product")}
          </Link>
        </div>
        {!canManage ? (
          <p className="muted mt-2 text-xs">
            {L(locale, "ليست لديك صلاحية إضافة مخزون.", "You do not have permission to add stock.")}
          </p>
        ) : null}
        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]" onSubmit={(event) => void submit(event)}>
          <label className="block text-xs font-medium">
            {L(locale, "اسم المنتج", "Product name")}
            <select className="input mt-1" onChange={(e) => setIngredientId(e.target.value)} value={ingredientId}>
              <option value="">{L(locale, "— اختر المنتج —", "— Select product —")}</option>
              {(data?.ingredients ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {locale === "ar" ? item.nameAr : item.nameEn} · {item.sku}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            {L(locale, "الكمية", "Quantity")}
            <input
              className="input mt-1"
              min="0"
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              step="any"
              type="number"
              value={quantity}
            />
          </label>
          <label className="block text-xs font-medium">
            {L(locale, "حالة المنتج", "Product state")}
            <select
              className="input mt-1"
              onChange={(e) => setItemState(e.target.value as "GRAINS" | "GROUND")}
              value={itemState}
            >
              <option value="GRAINS">{L(locale, "حبوب", "Grains")}</option>
              <option value="GROUND">{L(locale, "مطحون", "Ground")}</option>
            </select>
          </label>
          <div className="text-xs font-medium">
            {L(locale, "التنقيه", "Cleaning")}
            <label className="mt-1 flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm">
              <input
                checked={cleaned}
                className="h-4 w-4 accent-[var(--primary)]"
                onChange={(e) => setCleaned(e.target.checked)}
                type="checkbox"
              />
              {L(locale, "تم التنقيه", "Cleaned")}
            </label>
          </div>
          <button
            className="btn btn-primary h-10 self-end"
            disabled={!canManage || saving || loading}
            type="submit"
          >
            <Plus className="h-4 w-4" />
            {saving ? L(locale, "جارٍ الإضافة...", "Adding...") : L(locale, "إضافة للمخزون", "Add to stock")}
          </button>
        </form>
        {selectedProduct ? (
          <p className="muted mt-3 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs">
            {L(locale, "سعر الوحدة", "Unit price")}: {formatAmount(unitPrice, locale)}
            <span className="mx-2">·</span>
            {L(locale, "الإجمالي", "Total")}:{" "}
            <strong className="font-semibold">{formatAmount(previewTotal, locale)}</strong>
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{L(locale, "بطاقات المخزون", "Stock cards")}</h2>
          <span className="muted text-xs">{formatAmount(lots.length, locale)}</span>
        </div>
        {loading ? (
          <p className="muted card p-8 text-center text-sm">{L(locale, "جارٍ التحميل...", "Loading...")}</p>
        ) : lots.length === 0 ? (
          <p className="muted card p-8 text-center text-sm">
            {L(locale, "لا توجد دفعات مخزون بعد.", "No stock batches yet.")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lots.map((lot) => {
              const isGround = (lot.itemState ?? "GRAINS") === "GROUND";
              const lineValue = Number(lot.quantity) * Number(lot.unitCost);
              const busy = deletingLotId === lot.id;
              return (
                <article className="card flex flex-col gap-3 p-4" key={lot.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)]">
                        <Package className="h-4 w-4 text-[var(--primary)]" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{ingredientName(lot.ingredientId)}</div>
                        <div className="muted truncate text-[11px]">{lot.lotNumber}</div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium">
                      {isGround ? L(locale, "مطحون", "Ground") : L(locale, "حبوب", "Grains")}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="muted text-[11px]">{L(locale, "الكمية", "Quantity")}</div>
                      <div className="mt-0.5 text-xl font-bold tabular-nums">{formatAmount(lot.quantity, locale)}</div>
                    </div>
                    <div className="text-end">
                      <div className="muted text-[11px]">{L(locale, "القيمة", "Value")}</div>
                      <div className="mt-0.5 text-xl font-bold tabular-nums text-[var(--primary)]">
                        {formatAmount(lineValue, locale)}
                      </div>
                      <div className="muted text-[10px] tabular-nums">
                        {L(locale, "سعر الوحدة", "Unit price")}: {formatAmount(lot.unitCost, locale)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2 text-[11px]">
                    <span className={lot.cleaned
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700"
                      : "rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700"}
                    >
                      {lot.cleaned ? L(locale, "تم التنقيه", "Cleaned") : L(locale, "غير منقي", "Not cleaned")}
                    </span>
                    <span className="muted truncate">{warehouseName(lot.warehouseId)}</span>
                    <span className="muted ms-auto">
                      {new Date(lot.receivedAt).toLocaleDateString(locale === "ar" ? "ar-YE-u-nu-latn" : "en-US")}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 border-t border-[var(--border)] pt-2">
                    <button
                      className="btn text-[11px]"
                      disabled={!canManage || busy}
                      onClick={() => openExit(lot)}
                      type="button"
                    >
                      <LogOut className="h-3 w-3" /> {L(locale, "صرف", "Exit")}
                    </button>
                    <button
                      className="btn text-[11px]"
                      disabled={!canManage || busy}
                      onClick={() => openEdit(lot)}
                      type="button"
                    >
                      <Pencil className="h-3 w-3" /> {L(locale, "تعديل", "Edit")}
                    </button>
                    <button
                      className="btn btn-danger text-[11px]"
                      disabled={!canManage || busy}
                      onClick={() => void remove(lot)}
                      type="button"
                    >
                      <Trash2 className="h-3 w-3" />
                      {busy ? "..." : L(locale, "حذف", "Delete")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {exitLot ? (
        <div
          className="arap-modal-overlay"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !exitBusy) setExitLot(null); }}
        >
          <form
            aria-labelledby="lot-exit-title"
            aria-modal="true"
            className="arap-modal"
            dir={locale === "ar" ? "rtl" : "ltr"}
            onSubmit={(event) => void submitExit(event)}
            role="dialog"
          >
            <div className="arap-modal-header">
              <h2 className="arap-modal-title" id="lot-exit-title">
                {L(locale, "صرف من الدفعة", "Exit from batch")}
              </h2>
              <button
                aria-label={L(locale, "إغلاق", "Close")}
                className="arap-modal-close"
                disabled={exitBusy}
                onClick={() => setExitLot(null)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="arap-modal-body scroll-thin">
              {exitError ? <p className="arap-modal-error">{exitError}</p> : null}
              <p className="muted rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs">
                {exitLot.lotNumber} · {L(locale, "المتاح", "Available")}:{" "}
                <strong className="font-semibold">{formatAmount(exitLot.quantity, locale)}</strong>
              </p>
              <label className="arap-modal-field" htmlFor="lot-exit-quantity">
                <span className="arap-modal-label">{L(locale, "الكمية المصروفة", "Exit quantity")}</span>
                <input
                  autoFocus
                  className="arap-modal-input"
                  id="lot-exit-quantity"
                  max={Number(exitLot.quantity)}
                  min="0"
                  onChange={(event) => setExitQuantity(event.target.value)}
                  step="any"
                  type="number"
                  value={exitQuantity}
                />
              </label>
              <label className="arap-modal-field" htmlFor="lot-exit-note">
                <span className="arap-modal-label">{L(locale, "ملاحظة (اختياري)", "Note (optional)")}</span>
                <input
                  className="arap-modal-input"
                  id="lot-exit-note"
                  maxLength={300}
                  onChange={(event) => setExitNote(event.target.value)}
                  value={exitNote}
                />
              </label>
              <p className="muted text-xs">
                {L(locale, "المتبقي بعد الصرف", "Remaining after exit")}:{" "}
                <strong className="font-semibold">{formatAmount(exitPreview, locale)}</strong>
              </p>
            </div>
            <div className="arap-modal-footer">
              <button className="arap-modal-save" disabled={exitBusy} type="submit">
                {exitBusy
                  ? L(locale, "جارٍ الصرف...", "Exiting...")
                  : L(locale, "تأكيد الصرف", "Confirm exit")}
              </button>
              <button className="arap-modal-cancel" disabled={exitBusy} onClick={() => setExitLot(null)} type="button">
                {L(locale, "إلغاء", "Cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editLot ? (
        <div
          className="arap-modal-overlay"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !editBusy) setEditLot(null); }}
        >
          <form
            aria-labelledby="lot-edit-title"
            aria-modal="true"
            className="arap-modal"
            dir={locale === "ar" ? "rtl" : "ltr"}
            onSubmit={(event) => void submitEdit(event)}
            role="dialog"
          >
            <div className="arap-modal-header">
              <h2 className="arap-modal-title" id="lot-edit-title">
                {L(locale, "تعديل الدفعة", "Edit batch")}
              </h2>
              <button
                aria-label={L(locale, "إغلاق", "Close")}
                className="arap-modal-close"
                disabled={editBusy}
                onClick={() => setEditLot(null)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="arap-modal-body scroll-thin">
              {editError ? <p className="arap-modal-error">{editError}</p> : null}
              <p className="muted text-xs">{editLot.lotNumber}</p>
              <label className="arap-modal-field" htmlFor="lot-edit-quantity">
                <span className="arap-modal-label">{L(locale, "الكمية", "Quantity")}</span>
                <input
                  autoFocus
                  className="arap-modal-input"
                  id="lot-edit-quantity"
                  min="0"
                  onChange={(event) => setEditQuantity(event.target.value)}
                  step="any"
                  type="number"
                  value={editQuantity}
                />
              </label>
              <label className="arap-modal-field" htmlFor="lot-edit-cost">
                <span className="arap-modal-label">{L(locale, "سعر الوحدة", "Unit price")}</span>
                <input
                  className="arap-modal-input"
                  id="lot-edit-cost"
                  min="0"
                  onChange={(event) => setEditCost(event.target.value)}
                  step="any"
                  type="number"
                  value={editCost}
                />
              </label>
              <label className="arap-modal-field" htmlFor="lot-edit-state">
                <span className="arap-modal-label">{L(locale, "حالة المنتج", "Product state")}</span>
                <select
                  className="arap-modal-input"
                  id="lot-edit-state"
                  onChange={(event) => setEditState(event.target.value as "GRAINS" | "GROUND")}
                  value={editState}
                >
                  <option value="GRAINS">{L(locale, "حبوب", "Grains")}</option>
                  <option value="GROUND">{L(locale, "مطحون", "Ground")}</option>
                </select>
              </label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm">
                <input
                  checked={editCleaned}
                  className="h-4 w-4 accent-[var(--primary)]"
                  onChange={(event) => setEditCleaned(event.target.checked)}
                  type="checkbox"
                />
                {L(locale, "تم التنقيه", "Cleaned")}
              </label>
            </div>
            <div className="arap-modal-footer">
              <button className="arap-modal-save" disabled={editBusy} type="submit">
                {editBusy ? L(locale, "جارٍ الحفظ...", "Saving...") : L(locale, "حفظ", "Save")}
              </button>
              <button className="arap-modal-cancel" disabled={editBusy} onClick={() => setEditLot(null)} type="button">
                {L(locale, "إلغاء", "Cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="card flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="muted truncate text-xs">{label}</div>
        <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      </div>
      <Icon className="h-5 w-5 shrink-0 text-[var(--primary)]" />
    </div>
  );
}
