"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, Boxes, Check, PackagePlus, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { useDialog } from "@/components/ui/dialog";
import { apiFetch, apiSend, L } from "./shared";
import { formatNumber, type Locale } from "@/lib/i18n/dictionary";

type UnitOption = { id: string; code: string; nameAr: string; nameEn: string };
type StockProduct = {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  baseUnitId: string;
  currentCost: string | number;
  minStock: string | number;
  active: boolean;
};
type Payload = { items: StockProduct[]; units: UnitOption[] };

export function StockProductsPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const { confirm } = useDialog();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [unitId, setUnitId] = useState("");
  const [currentCost, setCurrentCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StockProduct | null>(null);
  const [editNameAr, setEditNameAr] = useState("");
  const [editUnitId, setEditUnitId] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiFetch<Payload>("/api/stock-products", locale);
      setData(payload);
      setUnitId((current) => current || payload.units.find((unit) => unit.code === "kg")?.id || payload.units[0]?.id || "");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { void load(); }, [load]);

  function unitName(id: string) {
    const unit = data?.units.find((entry) => entry.id === id);
    if (!unit) return "—";
    return locale === "ar" ? unit.nameAr : unit.nameEn;
  }

  function productName(item: StockProduct) {
    return locale === "ar" ? item.nameAr : item.nameEn || item.nameAr;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!nameAr.trim()) {
      setError(L(locale, "أدخل اسم المنتج", "Enter the product name"));
      return;
    }
    setSaving(true);
    try {
      const product = await apiSend<StockProduct>("/api/stock-products", "POST", {
        nameAr: nameAr.trim(),
        unitId: unitId || undefined,
        currentCost: Number(currentCost) || 0,
      }, locale);
      setNotice(`${L(locale, "تمت إضافة المنتج:", "Product added:")} ${productName(product)}`);
      setNameAr("");
      setCurrentCost("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item: StockProduct) {
    setEditing(item);
    setEditNameAr(item.nameAr);
    setEditUnitId(item.baseUnitId || unitId);
    setEditCost(String(Number(item.currentCost)));
    setEditError("");
    setError("");
    setNotice("");
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setEditError("");
    if (!editNameAr.trim()) {
      setEditError(L(locale, "أدخل اسم المنتج", "Enter the product name"));
      return;
    }
    setEditBusy(true);
    try {
      await apiSend(`/api/stock-products/${editing.id}`, "PATCH", {
        nameAr: editNameAr.trim(),
        unitId: editUnitId,
        currentCost: Number(editCost) || 0,
      }, locale);
      setEditing(null);
      setNotice(L(locale, "تم تعديل المنتج", "Product updated"));
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditBusy(false);
    }
  }

  async function remove(item: StockProduct) {
    const ok = await confirm({
      title: L(locale, "حذف المنتج", "Delete product"),
      message: L(
        locale,
        `هل تريد حذف «${item.nameAr}»؟ إذا كان المنتج مستخدماً في المخزون فسيتم إلغاء تفعيله فقط.`,
        `Delete "${productName(item)}"? If it is already used in stock, it will only be deactivated.`,
      ),
      confirmLabel: L(locale, "حذف", "Delete"),
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/stock-products/${item.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.[locale === "ar" ? "messageAr" : "message"] ?? L(locale, "تعذّر الحذف", "Delete failed"));
      }
      setNotice(payload.deactivated
        ? L(locale, "المنتج مستخدم في المخزون، تم إلغاء تفعيله", "Product is used in stock, so it was deactivated")
        : L(locale, "تم حذف المنتج", "Product deleted"));
      if (editing?.id === item.id) setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{L(locale, "منتجات المخزون", "Stock products")}</h1>
          <p className="muted mt-1 text-sm">
            {L(locale, "أضف مادة خام جديدة ثم اخترها من صفحة المخزون", "Add a new raw material, then select it from Inventory")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-secondary" href="/inventory">
            <Boxes className="h-4 w-4" /> {L(locale, "المخزون", "Inventory")}
          </Link>
          <button className="btn btn-secondary" disabled={loading} onClick={() => void load()} type="button">
            <RefreshCw className="h-4 w-4" /> {L(locale, "تحديث", "Refresh")}
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      ) : null}
      {notice ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
          <Check className="h-4 w-4" /> {notice}
        </div>
      ) : null}

      <section className="card p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <PackagePlus className="h-4 w-4" /> {L(locale, "إضافة منتج جديد", "Add a new product")}
        </h2>
        {!canManage ? (
          <p className="muted mt-2 text-xs">
            {L(locale, "ليست لديك صلاحية إضافة المنتجات.", "You do not have permission to add products.")}
          </p>
        ) : null}
        <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(event) => void submit(event)}>
          <label className="block text-xs font-medium">
            {L(locale, "اسم المنتج *", "Product name *")}
            <input
              className="input mt-1"
              maxLength={120}
              onChange={(event) => setNameAr(event.target.value)}
              required
              value={nameAr}
            />
          </label>
          <label className="block text-xs font-medium">
            {L(locale, "وحدة القياس", "Unit of measure")}
            <select className="input mt-1" onChange={(event) => setUnitId(event.target.value)} value={unitId}>
              {(data?.units ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {locale === "ar" ? unit.nameAr : unit.nameEn} · {unit.code}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            {L(locale, "السعر", "Price")}
            <input
              className="input mt-1"
              min="0"
              onChange={(event) => setCurrentCost(event.target.value)}
              placeholder="0"
              step="any"
              type="number"
              value={currentCost}
            />
          </label>
          <div className="sm:col-span-3">
            <button className="btn btn-primary" disabled={!canManage || saving || loading} type="submit">
              <PackagePlus className="h-4 w-4" />
              {saving ? L(locale, "جارٍ الإضافة...", "Adding...") : L(locale, "إضافة المنتج", "Add product")}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{L(locale, "المنتجات المتاحة", "Available products")}</h2>
          <span className="muted text-xs">{formatNumber(data?.items.length ?? 0, locale, 0)}</span>
        </div>
        {loading ? (
          <p className="muted card p-8 text-center text-sm">{L(locale, "جارٍ التحميل...", "Loading...")}</p>
        ) : !data?.items.length ? (
          <p className="muted card p-8 text-center text-sm">
            {L(locale, "لا توجد منتجات بعد.", "No products yet.")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((item) => (
              <article className="card flex flex-col gap-2 p-4" key={item.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{productName(item)}</div>
                    <div className="muted truncate text-[11px]">{item.sku}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    {L(locale, "نشط", "Active")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="muted truncate">{unitName(item.baseUnitId)}</span>
                  <span className="font-semibold tabular-nums">{formatNumber(item.currentCost, locale)}</span>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
                  <Link
                    className="text-[11px] text-[var(--primary)] hover:underline"
                    href={`/inventory?ingredient=${encodeURIComponent(item.id)}`}
                  >
                    {L(locale, "إضافة للمخزون", "Add to stock")}
                  </Link>
                  <span className="flex shrink-0 gap-1">
                    <button
                      className="btn text-[11px]"
                      disabled={deletingId === item.id}
                      onClick={() => openEdit(item)}
                      type="button"
                    >
                      <Pencil className="h-3 w-3" /> {L(locale, "تعديل", "Edit")}
                    </button>
                    <button
                      className="btn btn-danger text-[11px]"
                      disabled={deletingId === item.id}
                      onClick={() => void remove(item)}
                      type="button"
                    >
                      <Trash2 className="h-3 w-3" />
                      {deletingId === item.id ? L(locale, "...", "...") : L(locale, "حذف", "Delete")}
                    </button>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editing ? (
        <div
          className="arap-modal-overlay"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !editBusy) setEditing(null); }}
        >
          <form
            aria-labelledby="stock-edit-title"
            aria-modal="true"
            className="arap-modal"
            dir={locale === "ar" ? "rtl" : "ltr"}
            onSubmit={(event) => void submitEdit(event)}
            role="dialog"
          >
            <div className="arap-modal-header">
              <h2 className="arap-modal-title" id="stock-edit-title">
                {L(locale, "تعديل المنتج", "Edit product")}
              </h2>
              <button
                aria-label={L(locale, "إغلاق", "Close")}
                className="arap-modal-close"
                disabled={editBusy}
                onClick={() => setEditing(null)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="arap-modal-body scroll-thin">
              {editError ? <p className="arap-modal-error">{editError}</p> : null}
              <label className="arap-modal-field" htmlFor="stock-edit-name">
                <span className="arap-modal-label">{L(locale, "اسم المنتج", "Product name")}</span>
                <input
                  autoFocus
                  className="arap-modal-input"
                  id="stock-edit-name"
                  maxLength={120}
                  onChange={(event) => setEditNameAr(event.target.value)}
                  value={editNameAr}
                />
              </label>
              <label className="arap-modal-field" htmlFor="stock-edit-unit">
                <span className="arap-modal-label">{L(locale, "وحدة القياس", "Unit of measure")}</span>
                <select
                  className="arap-modal-input"
                  id="stock-edit-unit"
                  onChange={(event) => setEditUnitId(event.target.value)}
                  value={editUnitId}
                >
                  {(data?.units ?? []).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {locale === "ar" ? unit.nameAr : unit.nameEn} · {unit.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="arap-modal-field" htmlFor="stock-edit-price">
                <span className="arap-modal-label">{L(locale, "السعر", "Price")}</span>
                <input
                  className="arap-modal-input"
                  id="stock-edit-price"
                  min="0"
                  onChange={(event) => setEditCost(event.target.value)}
                  step="any"
                  type="number"
                  value={editCost}
                />
              </label>
            </div>
            <div className="arap-modal-footer">
              <button className="arap-modal-save" disabled={editBusy} type="submit">
                {editBusy ? L(locale, "جارٍ الحفظ...", "Saving...") : L(locale, "حفظ", "Save")}
              </button>
              <button className="arap-modal-cancel" disabled={editBusy} onClick={() => setEditing(null)} type="button">
                {L(locale, "إلغاء", "Cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
