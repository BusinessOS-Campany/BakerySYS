"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, Boxes, Check, PackagePlus, RefreshCw } from "lucide-react";
import { apiFetch, apiSend, L } from "./shared";
import { formatNumber, type Locale } from "@/lib/i18n/dictionary";

type UnitOption = { id: string; code: string; nameAr: string; nameEn: string };
type StockProduct = {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  currentCost: string | number;
  minStock: string | number;
  active: boolean;
};
type Payload = { items: StockProduct[]; units: UnitOption[] };

export function StockProductsPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [sku, setSku] = useState("");
  const [unitId, setUnitId] = useState("");
  const [currentCost, setCurrentCost] = useState("");
  const [minStock, setMinStock] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<StockProduct | null>(null);

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreated(null);
    if (!nameAr.trim()) {
      setError(L(locale, "أدخل اسم المنتج", "Enter the product name"));
      return;
    }
    setSaving(true);
    try {
      const product = await apiSend<StockProduct>("/api/stock-products", "POST", {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        sku: sku.trim(),
        unitId: unitId || undefined,
        currentCost: Number(currentCost) || 0,
        minStock: Number(minStock) || 0,
      }, locale);
      setCreated(product);
      setNameAr("");
      setNameEn("");
      setSku("");
      setCurrentCost("");
      setMinStock("");
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
      {created ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              {L(locale, "تمت إضافة المنتج:", "Product added:")} {locale === "ar" ? created.nameAr : created.nameEn}
            </span>
            <Link className="btn btn-primary text-xs" href={`/inventory?ingredient=${encodeURIComponent(created.id)}`}>
              {L(locale, "إضافة للمخزون", "Add to stock")}
            </Link>
          </div>
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
        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => void submit(event)}>
          <label className="block text-xs font-medium">
            {L(locale, "اسم المنتج (عربي) *", "Product name (Arabic) *")}
            <input
              className="input mt-1"
              maxLength={120}
              onChange={(event) => setNameAr(event.target.value)}
              required
              value={nameAr}
            />
          </label>
          <label className="block text-xs font-medium">
            {L(locale, "الاسم (إنجليزي)", "Name (English)")}
            <input
              className="input mt-1"
              maxLength={120}
              onChange={(event) => setNameEn(event.target.value)}
              value={nameEn}
            />
          </label>
          <label className="block text-xs font-medium">
            {L(locale, "رمز المنتج (اختياري)", "Product code (optional)")}
            <input
              className="input mt-1"
              maxLength={60}
              onChange={(event) => setSku(event.target.value)}
              placeholder={L(locale, "يُولَّد تلقائياً", "Generated automatically")}
              value={sku}
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
            {L(locale, "التكلفة الحالية", "Current cost")}
            <input
              className="input mt-1"
              min="0"
              onChange={(event) => setCurrentCost(event.target.value)}
              step="any"
              type="number"
              value={currentCost}
            />
          </label>
          <label className="block text-xs font-medium">
            {L(locale, "الحد الأدنى للمخزون", "Minimum stock")}
            <input
              className="input mt-1"
              min="0"
              onChange={(event) => setMinStock(event.target.value)}
              step="any"
              type="number"
              value={minStock}
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
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
                    <div className="truncate text-sm font-semibold">
                      {locale === "ar" ? item.nameAr : item.nameEn}
                    </div>
                    <div className="muted truncate text-[11px]">{item.sku}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${item.active
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"}`}
                  >
                    {item.active ? L(locale, "نشط", "Active") : L(locale, "غير نشط", "Inactive")}
                  </span>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-2 text-[11px]">
                  <span className="muted">
                    {L(locale, "التكلفة", "Cost")}: {formatNumber(item.currentCost, locale)}
                  </span>
                  <Link
                    className="text-[var(--primary)] hover:underline"
                    href={`/inventory?ingredient=${encodeURIComponent(item.id)}`}
                  >
                    {L(locale, "إضافة للمخزون", "Add to stock")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
