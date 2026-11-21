"use client";

import { useState } from "react";
import {
  ActionForm, apiSend, DataPanel, L, LineItemsEditor, lookupOptions, numericLocale, statusBadge, useList, useLookups,
  type LineItem, type Locale,
} from "./shared";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: string | number;
  depositAmount: string | number;
  balanceAmount: string | number;
  requestedPickup: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

const NEXT_STATUS: Record<string, string | null> = {
  NEW: "CONFIRMED",
  CONFIRMED: "IN_PRODUCTION",
  IN_PRODUCTION: "READY",
  READY: "COMPLETED",
};

export function OrdersPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const orders = useList<OrderRow>("/api/orders", undefined, locale, refresh);
  const lookups = useLookups(["products", "customers", "employees"], locale);
  const productOptions = lookupOptions(lookups.products ?? [], locale);
  const [lines, setLines] = useState<LineItem[]>([{ key: "initial", quantity: "1", unitPrice: "0" }]);

  const transition = (id: string, status: string) => async (reload: () => Promise<void>, setError: (message: string) => void) => {
    try {
      await apiSend(`/api/orders/${id}`, "POST", { action: "status", status }, locale);
      await reload();
      setRefresh((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "طلبات العملاء", "Customer orders")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "طلبات الكيك المخصصة والعربون والمتبقي", "Custom cake orders, deposits and balances")}
        </p>
      </div>

      <DataPanel<OrderRow>
        title={L(locale, "سجل الطلبات", "Order register")}
        endpoint="/api/orders"
        locale={locale}
        rows={orders.rows}
        loading={orders.loading}
        reload={orders.reload}
        refreshKey={refresh}
        canManage={canManage}
        columns={[
          { key: "orderNumber", label: L(locale, "رقم الطلب", "Order") },
          { key: "customerName", label: L(locale, "العميل", "Customer"), render: (row) => row.customerName || row.customerPhone || "—" },
          { key: "requestedPickup", label: L(locale, "الاستلام", "Pickup"), render: (row) => row.requestedPickup ? new Date(row.requestedPickup).toLocaleString(numericLocale(locale)) : "—" },
          { key: "total", label: L(locale, "الإجمالي", "Total") },
          { key: "depositAmount", label: L(locale, "العربون", "Deposit") },
          { key: "status", label: L(locale, "الحالة", "Status"), render: (row) => statusBadge(row.status, locale) },
        ]}
        form={{
          title: L(locale, "طلب جديد", "New custom order"),
          endpoint: "/api/orders",
          enabled: canManage,
          fields: [
            { name: "customerName", label: L(locale, "اسم العميل", "Customer name"), required: true },
            { name: "customerPhone", label: L(locale, "الهاتف", "Phone") },
            { name: "customerId", label: L(locale, "العميل المسجل", "Registered customer"), type: "select", options: lookupOptions(lookups.customers ?? [], locale) },
            { name: "productId", label: L(locale, "المنتج", "Product"), type: "select", options: productOptions },
            { name: "requestedPickup", label: L(locale, "موعد الاستلام", "Pickup at"), type: "datetime" },
            { name: "deliveryAddress", label: L(locale, "عنوان التوصيل", "Delivery address") },
            { name: "specialNotes", label: L(locale, "ملاحظات", "Notes"), type: "textarea" },
          ],
          extra: () => (
            <LineItemsEditor
              itemOptions={productOptions}
              lines={lines}
              locale={locale}
              onChange={setLines}
            />
          ),
          build: (values) => ({
            customerName: String(values.customerName || ""),
            customerPhone: String(values.customerPhone || "") || undefined,
            customerId: String(values.customerId || "") || null,
            productId: String(values.productId || "") || null,
            requestedPickup: values.requestedPickup ? new Date(String(values.requestedPickup)).toISOString() : null,
            deliveryAddress: String(values.deliveryAddress || "") || undefined,
            specialNotes: String(values.specialNotes || "") || undefined,
            lines: lines.filter((line) => line.name || line.productId).map((line) => ({
              productId: line.productId ?? null,
              name: line.name || productOptions.find((option) => option.value === line.productId)?.label || "—",
              quantity: Number(line.quantity) || 1,
              unitPrice: Number(line.unitPrice) || 0,
            })),
          }),
          afterSave: async () => { setLines([{ key: crypto.randomUUID(), quantity: "1", unitPrice: "0" }]); },
        }}
        rowActions={[
          {
            label: L(locale, "تقدم", "Advance"),
            tone: "primary",
            requiresManage: true,
            visible: (row) => Boolean(NEXT_STATUS[row.status]) && canManage,
            run: (row, reload, setError) => transition(row.id, NEXT_STATUS[row.status] ?? "")(reload, setError),
          },
          {
            label: L(locale, "إلغاء", "Cancel"),
            tone: "danger",
            requiresManage: true,
            visible: (row) => !["COMPLETED", "CANCELLED"].includes(row.status) && canManage,
            run: (row, reload, setError) => transition(row.id, "CANCELLED")(reload, setError),
          },
        ]}
      />

      {canManage ? (
        <ActionForm
          title={L(locale, "تسجيل دفعة على الطلب", "Record order payment")}
          fields={[
            { name: "orderId", label: L(locale, "الطلب", "Order"), type: "select", required: true, options: orders.rows.map((order) => ({ value: order.id, label: `${order.orderNumber} · ${order.status}` })) },
            { name: "amount", label: L(locale, "المبلغ", "Amount"), type: "number", required: true },
            { name: "kind", label: L(locale, "النوع", "Type"), type: "select", defaultValue: "DEPOSIT", options: [
              { value: "DEPOSIT", label: L(locale, "عربون", "Deposit") },
              { value: "BALANCE", label: L(locale, "متبقي", "Balance") },
            ] },
            { name: "method", label: L(locale, "الطريقة", "Method"), type: "select", defaultValue: "CASH", options: [
              { value: "CASH", label: L(locale, "نقد", "Cash") },
              { value: "BANK_TRANSFER", label: L(locale, "تحويل", "Bank transfer") },
              { value: "CARD", label: L(locale, "بطاقة", "Card") },
            ] },
            { name: "reference", label: L(locale, "المرجع", "Reference") },
          ]}
          build={(values) => ({
            amount: Number(values.amount),
            kind: values.kind || "DEPOSIT",
            method: values.method || "CASH",
            reference: String(values.reference || "") || undefined,
          })}
          endpoint={(values) => `/api/orders/${encodeURIComponent(String(values.orderId || ""))}`}
          locale={locale}
          onSuccess={async () => { await orders.reload(); setRefresh((v) => v + 1); }}
          submitLabel={L(locale, "تسجيل الدفعة", "Record payment")}
        />
      ) : null}
    </div>
  );
}
