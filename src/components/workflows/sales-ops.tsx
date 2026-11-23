"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  apiFetch, apiSend, DataPanel, FieldInput, L, statusBadge, useList,
  type Field, type FormValues, type Locale,
} from "./shared";
import { useDialog } from "@/components/ui/dialog";
import { SaleEditDialog } from "@/components/sales/sale-edit-dialog";
import { formatDate, formatMoney } from "@/lib/i18n/dictionary";

type SaleRow = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: string | number;
  paidAmount: string | number;
  profit: string | number;
  status: string;
  refundedAmount: string | number;
};
type SaleDetail = {
  sale: SaleRow;
  items: { id: string; nameSnapshot: string; quantity: string | number; lineTotal: string | number }[];
  payments: { id: string; method: string; amount: string | number; paidAt: string }[];
  returns: { id: string; number: string; amount: string | number }[];
};

export function SalesPage({
  locale,
  canRefund,
  canEdit,
  currency,
  decimalPlaces,
}: {
  locale: Locale;
  canRefund: boolean;
  canEdit: boolean;
  currency: string;
  decimalPlaces: number;
}) {
  const [refresh, setRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const { confirm } = useDialog();
  const sales = useList<SaleRow>("/api/sales?pageSize=100", undefined, locale, refresh);
  const money = (value: string | number) => formatMoney(Number(value), locale, currency, decimalPlaces);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "المبيعات", "Sales")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "فواتير نقاط البيع والمرتجعات", "POS invoices and returns")}
        </p>
      </div>

      <DataPanel<SaleRow>
        title={L(locale, "فواتير المبيعات", "Sales invoices")}
        endpoint="/api/sales?pageSize=100"
        locale={locale}
        rows={sales.rows}
        loading={sales.loading}
        reload={async () => { await sales.reload(); setRefresh((v) => v + 1); }}
        refreshKey={refresh}
        columns={[
          { key: "invoiceNumber", label: L(locale, "رقم الفاتورة", "Invoice") },
          { key: "invoiceDate", label: L(locale, "التاريخ", "Date"), render: (row) => formatDate(row.invoiceDate, locale) },
          { key: "total", label: L(locale, "الإجمالي", "Total"), render: (row) => money(row.total) },
          { key: "paidAmount", label: L(locale, "المدفوع", "Paid"), render: (row) => money(row.paidAmount) },
          { key: "profit", label: L(locale, "الربح", "Profit"), render: (row) => money(row.profit) },
          { key: "status", label: L(locale, "الحالة", "Status"), render: (row) => statusBadge(row.status, locale) },
        ]}
        rowActions={[
          {
            label: L(locale, "تعديل", "Edit"),
            tone: "primary",
            visible: (row) => canEdit && row.status === "COMPLETED" && Number(row.refundedAmount) <= 0.000001,
            run: (row) => setEditingId(row.id),
          },
          {
            label: L(locale, "إلغاء", "Cancel"),
            tone: "danger",
            visible: (row) => canEdit && row.status === "COMPLETED" && Number(row.refundedAmount) <= 0.000001,
            run: (row, reload, setError) => {
              void (async () => {
                const ok = await confirm({
                  title: L(locale, "إلغاء الفاتورة", "Cancel invoice"),
                  message: L(
                    locale,
                    `إلغاء الفاتورة ${row.invoiceNumber}؟ ستُعاد الكميات إلى المخزون ويُعكس القيد المحاسبي.`,
                    `Cancel invoice ${row.invoiceNumber}? Stock will be restored and the journal reversed.`,
                  ),
                  confirmLabel: L(locale, "إلغاء الفاتورة", "Cancel invoice"),
                  tone: "danger",
                });
                if (!ok) return;
                try {
                  await apiFetch(`/api/sales/${row.id}`, locale, { method: "DELETE" });
                  await reload();
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              })();
            },
          },
          {
            label: L(locale, "مرتجع", "Refund"),
            tone: "secondary",
            requiresManage: true,
            visible: (row) => canRefund && row.status === "COMPLETED",
            run: (row) => setSelectedId(row.id),
          },
        ]}
        canManage={canRefund}
      />

      {canRefund ? <RefundForm locale={locale} saleId={selectedId} sales={sales.rows} onSaleChange={setSelectedId} onDone={async () => {
        setSelectedId("");
        await sales.reload();
      }} /> : null}

      {editingId ? (
        <SaleEditDialog
          saleId={editingId}
          locale={locale}
          currency={currency}
          decimalPlaces={decimalPlaces}
          onClose={() => setEditingId("")}
          onSaved={async () => { await sales.reload(); }}
        />
      ) : null}
    </div>
  );
}

