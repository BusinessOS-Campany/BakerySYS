"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote, CheckCircle2, CreditCard, Minus, Plus, RefreshCw, Search,
  ShoppingCart, Trash2, Wallet, Wifi, WifiOff, X,
} from "lucide-react";
import { useDialog } from "@/components/ui/dialog";
import { SaleEditDialog } from "@/components/sales/sale-edit-dialog";
import { SaleSuccessDialog, type SaleReceipt } from "@/components/pos/sale-success-dialog";
import { enqueueSale, listQueuedSales, removeQueuedSale, updateQueuedSale } from "@/lib/offline/db";
import { formatMoney, formatNumber, translate, type Locale } from "@/lib/i18n/dictionary";

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
type CashMovement = {
  id: string;
  kind: string;
  amount: string | number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  saleId: string | null;
  saleStatus: string | null;
  saleRefundedAmount: string | number;
};

export type SessionSummary = {
  openingBalance: number;
  expectedCash: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  saleCount: number;
  cashInCount: number;
  cashOutCount: number;
};

export type PosData = {
  products: Product[];
  warehouses: Warehouse[];
  branches: Branch[];
  customers: Customer[];
  registers: Register[];
  openSession: Session | null;
  summary: SessionSummary | null;
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
  tenantName,
  cashierName,
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
  tenantName: string;
  cashierName: string;
  data: PosData;
}) {
  const { prompt, confirm } = useDialog();
  const t = (key: string) => translate(locale, key);
  const money = (value: number) => formatMoney(value, locale, currency, decimalPlaces);
  const branchId = defaultBranchId ?? "";
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
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [cashOutReason, setCashOutReason] = useState("");
  const [cashOutError, setCashOutError] = useState("");
  const [cashOutBusy, setCashOutBusy] = useState(false);
  const [editingCashOut, setEditingCashOut] = useState<CashMovement | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(data.summary);
  const [editingSaleId, setEditingSaleId] = useState("");

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

  const refreshCashMovements = useCallback(async () => {
    if (!session) { setCashMovements([]); return; }
    try {
      const response = await fetch(`/api/cash-movements?sessionId=${encodeURIComponent(session.id)}`);
      if (!response.ok) return;
      const payload = await response.json();
      setCashMovements((payload.items ?? []) as CashMovement[]);
    } catch { /* keep the last known movements */ }
  }, [session]);

  useEffect(() => { void refreshCashMovements(); }, [refreshCashMovements]);

  const refreshSummary = useCallback(async () => {
    if (!session) { setSummary(null); return; }
    try {
      const response = await fetch(`/api/pos/summary?sessionId=${encodeURIComponent(session.id)}`);
      if (!response.ok) return;
      const payload = await response.json();
      setSummary((payload?.summary ?? null) as SessionSummary | null);
    } catch { /* keep the last known summary */ }
  }, [session]);

  useEffect(() => { void refreshSummary(); }, [refreshSummary]);

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
    setReceipt(null);
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
      const sale = result?.sale ?? {};
      const selectedCustomer = data.customers.find((c) => c.id === customerId);
      setReceipt({
        invoiceNumber: String(sale.invoiceNumber ?? ""),
        invoiceDate: String(sale.invoiceDate ?? new Date().toISOString()),
        customer: selectedCustomer
          ? (locale === "ar" ? selectedCustomer.nameAr : selectedCustomer.nameEn)
          : t("pos.customerOptional"),
        paymentMethod: t(`pos.method.${onAccount ? "CREDIT" : method}`),
        lines: lines.map((line) => ({
          name: locale === "ar" ? line.product.nameAr : line.product.nameEn,
          quantity: line.quantity,
          unitPrice: Number(line.product.sellingPrice),
          amount: line.net,
        })),
        subtotal: Number(sale.subtotal ?? subtotal),
        discount: Number(sale.discountAmount ?? discount),
        tax: Number(sale.taxAmount ?? taxTotal),
        total: Number(sale.total ?? total),
        paid: Number(sale.paidAmount ?? paidNumber),
      });
      setCart({}); setDiscount(0); setPaid(""); setCustomerId("");
      void refreshCashMovements();
      void refreshSummary();
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

  function startNewSale() {
    setReceipt(null);
    setCart({});
    setDiscount(0);
    setPaid("");
    setCustomerId("");
    setMessage("");
    setError("");
  }

  async function openRegister() {
    if (!registerId) { setError(t("pos.openRegister")); return; }
    const balance = await prompt({ message: t("pos.openingBalance"), defaultValue: "0", inputType: "number" });
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
    const amount = await prompt({
      message: t("pos.closingBalance"),
      defaultValue: String(Math.round(subtotal * 100) / 100),
      inputType: "number",
    });
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

  function openCashOutDialog() {
    setCashOutAmount("");
    setCashOutReason("");
    setCashOutError("");
    setError("");
    setCashOutOpen(true);
  }

  async function submitCashOut() {
    setCashOutError("");
    if (!session) { setCashOutError(t("pos.cashOutNoSession")); return; }
    const amount = Number(cashOutAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setCashOutError(t("pos.cashOutInvalidAmount")); return; }
    setCashOutBusy(true);
    try {
      const response = await fetch("/api/cash-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, amount, reason: cashOutReason.trim() || undefined }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.[locale === "ar" ? "messageAr" : "message"] ?? t("common.error"));
      }
      setCashOutOpen(false);
      setMessage(t("pos.cashOutSuccess"));
      await refreshCashMovements();
      await refreshSummary();
    } catch (err) {
      setCashOutError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setCashOutBusy(false);
    }
  }

  function openEditCashOut(movement: CashMovement) {
    setEditingCashOut(movement);
    setEditAmount(String(Number(movement.amount)));
    setEditReason(movement.reason ?? "");
    setEditError("");
    setError("");
  }

  async function submitEditCashOut() {
    if (!editingCashOut) return;
    setEditError("");
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setEditError(t("pos.cashOutInvalidAmount")); return; }
    setEditBusy(true);
    try {
      const response = await fetch(`/api/cash-movements/${editingCashOut.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason: editReason.trim() || null }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.[locale === "ar" ? "messageAr" : "message"] ?? t("common.error"));
      }
      setEditingCashOut(null);
      setMessage(t("pos.cashOutUpdated"));
      await refreshCashMovements();
      await refreshSummary();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteCashOut(movement: CashMovement) {
    const ok = await confirm({
      title: t("action.delete"),
      message: t("pos.deleteCashOutConfirm"),
      confirmLabel: t("action.delete"),
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/cash-movements/${movement.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.[locale === "ar" ? "messageAr" : "message"] ?? t("common.error"));
      }
      setMessage(t("pos.cashOutDeleted"));
      await refreshCashMovements();
      await refreshSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function voidSale(movement: CashMovement) {
    if (!movement.saleId) return;
    const ok = await confirm({
      title: t("pos.voidSale"),
      message: `${t("pos.voidConfirm")}\n${movement.reference ?? ""}`,
      confirmLabel: t("pos.voidSale"),
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/sales/${movement.saleId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.[locale === "ar" ? "messageAr" : "message"] ?? t("common.error"));
      setMessage(t("pos.saleCancelled"));
      await refreshCashMovements();
      await refreshSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
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
            <button className="btn btn-secondary" disabled={busy || !online} onClick={openCashOutDialog} type="button">
              <Minus className="h-4 w-4" /> {t("pos.cashOut")}
            </button>
          ) : null}
          {canCloseSession && session ? (
            <button className="btn btn-secondary" disabled={busy} onClick={() => void closeRegister()} type="button">
              <Banknote className="h-4 w-4" /> {t("pos.closeRegister")}
            </button>
          ) : null}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="muted text-xs">{t("pos.summary.cash")}</span>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums">{money(summary?.expectedCash ?? 0)}</div>
          <div className="muted mt-1 text-[11px]">{t("pos.openingBalance")}: {money(summary?.openingBalance ?? 0)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="muted text-xs">{t("pos.summary.expenses")}</span>
            <Minus className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums">{formatNumber(summary?.cashOutCount ?? 0, locale, 0)}</div>
          <div className="muted mt-1 text-[11px]">{money(summary?.cashOut ?? 0)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="muted text-xs">{t("pos.summary.operations")}</span>
            <ShoppingCart className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 text-xl font-bold tabular-nums">{formatNumber(summary?.saleCount ?? 0, locale, 0)}</div>
          <div className="muted mt-1 text-[11px]">{money(summary?.cashSales ?? 0)}</div>
        </div>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {message ? (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" role="status">
          <div className="flex w-full max-w-md items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 shadow-lg">
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{message}</span>
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

      {session ? (
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold"><Wallet className="h-4 w-4" />{t("pos.cashMovements")}</h2>
            <span className="muted text-xs">{cashMovements.length}</span>
          </div>
          {cashMovements.length === 0 ? (
            <p className="muted py-4 text-center text-sm">{t("pos.cashMovementsEmpty")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cashMovements.map((movement) => {
                const isOut = movement.kind === "OUT" || movement.kind === "VOID";
                const saleId = movement.saleId;
                const canEdit = Boolean(
                  saleId && movement.saleStatus === "COMPLETED"
                  && Number(movement.saleRefundedAmount) <= 0.000001,
                );
                return (
                  <div className="rounded-lg border border-[var(--border)] p-2 text-xs" key={movement.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          {t(`pos.movement.${movement.kind}`)}
                          {movement.reason ? <span className="muted"> · {movement.reason}</span> : null}
                        </div>
                        <div className="muted">{new Date(movement.createdAt).toLocaleString(locale === "ar" ? "ar-YE-u-nu-latn" : "en-US")}</div>
                      </div>
                      <strong className={isOut ? "text-[var(--danger)]" : "text-emerald-600"}>
                        {isOut ? "−" : "+"}{money(Number(movement.amount))}
                      </strong>
                    </div>
                    {canEdit ? (
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
                        <span className="muted truncate">{movement.reference}</span>
                        <span className="flex shrink-0 gap-1">
                          <button
                            className="btn text-[11px]"
                            disabled={busy}
                            onClick={() => setEditingSaleId(saleId ?? "")}
                            type="button"
                          >
                            {t("pos.editSale")}
                          </button>
                          <button
                            className="btn btn-danger text-[11px]"
                            disabled={busy}
                            onClick={() => void voidSale(movement)}
                            type="button"
                          >
                            {t("pos.voidSale")}
                          </button>
                        </span>
                      </div>
                    ) : null}
                    {movement.kind === "OUT" && !movement.saleId ? (
                      <div className="mt-2 flex items-center justify-end gap-1 border-t border-[var(--border)] pt-2">
                        <button
                          className="btn text-[11px]"
                          disabled={busy}
                          onClick={() => openEditCashOut(movement)}
                          type="button"
                        >
                          {t("action.edit")}
                        </button>
                        <button
                          className="btn btn-danger text-[11px]"
                          disabled={busy}
                          onClick={() => void deleteCashOut(movement)}
                          type="button"
                        >
                          {t("action.delete")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {editingCashOut ? (
        <div
          className="arap-modal-overlay"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !editBusy) setEditingCashOut(null); }}
        >
          <form
            aria-labelledby="pos-edit-cashout-title"
            aria-modal="true"
            className="arap-modal"
            dir={locale === "ar" ? "rtl" : "ltr"}
            onSubmit={(event) => { event.preventDefault(); void submitEditCashOut(); }}
            role="dialog"
          >
            <div className="arap-modal-header">
              <h2 className="arap-modal-title" id="pos-edit-cashout-title">{t("pos.editCashOutTitle")}</h2>
              <button
                aria-label={t("action.close")}
                className="arap-modal-close"
                disabled={editBusy}
                onClick={() => setEditingCashOut(null)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="arap-modal-body scroll-thin">
              {editError ? <p className="arap-modal-error">{editError}</p> : null}
              <label className="arap-modal-field" htmlFor="pos-edit-cashout-amount">
                <span className="arap-modal-label">{t("pos.cashOutAmount")}</span>
                <span className="arap-modal-amount-wrap">
                  <span aria-hidden="true" className="arap-modal-currency">{currency}</span>
                  <input
                    autoFocus
                    className="arap-modal-input arap-modal-amount"
                    id="pos-edit-cashout-amount"
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => setEditAmount(event.target.value)}
                    step="any"
                    type="number"
                    value={editAmount}
                  />
                </span>
              </label>
              <label className="arap-modal-field" htmlFor="pos-edit-cashout-reason">
                <span className="arap-modal-label">{t("pos.cashOutReason")}</span>
                <input
                  className="arap-modal-input"
                  id="pos-edit-cashout-reason"
                  maxLength={200}
                  onChange={(event) => setEditReason(event.target.value)}
                  placeholder={t("pos.cashOutReasonPlaceholder")}
                  value={editReason}
                />
              </label>
            </div>
            <div className="arap-modal-footer">
              <button className="arap-modal-save" disabled={editBusy} type="submit">
                {editBusy ? t("common.loading") : t("action.save")}
              </button>
              <button className="arap-modal-cancel" disabled={editBusy} onClick={() => setEditingCashOut(null)} type="button">
                {t("action.cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {cashOutOpen ? (
        <div
          className="arap-modal-overlay"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !cashOutBusy) setCashOutOpen(false); }}
        >
          <form
            aria-labelledby="pos-cashout-title"
            aria-modal="true"
            className="arap-modal"
            dir={locale === "ar" ? "rtl" : "ltr"}
            onSubmit={(event) => { event.preventDefault(); void submitCashOut(); }}
            role="dialog"
          >
            <div className="arap-modal-header">
              <h2 className="arap-modal-title" id="pos-cashout-title">{t("pos.cashOutTitle")}</h2>
              <button
                aria-label={t("action.close")}
                className="arap-modal-close"
                disabled={cashOutBusy}
                onClick={() => setCashOutOpen(false)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="arap-modal-body scroll-thin">
              {cashOutError ? <p className="arap-modal-error">{cashOutError}</p> : null}
              <label className="arap-modal-field" htmlFor="pos-cashout-amount">
                <span className="arap-modal-label">{t("pos.cashOutAmount")}</span>
                <span className="arap-modal-amount-wrap">
                  <span aria-hidden="true" className="arap-modal-currency">{currency}</span>
                  <input
                    autoFocus
                    className="arap-modal-input arap-modal-amount"
                    id="pos-cashout-amount"
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => setCashOutAmount(event.target.value)}
                    step="any"
                    type="number"
                    value={cashOutAmount}
                  />
                </span>
              </label>
              <label className="arap-modal-field" htmlFor="pos-cashout-reason">
                <span className="arap-modal-label">{t("pos.cashOutReason")}</span>
                <input
                  className="arap-modal-input"
                  id="pos-cashout-reason"
                  maxLength={200}
                  onChange={(event) => setCashOutReason(event.target.value)}
                  placeholder={t("pos.cashOutReasonPlaceholder")}
                  value={cashOutReason}
                />
              </label>
              <p className="arap-modal-hint">{t("pos.cashOutHint")}</p>
            </div>
            <div className="arap-modal-footer">
              <button className="arap-modal-save" disabled={cashOutBusy} type="submit">
                {cashOutBusy ? t("common.loading") : t("pos.cashOut")}
              </button>
              <button className="arap-modal-cancel" disabled={cashOutBusy} onClick={() => setCashOutOpen(false)} type="button">
                {t("action.cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingSaleId ? (
        <SaleEditDialog
          saleId={editingSaleId}
          locale={locale}
          currency={currency}
          decimalPlaces={decimalPlaces}
          onClose={() => setEditingSaleId("")}
          onSaved={async () => {
            await refreshCashMovements();
            await refreshSummary();
          }}
        />
      ) : null}

      {receipt ? (
        <SaleSuccessDialog
          receipt={receipt}
          locale={locale}
          currency={currency}
          decimalPlaces={decimalPlaces}
          tenantName={tenantName}
          cashierName={cashierName}
          branchName={locale === "ar"
            ? (data.branches.find((b) => b.id === branchId)?.nameAr ?? "")
            : (data.branches.find((b) => b.id === branchId)?.nameEn ?? "")}
          onClose={() => setReceipt(null)}
          onNewSale={startNewSale}
        />
      ) : null}
    </div>
  );
}
