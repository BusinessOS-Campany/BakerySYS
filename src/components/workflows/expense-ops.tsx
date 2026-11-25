"use client";

import { useState } from "react";
import { useDialog } from "@/components/ui/dialog";
import {
  apiSend, DataPanel, L, lookupOptions, numericLocale, statusBadge, useList, useLookups, type Locale,
} from "./shared";

type ExpenseRow = {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  categoryId?: string | null;
  accountId?: string | null;
  categoryName: string | null;
  vendor: string | null;
  amount: string | number;
  taxAmount: string | number;
  description: string | null;
  method?: string;
  status: string;
  source?: "EXPENSE" | "CASH_MOVEMENT";
  isCashOut?: boolean;
};

export function ExpensesPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const { confirm } = useDialog();
  const [refresh, setRefresh] = useState(0);
  const expenses = useList<ExpenseRow>("/api/expenses?pageSize=100", undefined, locale, refresh);
  const lookups = useLookups(["accounts"], locale);
  const accountOptions = lookupOptions(lookups.accounts ?? [], locale);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "المصروفات", "Expenses")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "المصروفات التشغيلية وربطها بالحسابات", "Operating expenses and their account postings")}
        </p>
      </div>

      <DataPanel<ExpenseRow>
        title={L(locale, "سجل المصروفات", "Expense register")}
        description={L(
          locale,
          "يشمل مصروفات الصندوق المسجلة من نقطة البيع (للقراءة فقط).",
          "Includes cash disbursements recorded at the POS (read-only).",
        )}
        endpoint="/api/expenses?pageSize=100"
        locale={locale}
        rows={expenses.rows}
        loading={expenses.loading}
        reload={expenses.reload}
        refreshKey={refresh}
        canManage={canManage}
        columns={[
          {
            key: "expenseNumber",
            label: L(locale, "رقم المصروف", "Expense"),
            render: (row) => row.isCashOut
              ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">{L(locale, "صرف الصندوق", "Cash out")}</span>
              : row.expenseNumber,
          },
          { key: "expenseDate", label: L(locale, "التاريخ", "Date"), render: (row) => new Date(row.expenseDate).toLocaleDateString(numericLocale(locale)) },
          { key: "categoryName", label: L(locale, "التصنيف", "Category"), render: (row) => row.categoryName ?? "—" },
          { key: "vendor", label: L(locale, "الجهة", "Vendor"), render: (row) => row.vendor ?? "—" },
          { key: "amount", label: L(locale, "المبلغ", "Amount") },
          {
            key: "status",
            label: L(locale, "الحالة", "Status"),
            render: (row) => row.isCashOut
              ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">{L(locale, "قراءة فقط", "Read only")}</span>
              : statusBadge(row.status, locale),
          },
        ]}
        form={{
          title: L(locale, "مصروف جديد", "New expense"),
          editTitle: L(locale, "تعديل المصروف", "Edit expense"),
          endpoint: "/api/expenses",
          itemEndpoint: (row) => `/api/expenses/${row.id}`,
          itemMethod: "PATCH",
          enabled: canManage,
          initialFromRow: (row) => ({
            amount: String(row.amount),
            expenseDate: new Date(row.expenseDate).toISOString().slice(0, 10),
            categoryId: row.categoryId ?? "",
            accountId: row.accountId ?? "",
            vendor: row.vendor ?? "",
            taxAmount: String(row.taxAmount ?? 0),
            method: String(row.method ?? "CASH"),
            description: row.description ?? "",
          }),
          fields: [
            { name: "amount", label: L(locale, "المبلغ", "Amount"), type: "number", required: true },
            { name: "expenseDate", label: L(locale, "التاريخ", "Date"), type: "date" },
            { name: "accountId", label: L(locale, "الحساب", "Account"), type: "select", options: accountOptions },
            { name: "description", label: L(locale, "ملاحظات", "Notes"), type: "textarea" },
          ],
          build: (values) => ({
            amount: Number(values.amount),
            expenseDate: values.expenseDate ? new Date(String(values.expenseDate)).toISOString() : undefined,
            categoryId: String(values.categoryId || "") || null,
            accountId: String(values.accountId || "") || null,
            vendor: String(values.vendor || "") || undefined,
            taxAmount: Number(values.taxAmount || 0),
            method: String(values.method || "CASH"),
            description: String(values.description || "") || undefined,
          }),
        }}
        rowActions={[
          {
            label: L(locale, "تعديل", "Edit"),
            kind: "edit",
            tone: "secondary",
            requiresManage: true,
            visible: (row) => !row.isCashOut && row.status !== "VOID",
          },
          {
            label: L(locale, "حذف", "Delete"),
            kind: "delete",
            tone: "danger",
            requiresManage: true,
            visible: (row) => !row.isCashOut,
            confirm: L(locale, "هل تريد حذف هذا المصروف نهائياً؟", "Permanently delete this expense?"),
          },
          {
            label: L(locale, "إلغاء", "Void"),
            tone: "danger",
            requiresManage: true,
            visible: (row) => canManage && row.status === "POSTED" && !row.isCashOut,
            run: async (row, reloadFn, setError) => {
              if (!await confirm({ message: L(locale, "هل تريد إلغاء هذا المصروف؟", "Void this expense?"), tone: "danger" })) return;
              try {
                await apiSend(`/api/expenses/${row.id}`, "POST", {}, locale);
                await reloadFn();
                setRefresh((v) => v + 1);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            },
          },
        ]}
      />
    </div>
  );
}
