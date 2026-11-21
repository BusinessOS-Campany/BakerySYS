"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  apiFetch, apiSend, L, useList, type Locale,
} from "@/components/workflows/shared";
import type { CustomerTransactionItem } from "@/lib/customers/transactions-service";

type CustomerRow = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  phone: string | null;
  balance: string | number;
};

type Stats = { count: number; debt: number; payment: number };

export function ArapPage({
  locale,
  canManage,
  currency,
  decimalPlaces,
  initialCustomerId = "",
  standalone = false,
}: {
  locale: Locale;
  canManage: boolean;
  currency: string;
  decimalPlaces: number;
  initialCustomerId?: string;
  standalone?: boolean;
}) {
  const router = useRouter();
  const [refresh, setRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState(initialCustomerId);
  const [editing, setEditing] = useState<CustomerTransactionItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ customerId: "", kind: "DEBT", amount: "", notes: "" });
  const detailRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (selectedId && window.innerWidth < 768) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedId]);

  const customersList = useList<CustomerRow>(
    "/api/resources/customers?pageSize=200",
    (payload) => (payload as { items?: CustomerRow[] }).items ?? [],
    locale,
    refresh,
  );
  const entriesList = useList<CustomerTransactionItem>(
    "/api/customer-transactions",
    (payload) => (payload as { items?: CustomerTransactionItem[] }).items ?? [],
    locale,
    refresh,
  );

  const stats = useMemo(() => {
    const map = new Map<string, Stats>();
    for (const entry of entriesList.rows) {
      const current = map.get(entry.customerId) ?? { count: 0, debt: 0, payment: 0 };
      current.count += 1;
      if (entry.kind === "DEBT") current.debt += entry.amount;
      else current.payment += entry.amount;
      map.set(entry.customerId, current);
    }
    return map;
  }, [entriesList.rows]);

  const selectedCustomer = customersList.rows.find((customer) => customer.id === selectedId) ?? null;
  const selectedEntries = entriesList.rows.filter((entry) => entry.customerId === selectedId);
  const selectedStats = stats.get(selectedId) ?? { count: 0, debt: 0, payment: 0 };

  const numberFormat = new Intl.NumberFormat(locale === "ar" ? "ar-YE-u-nu-latn" : "en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
  const money = (value: number | string) => `${currency} ${numberFormat.format(Number(value) || 0)}`;
  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-YE-u-nu-latn" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const modalTitle = form.kind === "PAYMENT"
    ? (editing ? L(locale, "تعديل دفعة", "Edit payment") : L(locale, "تسجيل دفعة", "Register payment"))
    : (editing ? L(locale, "تعديل دين", "Edit debt") : L(locale, "تسجيل دين", "Register debt"));
  const kindOptions = [
    { value: "PAYMENT", label: L(locale, "تسجيل دفعة", "Register payment") },
    { value: "DEBT", label: L(locale, "تسجيل دين", "Register debt") },
  ] as const;

  function openCreate() {
    setEditing(null);
    setForm({ customerId: selectedId, kind: "DEBT", amount: "", notes: "" });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(entry: CustomerTransactionItem) {
    setEditing(entry);
    setForm({
      customerId: entry.customerId,
      kind: entry.kind,
      amount: String(entry.amount),
      notes: entry.notes ?? "",
    });
    setFormError("");
    setFormOpen(true);
  }

  async function save() {
    const amount = Number(form.amount);
    if (!form.customerId || !Number.isFinite(amount) || amount <= 0) {
      setFormError(L(locale, "اختر العميل وأدخل مبلغًا صحيحًا", "Select a customer and enter a valid amount"));
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        customerId: form.customerId,
        kind: form.kind,
        amount,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await apiSend(`/api/customer-transactions/${editing.id}`, "PATCH", payload, locale);
      } else {
        await apiSend("/api/customer-transactions", "POST", payload, locale);
      }
      setSelectedId(form.customerId);
      setFormOpen(false);
      setEditing(null);
      setRefresh((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: CustomerTransactionItem) {
    const confirmed = window.confirm(
      L(locale, "هل تريد حذف هذه العملية نهائيًا؟", "Permanently delete this transaction?"),
    );
    if (!confirmed) return;
    setFormError("");
    try {
      await apiFetch(`/api/customer-transactions/${entry.id}`, locale, { method: "DELETE" });
      setRefresh((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    }
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setFormError("");
  }

  useEffect(() => {
    if (!formOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeForm();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [formOpen]);

  return (
    <div className="w-full max-w-full space-y-4 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">
            {standalone
              ? L(locale, "العمليات", "Transactions")
              : L(locale, "الأجل والمدفوعات", "Due & payments")}
          </h1>
          <p className="muted mt-1 text-xs sm:text-sm">
            {standalone
              ? L(locale, "جميع عمليات العميل المحددة", "All transactions for the selected customer")
              : L(
                locale,
                "سجل ديون العملاء وسداداتهم، وتعديل أو حذف العمليات من مكان واحد",
                "Record customer debts and payments, then edit or delete them in one place",
              )}
          </p>
        </div>
        {canManage ? (
          <button className="btn btn-primary shrink-0 text-xs sm:text-sm" onClick={openCreate} type="button">
            <Plus className="h-4 w-4" />
            {L(locale, "عملية جديدة", "New transaction")}
          </button>
        ) : null}
      </div>

      {formError ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{formError}</p> : null}

      <div className="grid min-w-0 grid-cols-1 gap-4">
        {standalone ? null : (
        <section className="card min-w-0 overflow-hidden p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{L(locale, "العملاء", "Customers")}</h2>
            <span className="muted text-[11px] sm:text-xs">
              {L(locale, "يعرض جميع عمليات العميل", "Shows all customer transactions")}
            </span>
            <span className="muted w-full text-[11px] sm:hidden">
              {L(locale, "اسحب الجدول أفقيًا لعرض كل الأعمدة", "Swipe the table horizontally to view all columns")}
            </span>
          </div>
          {customersList.loading ? <p className="muted text-sm">{L(locale, "جار التحميل...", "Loading...")}</p> : null}
          {customersList.error ? <p className="text-sm text-red-300">{customersList.error}</p> : null}
          <div className="arap-table-shell">
            <div className="arap-table-scroll scroll-thin">
              <table className="arap-customer-table">
                <caption className="sr-only">
                  {L(locale, "جدول أرصدة العملاء والمدفوعات", "Customer balances and payments table")}
                </caption>
                <colgroup>
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">{L(locale, "العميل", "Customer")}</th>
                    <th scope="col" className="arap-cell-numeric">{L(locale, "الرصيد", "Balance")}</th>
                    <th scope="col" className="arap-cell-center">{L(locale, "العمليات", "Transactions")}</th>
                    <th scope="col" className="arap-cell-numeric">{L(locale, "دين", "Debt")}</th>
                    <th scope="col" className="arap-cell-numeric">{L(locale, "سداد", "Payment")}</th>
                  </tr>
                </thead>
                <tbody>
                  {customersList.rows.map((customer) => {
                    const customerStats = stats.get(customer.id) ?? { count: 0, debt: 0, payment: 0 };
                    const name = locale === "ar" ? customer.nameAr : customer.nameEn;
                    const isSelected = selectedId === customer.id;
                    return (
                      <tr
                        aria-selected={isSelected}
                        className={isSelected ? "is-selected" : undefined}
                        key={customer.id}
                        onClick={() => router.push(`/transactions?customerId=${encodeURIComponent(customer.id)}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(`/transactions?customerId=${encodeURIComponent(customer.id)}`);
                          }
                        }}
                        tabIndex={0}
                      >
                        <td>
                          <div className="arap-customer-name" title={name}>{name}</div>
                          <div className="arap-customer-code" title={customer.code}>{customer.code}</div>
                        </td>
                        <td className="arap-cell-numeric">
                          <span className="arap-money arap-balance">{money(customer.balance)}</span>
                        </td>
                        <td className="arap-cell-center">
                          <span className="arap-count">{customerStats.count}</span>
                        </td>
                        <td className="arap-cell-numeric">
                          <span className="arap-money">{money(customerStats.debt)}</span>
                        </td>
                        <td className="arap-cell-numeric">
                          <span className="arap-money">{money(customerStats.payment)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {!customersList.loading && customersList.rows.length === 0 ? (
            <p className="muted py-6 text-center text-sm">{L(locale, "لا يوجد عملاء", "No customers")}</p>
          ) : null}
        </section>
        )}

        {standalone ? (
        <section className="card min-w-0 overflow-hidden p-3 sm:p-4" ref={detailRef}>
          {selectedCustomer ? (
            <div className="space-y-3">
              <button
                className="btn btn-secondary text-xs sm:text-sm"
                onClick={() => router.push("/arap")}
                type="button"
              >
                {L(locale, "العودة إلى الأجل والمدفوعات", "Back to due & payments")}
              </button>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{locale === "ar" ? selectedCustomer.nameAr : selectedCustomer.nameEn}</h2>
                  <p className="muted text-xs">{selectedCustomer.code}</p>
                </div>
                <div className="text-left">
                  <div className="muted text-[11px]">{L(locale, "الرصيد الحالي", "Current balance")}</div>
                  <div className={Number(selectedCustomer.balance) < 0 ? "text-emerald-300" : "text-amber-200"}>
                    {money(selectedCustomer.balance)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--border)] p-2">
                  <div className="muted text-[11px]">{L(locale, "عدد العمليات", "Transactions")}</div>
                  <div className="font-semibold">{selectedStats.count}</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] p-2">
                  <div className="muted text-[11px]">{L(locale, "إجمالي الدين", "Total debt")}</div>
                  <div className="font-semibold">{money(selectedStats.debt)}</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] p-2">
                  <div className="muted text-[11px]">{L(locale, "إجمالي السداد", "Total payment")}</div>
                  <div className="font-semibold">{money(selectedStats.payment)}</div>
                </div>
              </div>
              {entriesList.loading ? <p className="muted text-sm">{L(locale, "جار التحميل...", "Loading...")}</p> : null}
              <div className="space-y-2">
                {selectedEntries.length === 0 ? (
                  <p className="muted rounded-lg border border-dashed border-[var(--border)] py-8 text-center text-sm">
                    {L(locale, "لا توجد عمليات لهذا العميل", "No transactions for this customer")}
                  </p>
                ) : null}
                {selectedEntries.map((entry) => (
                  <div className="rounded-lg border border-[var(--border)] p-3" key={entry.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            entry.kind === "DEBT"
                              ? "bg-amber-500/15 text-amber-200"
                              : "bg-emerald-500/15 text-emerald-200"
                          }`}
                        >
                          {entry.kind === "DEBT" ? L(locale, "دين", "Debt") : L(locale, "سداد", "Payment")}
                        </span>
                        <div className="mt-1 font-semibold">{money(entry.amount)}</div>
                        <div className="muted text-[11px]">{dateFormat.format(new Date(entry.entryDate))}</div>
                      </div>
                      {canManage && !entry.sourceType ? (
                        <div className="flex gap-1">
                          <button className="btn btn-secondary px-2 py-1" onClick={() => openEdit(entry)} title={L(locale, "تعديل", "Edit")} type="button">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button className="btn btn-secondary px-2 py-1 text-red-300" onClick={() => remove(entry)} title={L(locale, "حذف", "Delete")} type="button">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {entry.notes ? <p className="muted mt-2 text-xs">{entry.notes}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        ) : null}
      </div>

      {formOpen ? (
        <div
          className="arap-modal-overlay"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}
        >
          <form
            aria-labelledby="arap-form-title"
            aria-modal="true"
            className="arap-modal"
            dir={locale === "ar" ? "rtl" : "ltr"}
            onSubmit={(event) => { event.preventDefault(); void save(); }}
            role="dialog"
          >
            <div className="arap-modal-header">
              <h2 className="arap-modal-title" id="arap-form-title">{modalTitle}</h2>
              <button
                aria-label={L(locale, "إغلاق", "Close")}
                className="arap-modal-close"
                onClick={closeForm}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="arap-modal-body scroll-thin">
              {formError ? (
                <p className="arap-modal-error">{formError}</p>
              ) : null}

              <label className="arap-modal-field" htmlFor="arap-customer">
                <span className="arap-modal-label">{L(locale, "العميل", "Customer")}</span>
                <span className="arap-modal-select-wrap">
                  <select
                    className="arap-modal-input arap-modal-select"
                    disabled={Boolean(editing)}
                    id="arap-customer"
                    onChange={(event) => setForm({ ...form, customerId: event.target.value })}
                    value={form.customerId}
                  >
                    <option value="">—</option>
                    {customersList.rows.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {`${locale === "ar" ? customer.nameAr : customer.nameEn} (${customer.code})`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden="true" className="arap-modal-select-icon" />
                </span>
              </label>

              <div aria-label={L(locale, "نوع العملية", "Transaction type")} className="arap-modal-segments" role="group">
                {kindOptions.map((option) => (
                  <button
                    aria-pressed={form.kind === option.value}
                    className={`arap-modal-segment ${form.kind === option.value ? "is-active" : ""}`}
                    key={option.value}
                    onClick={() => setForm({ ...form, kind: option.value })}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label className="arap-modal-field" htmlFor="arap-amount">
                <span className="arap-modal-label">{L(locale, "المبلغ", "Amount")}</span>
                <span className="arap-modal-amount-wrap">
                  <span aria-hidden="true" className="arap-modal-currency">{currency}</span>
                  <input
                    autoFocus
                    className="arap-modal-input arap-modal-amount"
                    id="arap-amount"
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    step="any"
                    type="number"
                    value={form.amount}
                  />
                </span>
              </label>

              <label className="arap-modal-field" htmlFor="arap-notes">
                <span className="arap-modal-label">{L(locale, "ملاحظات", "Notes")}</span>
                <textarea
                  className="arap-modal-input arap-modal-textarea"
                  id="arap-notes"
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  value={form.notes}
                />
              </label>

              <p className="arap-modal-hint">
                {L(locale, "التاريخ يُسجّل تلقائيًا بيوم الإدخال", "The date is recorded automatically as today")}
              </p>
            </div>

            <div className="arap-modal-footer">
              <button className="arap-modal-save" disabled={saving} type="submit">
                {saving ? <span aria-hidden="true" className="spinner arap-modal-spinner" /> : null}
                {saving ? L(locale, "جار الحفظ...", "Saving...") : L(locale, "حفظ", "Save")}
              </button>
              <button className="arap-modal-cancel" onClick={closeForm} type="button">
                {L(locale, "إلغاء", "Cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
