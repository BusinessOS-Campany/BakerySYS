"use client";

import { useState } from "react";
import {
  ActionForm, apiSend, DataPanel, L, LineItemsEditor, lookupLabel, lookupOptions, statusBadge,
  useList, useLookups, type LineItem, type Locale,
} from "./shared";

type PurchaseOrderRow = {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  expectedDate: string | null;
  status: string;
  total: string | number;
  lines: { id: string; ingredientId: string; quantity: string | number; unitPrice: string | number }[];
};
type ReceiptRow = {
  id: string;
  receiptNumber: string;
  supplierId: string;
  supplierName: string;
  receivedAt: string;
  total: string | number;
  status: string;
  payable: { amount: string | number; settled: string | number; status: string } | null;
  lines: { id: string; ingredientId: string; quantity: string | number; unitCost: string | number }[];
};

export function PurchasesPage({ locale, canManage, canApprove }: { locale: Locale; canManage: boolean; canApprove: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const orders = useList<PurchaseOrderRow>("/api/purchasing/orders?pageSize=100", undefined, locale, refresh);
  const receipts = useList<ReceiptRow>("/api/purchasing/receipts?pageSize=100", undefined, locale, refresh);
  const lookups = useLookups(["suppliers", "warehouses", "ingredients", "units"], locale);
  const supplierOptions = lookupOptions(lookups.suppliers ?? [], locale);
  const warehouseOptions = lookupOptions(lookups.warehouses ?? [], locale);
  const ingredientOptions = lookupOptions(lookups.ingredients ?? [], locale);
  const unitOptions = lookupOptions(lookups.units ?? [], locale);
  const [orderLines, setOrderLines] = useState<LineItem[]>([{ key: "order-1", quantity: "1", unitPrice: "0" }]);
  const [receiptLines, setReceiptLines] = useState<LineItem[]>([{ key: "receipt-1", quantity: "1", unitPrice: "0" }]);

  const reloadAll = async () => {
    await Promise.all([orders.reload(), receipts.reload()]);
    setRefresh((v) => v + 1);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "المشتريات", "Purchasing")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "أوامر الشراء، الاستلام، الدفعات، وأرصدة الموردين", "Purchase orders, receiving, payments and supplier balances")}
        </p>
      </div>

      <DataPanel<PurchaseOrderRow>
        title={L(locale, "أوامر الشراء", "Purchase orders")}
        endpoint="/api/purchasing/orders?pageSize=100"
        locale={locale}
        rows={orders.rows}
        loading={orders.loading}
        reload={orders.reload}
        refreshKey={refresh}
        canManage={canManage}
        columns={[
          { key: "orderNumber", label: L(locale, "رقم الأمر", "Order") },
          { key: "supplierName", label: L(locale, "المورد", "Supplier") },
          { key: "expectedDate", label: L(locale, "المتوقع", "Expected"), render: (row) => row.expectedDate ? new Date(row.expectedDate).toLocaleDateString(locale) : "—" },
          { key: "total", label: L(locale, "الإجمالي", "Total") },
          { key: "status", label: L(locale, "الحالة", "Status"), render: (row) => statusBadge(row.status, locale) },
        ]}
        form={{
          title: L(locale, "أمر شراء جديد", "New purchase order"),
          endpoint: "/api/purchasing/orders",
          enabled: canManage,
          fields: [
            { name: "supplierId", label: L(locale, "المورد", "Supplier"), type: "select", required: true, options: supplierOptions },
            { name: "warehouseId", label: L(locale, "مخزن الاستلام", "Receiving warehouse"), type: "select", required: true, options: warehouseOptions },
            { name: "expectedDate", label: L(locale, "تاريخ الاستلام المتوقع", "Expected date"), type: "date" },
            { name: "notes", label: L(locale, "ملاحظات", "Notes"), type: "textarea" },
          ],
          extra: () => (
            <LineItemsEditor
              itemOptions={ingredientOptions}
              unitOptions={unitOptions}
              includeUnit
              lines={orderLines}
              locale={locale}
              onChange={setOrderLines}
            />
          ),
          build: (values) => ({
            supplierId: String(values.supplierId),
            warehouseId: String(values.warehouseId),
            expectedDate: values.expectedDate ? new Date(String(values.expectedDate)).toISOString() : null,
            notes: String(values.notes || "") || undefined,
            items: orderLines.filter((line) => line.ingredientId).map((line) => ({
              ingredientId: String(line.ingredientId),
              quantity: Number(line.quantity),
              unitId: String(line.unitId || ""),
              unitPrice: Number(line.unitPrice),
            })),
          }),
          afterSave: async () => setOrderLines([{ key: crypto.randomUUID(), quantity: "1", unitPrice: "0" }]),
        }}
        rowActions={[
          {
            label: L(locale, "اعتماد", "Approve"),
            tone: "primary",
            requiresManage: true,
            visible: (row) => canApprove && row.status !== "APPROVED",
            run: async (row, reloadFn, setError) => {
              try {
                await apiSend(`/api/purchasing/orders/${row.id}`, "POST", { action: "approve" }, locale);
                await reloadFn();
                setRefresh((v) => v + 1);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            },
          },
        ]}
      />

      <DataPanel<ReceiptRow>
        title={L(locale, "إيصالات الاستلام", "Goods receipts")}
        endpoint="/api/purchasing/receipts?pageSize=100"
        locale={locale}
        rows={receipts.rows}
        loading={receipts.loading}
        reload={receipts.reload}
        refreshKey={refresh}
        canManage={canManage}
        columns={[
          { key: "receiptNumber", label: L(locale, "رقم الإيصال", "Receipt") },
          { key: "supplierName", label: L(locale, "المورد", "Supplier") },
          { key: "receivedAt", label: L(locale, "التاريخ", "Date"), render: (row) => new Date(row.receivedAt).toLocaleDateString(locale) },
          { key: "total", label: L(locale, "القيمة", "Value") },
          { key: "payable", label: L(locale, "المستحق", "Payable"), render: (row) => row.payable ? `${Number(row.payable.amount) - Number(row.payable.settled)}` : "—" },
          { key: "status", label: L(locale, "الحالة", "Status"), render: (row) => statusBadge(row.payable?.status ?? row.status, locale) },
        ]}
        form={{
          title: L(locale, "استلام بضاعة", "Receive goods"),
          endpoint: "/api/purchasing/receipts",
          enabled: canManage,
          fields: [
            { name: "orderId", label: L(locale, "أمر الشراء", "Purchase order"), type: "select", options: orders.rows.map((order) => ({ value: order.id, label: `${order.orderNumber} · ${order.supplierName}` })) },
            { name: "supplierId", label: L(locale, "المورد", "Supplier"), type: "select", required: true, options: supplierOptions },
            { name: "warehouseId", label: L(locale, "مخزن الاستلام", "Receiving warehouse"), type: "select", required: true, options: warehouseOptions },
            { name: "receivedAt", label: L(locale, "تاريخ الاستلام", "Received at"), type: "datetime" },
            { name: "inspectionNote", label: L(locale, "ملاحظة الفحص", "Inspection note"), type: "textarea" },
          ],
          extra: () => (
            <LineItemsEditor
              itemOptions={ingredientOptions}
              unitOptions={unitOptions}
              lines={receiptLines}
              locale={locale}
              onChange={setReceiptLines}
            />
          ),
          build: (values) => ({
            orderId: String(values.orderId || "") || null,
            supplierId: String(values.supplierId),
            warehouseId: String(values.warehouseId),
            receivedAt: values.receivedAt ? new Date(String(values.receivedAt)).toISOString() : undefined,
            inspectionNote: String(values.inspectionNote || "") || undefined,
            items: receiptLines.filter((line) => line.ingredientId).map((line) => ({
              ingredientId: String(line.ingredientId),
              quantity: Number(line.quantity),
              acceptedQuantity: Number(line.quantity),
              rejectedQuantity: 0,
              unitId: String(line.unitId || ""),
              unitCost: Number(line.unitPrice),
              lotNumber: "",
            })),
          }),
          afterSave: async () => {
            setReceiptLines([{ key: crypto.randomUUID(), quantity: "1", unitPrice: "0" }]);
            await reloadAll();
          },
        }}
      />

      {canManage ? (
        <ActionForm
          title={L(locale, "سداد مورد", "Pay supplier")}
          description={L(locale, "يتم تخفيض الرصيد المستحق للإيصال وتسجيل الدفعة في اليومية.", "The receipt payable is reduced and the payment is journalised.")}
          fields={[
            { name: "receiptId", label: L(locale, "الإيصال", "Receipt"), type: "select", required: true, options: receipts.rows.map((receipt) => ({ value: receipt.id, label: `${receipt.receiptNumber} · ${receipt.supplierName}` })) },
            { name: "amount", label: L(locale, "المبلغ", "Amount"), type: "number", required: true },
            { name: "method", label: L(locale, "الطريقة", "Method"), type: "select", defaultValue: "CASH", options: [
              { value: "CASH", label: L(locale, "نقد", "Cash") },
              { value: "BANK_TRANSFER", label: L(locale, "تحويل بنكي", "Bank transfer") },
              { value: "CHEQUE", label: L(locale, "شيك", "Cheque") },
              { value: "CARD", label: L(locale, "بطاقة", "Card") },
            ] },
            { name: "reference", label: L(locale, "المرجع", "Reference") },
          ]}
          endpoint={(values) => `/api/purchasing/receipts/${encodeURIComponent(String(values.receiptId || ""))}`}
          build={(values) => ({
            action: "payment",
            amount: Number(values.amount),
            method: String(values.method || "CASH"),
            reference: String(values.reference || "") || undefined,
          })}
          locale={locale}
          onSuccess={async () => { await reloadAll(); }}
          submitLabel={L(locale, "تسجيل السداد", "Record payment")}
        />
      ) : null}
    </div>
  );
}
