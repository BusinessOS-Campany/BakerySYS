"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote, CheckCircle2, CreditCard, Minus, Plus, RefreshCw, Search,
  ShoppingCart, Trash2, Wallet, Wifi, WifiOff,
} from "lucide-react";
import { enqueueSale, listQueuedSales, removeQueuedSale, updateQueuedSale } from "@/lib/offline/db";
import { formatMoney, translate, type Locale } from "@/lib/i18n/dictionary";

type Product = {
  id: string; sku: string; nameAr: string; nameEn: string;
  sellingPrice: string | number; costPrice: string | number;
  taxRate: string | number; minStock: string | number;
};
type Warehouse = { id: string; branchId: string | null; code: string; nameAr: string; nameEn: string };
type Branch = { id: string; nameAr: string; nameEn: string };
type Customer = { id: string; nameAr: string; nameEn: string; phone: string | null; code: string };
type Register = { id: string; branchId: string; code: string; nameAr: string; nameEn: string };
type Session = { id: string; registerId: string; openingBalance: string | number; openedAt: string };

export type PosData = {
  products: Product[];
  warehouses: Warehouse[];
  branches: Branch[];
  customers: Customer[];
  registers: Register[];
  openSession: Session | null;
};

type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "CREDIT";

export function PosScreen({
  locale,
  currency,
  decimalPlaces,
  taxRate,
  taxEnabled,
  defaultBranchId,
  canOpenSession,
  canCloseSession,
  data,
}: {
  locale: Locale;
  currency: string;
  decimalPlaces: number;
  taxRate: number;
  taxEnabled: boolean;
  defaultBranchId: string | null;
  canOpenSession: boolean;
  canCloseSession: boolean;
  data: PosData;
}) {
  const t = (key: string) => translate(locale, key);
  const money = (value: number) => formatMoney(value, locale, currency, decimalPlaces);
  const [branchId, setBranchId] = useState(defaultBranchId ?? "");
  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [paid, setPaid] = useState("");
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState<{ key: string; lastError?: string }[]>([]);
  const [session, setSession] = useState<Session | null>(data.openSession);
  const [registerId, setRegisterId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState("");

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 2000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const branchWarehouses = useMemo(
    () => data.warehouses.filter((w) => !branchId || w.branchId === branchId || w.branchId === null),
    [data.warehouses, branchId],
  );
  const branchRegisters = useMemo(
    () => data.registers.filter((r) => !branchId || r.branchId === branchId),
    [data.registers, branchId],
  );

  useEffect(() => {
    setWarehouseId(branchWarehouses[0]?.id ?? "");
    setRegisterId(branchRegisters[0]?.id ?? "");
  }, [branchWarehouses, branchRegisters]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const refreshQueue = useCallback(async () => {
    try {
      const items = await listQueuedSales();
      setQueued(items.map((i) => ({ key: i.key, lastError: i.lastError })));
    } catch { /* IndexedDB may be unavailable in private browsing */ }
  }, []);

  useEffect(() => { void refreshQueue(); }, [refreshQueue]);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const items = await listQueuedSales();
    if (items.length === 0) { setQueued([]); return; }
    try {
      const response = await fetch("/api/offline/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sales: items.map((i) => ({ key: i.key, payload: i.payload })) }),
      });
      if (!response.ok) throw new Error("sync failed");
      const payload = await response.json();
      for (const result of payload.results ?? []) {
        if (result.ok) await removeQueuedSale(result.key);
        else await updateQueuedSale(result.key, { attempts: 1, lastError: result.error });
      }
      await refreshQueue();
    } catch {
      setOnline(false);
    }
  }, [refreshQueue]);

  useEffect(() => {
    if (online) void syncQueue();
  }, [online, syncQueue]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data.products;
    return data.products.filter((p) =>
      p.nameAr.includes(term) || p.nameEn.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
  }, [data.products, search]);

  const lines = useMemo(() => Object.entries(cart)
    .map(([productId, quantity]) => {
      const product = data.products.find((p) => p.id === productId);
      if (!product || quantity <= 0) return null;
      const rate = Number(product.taxRate) || taxRate;
      const net = Number(product.sellingPrice) * quantity;
      const tax = taxEnabled ? net * rate / 100 : 0;
      return { product, quantity, net, tax, total: net + tax };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line)),
  [cart, data.products, taxEnabled, taxRate]);

  const subtotal = lines.reduce((sum, line) => sum + line.net, 0);
  const taxTotal = lines.reduce((sum, line) => sum + line.tax, 0);
  const total = Math.max(0, subtotal + taxTotal - discount);
  const onAccount = Boolean(customerId);
  const paidNumber = onAccount ? total : Number(paid || 0);
  const remaining = Math.max(0, total - paidNumber);

  function add(productId: string, delta: number) {
    setCart((current) => {
      const next = Math.max(0, (current[productId] ?? 0) + delta);
      const copy = { ...current };
      if (next === 0) delete copy[productId]; else copy[productId] = next;
      return copy;
    });
  }

  async function checkout() {
    setError("");
    setMessage("");
    setInvoice("");
    if (lines.length === 0) { setError(t("pos.cartEmpty")); return; }
    if (!branchId || !warehouseId) { setError(t("common.branch")); return; }
    if (method === "CREDIT" && !customerId) { setError(t("pos.customer")); return; }
    if (paidNumber < total - 0.000001) { setError(`${t("pos.remaining")}: ${money(remaining)}`); return; }

    const key = crypto.randomUUID();
    const payload = {
      branchId, warehouseId,
      customerId: customerId || null,
      cashSessionId: session?.id ?? null,
      lines: lines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        discount: 0,
      })),
      payments: [{ method: onAccount ? "CREDIT" : method, amount: paidNumber }],
      discountAmount: discount,
      idempotencyKey: key,
      notes: online ? undefined : "Queued offline",
    };
    setBusy(true);
    try {
      if (!online) throw new Error("offline");
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.[locale === "ar" ? "messageAr" : "message"] ?? "Sale failed");
      }
      const result = await response.json();
      setInvoice(String(result?.sale?.invoiceNumber ?? ""));
      setMessage(t("pos.saleComplete"));
      setCart({}); setDiscount(0); setPaid(""); setCustomerId("");
    } catch (err) {
      if (!online || (err instanceof Error && err.message === "offline") || (err instanceof TypeError)) {
        await enqueueSale(payload, key);
        await refreshQueue();
        setMessage(t("pos.queued"));
        setCart({}); setDiscount(0); setPaid(""); setCustomerId("");
      } else {
        setError(err instanceof Error ? err.message : t("common.error"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function openRegister() {
    if (!registerId) { setError(t("pos.openRegister")); return; }
    const balance = window.prompt(t("pos.openingBalance"), "0");
    if (balance === null) return;
    setBusy(true);
    try {
      const response = await fetch("/api/cash-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registerId, openingBalance: Number(balance) || 0 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.[locale === "ar" ? "messageAr" : "message"] ?? t("common.error"));
      setSession(payload);
      setMessage(t("pos.openRegister"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally { setBusy(false); }
  }

  async function closeRegister() {
    if (!session) return;
    const amount = window.prompt(t("pos.closingBalance"), String(Math.round(subtotal * 100) / 100));
    if (amount === null) return;
    setBusy(true);
    try {
      const response = await fetch("/api/cash-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, actualClosing: Number(amount) || 0 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.[locale === "ar" ? "messageAr" : "message"] ?? t("common.error"));
      setSession(null);
      setMessage(t("pos.closeRegister"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("pos.title")}</h1>
          <p className="muted mt-1 text-xs">
            {online ? <span className="inline-flex items-center gap-1 text-emerald-600"><Wifi className="h-3 w-3" />{t("pos.online")}</span>
              : <span className="inline-flex items-center gap-1 text-[var(--danger)]"><WifiOff className="h-3 w-3" />{t("pos.offline")}</span>}
            {queued.length > 0 ? ` · ${queued.length} ${t("pos.queued")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.branches.length > 0 ? (
            <select className="input h-9 w-auto text-xs" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {data.branches.map((b) => <option key={b.id} value={b.id}>{locale === "ar" ? b.nameAr : b.nameEn}</option>)}
            </select>
          ) : null}
          <select className="input h-9 w-auto text-xs" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {branchWarehouses.map((w) => <option key={w.id} value={w.id}>{locale === "ar" ? w.nameAr : w.nameEn}</option>)}
          </select>
          {queued.length > 0 ? (
            <button className="btn btn-secondary" disabled={!online || busy} onClick={() => void syncQueue()} type="button">
              <RefreshCw className="h-4 w-4" /> {t("pos.syncQueue")} ({queued.length})
            </button>
          ) : null}
          {canOpenSession && !session ? (
            <button className="btn btn-secondary" disabled={busy || !registerId} onClick={() => void openRegister()} type="button">
              <Wallet className="h-4 w-4" /> {t("pos.openRegister")}
            </button>
          ) : null}
          {canCloseSession && session ? (
            <button className="btn btn-secondary" disabled={busy} onClick={() => void closeRegister()} type="button">
              <Banknote className="h-4 w-4" /> {t("pos.closeRegister")}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {message ? (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" role="status">
          <div className="flex w-full max-w-md items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 shadow-lg">
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{message} {invoice ? `#${invoice}` : ""}</span>
            <button onClick={() => setMessage("")} type="button">×</button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[var(--text-muted)]" />
              <input className="input ps-9" placeholder={t("action.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <span className="muted text-xs">{t("pos.products")}: {filteredProducts.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => {
              return (
                <button
                  key={product.id}
                  className="rounded-xl border border-[var(--border)] p-3 text-start transition hover:border-[var(--primary)] hover:shadow-sm"
                  onClick={() => add(product.id, 1)}
                  type="button"
                >
                  <div className="mb-2 flex h-14 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-2xl">🥐</div>
                  <div className="truncate text-sm font-semibold">{locale === "ar" ? product.nameAr : product.nameEn}</div>
                  <div className="muted mt-0.5 truncate text-[11px]">{product.sku}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <strong className="text-sm text-[var(--primary)]">{money(Number(product.sellingPrice))}</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card flex h-fit flex-col p-4 xl:sticky xl:top-20">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold"><ShoppingCart className="h-4 w-4" />{t("pos.cart")}</h2>
            <span className="muted text-xs">{lines.reduce((s, l) => s + l.quantity, 0)}</span>
          </div>
          <div className="scroll-thin max-h-[45vh] flex-1 space-y-2 overflow-y-auto">
            {lines.length === 0 ? <p className="muted py-10 text-center text-sm">{t("pos.cartEmpty")}</p> : lines.map((line) => (
              <div key={line.product.id} className="rounded-lg border border-[var(--border)] p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{locale === "ar" ? line.product.nameAr : line.product.nameEn}</div>
                    <div className="muted text-[11px]">{money(Number(line.product.sellingPrice))}</div>
                  </div>
                  <button className="text-[var(--danger)]" onClick={() => add(line.product.id, -line.quantity)} type="button"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button className="rounded border border-[var(--border)] p-1" onClick={() => add(line.product.id, -1)} type="button"><Minus className="h-3 w-3" /></button>
                    <span className="w-8 text-center text-xs font-semibold">{line.quantity}</span>
                    <button className="rounded border border-[var(--border)] p-1" onClick={() => add(line.product.id, 1)} type="button"><Plus className="h-3 w-3" /></button>
                  </div>
                  <strong className="text-xs">{money(line.total)}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-sm">
            <div className="flex justify-between"><span className="muted">{t("pos.subtotal")}</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between"><span className="muted">{t("sales.tax")}</span><span>{money(taxTotal)}</span></div>
            <label className="flex items-center justify-between gap-2">
              <span className="muted">{t("pos.discount")}</span>
              <input className="input h-8 w-24 text-end" type="number" min="0" step="any" value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} />
            </label>
            <div className="flex justify-between border-t border-[var(--border)] pt-2 text-base font-bold">
              <span>{t("common.total")}</span><span>{money(total)}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="block text-xs font-medium">
              {t("pos.customer")}
              <select className="input mt-1" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">{t("pos.customerOptional")}</option>
                {data.customers.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.nameAr : c.nameEn}{c.phone ? ` · ${c.phone}` : ""}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium">
              {t("pos.payment")}
              <select className="input mt-1" value={onAccount ? "CREDIT" : method} disabled={onAccount} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {(["CASH", "CARD", "BANK_TRANSFER", "CREDIT"] as const).map((m) => (
                  <option key={m} value={m}>{t(`pos.method.${m}`)}</option>
                ))}
              </select>
            </label>
            {onAccount ? (
              <div className="rounded-lg bg-[var(--surface-muted)] p-2 text-xs text-[var(--primary)]">{t("pos.customerDebt")}</div>
            ) : (
              <label className="block text-xs font-medium">
                {t("pos.paid")}
                <input
                  className="input mt-1"
                  type="number"
                  min="0"
                  step="any"
                  value={paid}
                  placeholder={money(total)}
                  onChange={(e) => setPaid(e.target.value)}
                />
              </label>
            )}
            {!onAccount && remaining > 0 ? <div className="text-xs text-[var(--danger)]">{t("pos.remaining")}: {money(remaining)}</div> : null}
            <button className="btn btn-primary w-full" disabled={busy || lines.length === 0 || !warehouseId} onClick={() => void checkout()} type="button">
              {busy ? t("common.loading") : <><CreditCard className="h-4 w-4" />{t("pos.checkout")}</>}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