function RefundForm({
  locale,
  saleId,
  sales,
  onSaleChange,
  onDone,
}: {
  locale: Locale;
  saleId: string;
  sales: SaleRow[];
  onSaleChange: (id: string) => void;
  onDone: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("CASH");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setItemId("");
    setDetail(null);
    if (!saleId) return;
    void apiFetch<SaleDetail>(`/api/sales/${saleId}`, locale)
      .then((value) => { if (active) setDetail(value); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : String(err)); });
    return () => { active = false; };
  }, [locale, saleId]);

  const saleOptions = sales.map((sale) => ({ value: sale.id, label: `${sale.invoiceNumber} · ${formatDate(sale.invoiceDate, locale)}` }));
  const itemOptions = (detail?.items ?? []).map((item) => ({
    value: item.id,
    label: `${item.nameSnapshot} · ${item.quantity}`,
  }));
  const fields: Field[] = [
    { name: "saleId", label: L(locale, "الفاتورة", "Invoice"), type: "select", required: true, options: saleOptions },
    { name: "saleItemId", label: L(locale, "البند", "Line"), type: "select", required: true, options: itemOptions },
    { name: "quantity", label: L(locale, "الكمية المرتجعة", "Return quantity"), type: "number", required: true, defaultValue: "1" },
    { name: "reason", label: L(locale, "السبب", "Reason"), required: true },
    { name: "method", label: L(locale, "طريقة الدفع", "Payment method"), type: "select", defaultValue: "CASH", options: [
      { value: "CASH", label: L(locale, "نقد", "Cash") },
      { value: "BANK_TRANSFER", label: L(locale, "تحويل بنكي", "Bank transfer") },
      { value: "CARD", label: L(locale, "بطاقة", "Card") },
      { value: "CREDIT", label: L(locale, "آجل", "Credit") },
    ] },
  ];
  const values: FormValues = { saleId, saleItemId: itemId, quantity, reason, method };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiSend("/api/sales/refund", "POST", {
        saleId,
        reason,
        method,
        items: [{ saleItemId: itemId, quantity: Number(quantity) }],
      }, locale);
      setReason("");
      setQuantity("1");
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card space-y-3 p-4" onSubmit={(event) => void submit(event)}>
      <div>
        <h3 className="text-sm font-bold">{L(locale, "تسجيل مرتجع مبيعات", "Record sales return")}</h3>
        <p className="muted mt-1 text-xs">
          {L(locale, "يتم اعتماد المرتجع بقيد محاسبي عكسي وإعادة الكميات إلى المخزون.", "The return posts a reversing journal and restores stock.")}
        </p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <FieldInput
          field={fields[0]}
          onChange={(value) => onSaleChange(String(value))}
          value={saleId}
        />
        <FieldInput field={fields[1]} onChange={(value) => setItemId(String(value))} value={itemId} />
        <FieldInput field={fields[2]} onChange={(value) => setQuantity(String(value))} value={quantity} />
        <FieldInput field={fields[3]} onChange={(value) => setReason(String(value))} value={reason} />
        <FieldInput field={fields[4]} onChange={(value) => setMethod(String(value))} value={method} />
      </div>
      {detail ? (
        <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs">
          <div className="font-semibold">{detail.sale.invoiceNumber}</div>
          <div className="muted mt-1">
            {L(locale, "المدفوع", "Paid")}: {detail.payments.map((p) => p.method).join(", ") || "—"}
            {detail.returns.length ? ` · ${L(locale, "مرتجعات سابقة", "Previous returns")}: ${detail.returns.length}` : ""}
          </div>
        </div>
      ) : null}
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={saving || !saleId || !itemId || !reason} type="submit">
          {saving ? L(locale, "جارٍ الحفظ...", "Saving...") : L(locale, "اعتماد المرتجع", "Post return")}
        </button>
      </div>
    </form>
  );
}

// Kept as a named export for potential reuse in dashboards.
export const SalesRefundFields = {
  methods: ["CASH", "BANK_TRANSFER", "CARD", "CREDIT"],
};
