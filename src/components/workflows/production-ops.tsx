"use client";

import { useState, type FormEvent } from "react";
import {
  apiSend, DataPanel, FieldInput, L, lookupLabel, lookupOptions, numericLocale, statusBadge, useList, useLookups,
  type Field, type FormValues, type Locale,
} from "./shared";

type PlanRow = {
  id: string;
  code: string;
  productId: string;
  tableQuantity: string | number;
  pieceQuantity: string | number;
  kilogramQuantity: string | number;
  plannedDate: string;
  status: string;
  notes: string | null;
};
type BatchRow = {
  id: string;
  batchNumber: string;
  productId: string;
  warehouseId: string;
  sourceWarehouseId: string | null;
  planId: string | null;
  plannedQuantity: string | number;
  actualQuantity: string | number | null;
  rejectedQuantity: string | number | null;
  expiryDate: string | null;
  notes: string | null;
  status: string;
  qualityApproved: boolean;
};

export function ProductionPage({ locale, canManage, canComplete }: { locale: Locale; canManage: boolean; canComplete: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const [selectedBatch, setSelectedBatch] = useState("");
  const plans = useList<PlanRow>("/api/production/plans", undefined, locale, refresh);
  const batches = useList<BatchRow>("/api/production/batches", undefined, locale, refresh);
  const lookups = useLookups(["products", "warehouses", "employees"], locale);
  const productOptions = lookupOptions(lookups.products ?? [], locale);
  const warehouseOptions = lookupOptions(lookups.warehouses ?? [], locale);

  const reloadAll = async () => {
    await Promise.all([plans.reload(), batches.reload()]);
    setRefresh((v) => v + 1);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "الإنتاج", "Production")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "خطط الإنتاج، دفعات التحضير، واعتماد الجودة", "Production plans, batches and quality approval")}
        </p>
      </div>

      <DataPanel<PlanRow>
        title={L(locale, "خطط الإنتاج", "Production plans")}
        endpoint="/api/production/plans"
        locale={locale}
        rows={plans.rows}
        loading={plans.loading}
        reload={plans.reload}
        refreshKey={refresh}
        canManage={canManage}
        columns={[
          { key: "code", label: L(locale, "رقم الخطة", "Plan") },
          { key: "productId", label: L(locale, "المنتج", "Product"), render: (row) => lookupLabel(lookups.products ?? [], row.productId, locale) },
          { key: "tableQuantity", label: L(locale, "بالطاولة", "By table") },
          { key: "pieceQuantity", label: L(locale, "بالحبة", "By piece") },
          { key: "kilogramQuantity", label: L(locale, "بالكيلو", "By kilogram") },
          { key: "plannedDate", label: L(locale, "التاريخ", "Date"), render: (row) => new Date(row.plannedDate).toLocaleDateString(numericLocale(locale)) },
          { key: "status", label: L(locale, "الحالة", "Status"), render: (row) => statusBadge(row.status, locale) },
        ]}
        form={{
          title: L(locale, "خطة إنتاج جديدة", "New production plan"),
          editTitle: L(locale, "تعديل خطة الإنتاج", "Edit production plan"),
          endpoint: "/api/production/plans",
          itemEndpoint: (row) => `/api/production/plans/${row.id}`,
          itemMethod: "PATCH",
          enabled: canManage,
          initialFromRow: (row) => ({
            productId: row.productId,
            tableQuantity: String(row.tableQuantity ?? 0),
            pieceQuantity: String(row.pieceQuantity ?? 0),
            kilogramQuantity: String(row.kilogramQuantity ?? 0),
            notes: row.notes ?? "",
          }),
          fields: [
            { name: "productId", label: L(locale, "المنتج", "Product"), type: "select", required: true, options: productOptions },
            { name: "tableQuantity", label: L(locale, "الكمية بالطاولة", "Quantity by table"), type: "number", hint: L(locale, "اختياري — يُافترض صفر إذا تُرك فارغاً", "Optional — defaults to 0 if left empty") },
            { name: "pieceQuantity", label: L(locale, "الكمية بالحبة", "Quantity by piece"), type: "number", hint: L(locale, "اختياري — تُستخدم للتكلفة والمخزون", "Optional — used for costing and inventory") },
            { name: "kilogramQuantity", label: L(locale, "الكمية بالكيلو", "Quantity by kilogram"), type: "number", hint: L(locale, "اختياري — يُافترض صفر إذا تُرك فارغاً", "Optional — defaults to 0 if left empty") },
            { name: "notes", label: L(locale, "ملاحظات", "Notes"), type: "textarea" },
          ],
          build: (values) => ({
            productId: String(values.productId),
            tableQuantity: Number(values.tableQuantity || 0),
            pieceQuantity: Number(values.pieceQuantity || 0),
            kilogramQuantity: Number(values.kilogramQuantity || 0),
            notes: String(values.notes || "") || undefined,
          }),
        }}
        rowActions={[
          {
            label: L(locale, "تعديل", "Edit"),
            kind: "edit",
            tone: "secondary",
            requiresManage: true,
            visible: (row) => row.status === "PLANNED",
          },
          {
            label: L(locale, "حذف", "Delete"),
            kind: "delete",
            tone: "danger",
            requiresManage: true,
            visible: (row) => row.status === "PLANNED",
            confirm: L(locale, "هل تريد حذف خطة الإنتاج نهائياً؟", "Permanently delete this production plan?"),
          },
          {
            label: L(locale, "اعتماد", "Approve"),
            tone: "primary",
            requiresManage: true,
            visible: (row) => canManage && row.status !== "APPROVED",
            run: async (row, reload, setError) => {
              try {
                await apiSend("/api/production/plans", "PATCH", { planId: row.id }, locale);
                await reload();
                setRefresh((v) => v + 1);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            },
          },
        ]}
      />

      <DataPanel<BatchRow>
        title={L(locale, "دفعات الإنتاج", "Production batches")}
        endpoint="/api/production/batches"
        locale={locale}
        rows={batches.rows}
        loading={batches.loading}
        reload={batches.reload}
        refreshKey={refresh}
        canManage={canManage}
        columns={[
          { key: "batchNumber", label: L(locale, "رقم الدفعة", "Batch") },
          { key: "productId", label: L(locale, "المنتج", "Product"), render: (row) => lookupLabel(lookups.products ?? [], row.productId, locale) },
          { key: "plannedQuantity", label: L(locale, "المخطط", "Planned") },
          { key: "actualQuantity", label: L(locale, "الفعلي", "Actual"), render: (row) => row.actualQuantity ?? "—" },
          { key: "qualityApproved", label: L(locale, "الجودة", "Quality"), render: (row) => row.qualityApproved ? statusBadge("PASS", locale) : statusBadge("PENDING", locale) },
          { key: "status", label: L(locale, "الحالة", "Status"), render: (row) => statusBadge(row.status, locale) },
        ]}
        form={{
          title: L(locale, "دفعة جديدة", "New batch"),
          editTitle: L(locale, "تعديل الدفعة", "Edit batch"),
          endpoint: "/api/production/batches",
          itemEndpoint: (row) => `/api/workflow/production-batches/${row.id}`,
          itemMethod: "PATCH",
          enabled: canManage,
          initialFromRow: (row) => ({
            productId: row.productId,
            plannedQuantity: String(row.plannedQuantity),
            warehouseId: row.warehouseId,
            sourceWarehouseId: row.sourceWarehouseId ?? "",
            planId: row.planId ?? "",
            expiryDate: row.expiryDate ? new Date(row.expiryDate).toISOString().slice(0, 10) : "",
            notes: row.notes ?? "",
          }),
          fields: [
            { name: "productId", label: L(locale, "المنتج", "Product"), type: "select", required: true, options: productOptions },
            { name: "plannedQuantity", label: L(locale, "الكمية", "Quantity"), type: "number", required: true },
            { name: "warehouseId", label: L(locale, "مخزن المنتجات التامة", "Finished goods warehouse"), type: "select", required: true, options: warehouseOptions },
            { name: "sourceWarehouseId", label: L(locale, "مخزن المواد الخام", "Raw material warehouse"), type: "select", options: warehouseOptions },
            { name: "planId", label: L(locale, "الخطة", "Plan"), type: "select", options: plans.rows.map((plan) => ({ value: plan.id, label: `${plan.code} · ${plan.pieceQuantity}` })) },
            { name: "expiryDate", label: L(locale, "تاريخ الانتهاء", "Expiry date"), type: "date" },
            { name: "notes", label: L(locale, "ملاحظات", "Notes"), type: "textarea" },
          ],
          build: (values) => ({
            productId: String(values.productId),
            plannedQuantity: Number(values.plannedQuantity),
            warehouseId: String(values.warehouseId),
            sourceWarehouseId: String(values.sourceWarehouseId || "") || null,
            planId: String(values.planId || "") || null,
            expiryDate: values.expiryDate ? new Date(String(values.expiryDate)).toISOString() : null,
            notes: String(values.notes || "") || undefined,
          }),
        }}
        rowActions={[
          {
            label: L(locale, "تعديل", "Edit"),
            kind: "edit",
            tone: "secondary",
            requiresManage: true,
            visible: (row) => row.status === "PLANNED",
          },
          {
            label: L(locale, "حذف", "Delete"),
            kind: "delete",
            tone: "danger",
            requiresManage: true,
            visible: (row) => row.status === "PLANNED",
            confirm: L(locale, "هل تريد حذف دفعة الإنتاج نهائياً؟", "Permanently delete this production batch?"),
          },
          {
            label: L(locale, "إكمال", "Complete"),
            tone: "primary",
            requiresManage: true,
            visible: (row) => canComplete && row.status !== "COMPLETED",
            run: (row) => setSelectedBatch(row.id),
          },
        ]}
      />

      {canComplete ? <BatchCompletionForm locale={locale} batchId={selectedBatch} batches={batches.rows} onBatchChange={setSelectedBatch} onDone={async () => {
        setSelectedBatch("");
        await reloadAll();
      }} /> : null}
    </div>
  );
}

function BatchCompletionForm({
  locale,
  batchId,
  batches,
  onBatchChange,
  onDone,
}: {
  locale: Locale;
  batchId: string;
  batches: BatchRow[];
  onBatchChange: (id: string) => void;
  onDone: () => Promise<void>;
}) {
  const [actual, setActual] = useState("");
  const [rejected, setRejected] = useState("0");
  const [waste, setWaste] = useState("0");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fields: Field[] = [
    { name: "batchId", label: L(locale, "الدفعة", "Batch"), type: "select", required: true, options: batches.filter((b) => b.status !== "COMPLETED").map((b) => ({ value: b.id, label: `${b.batchNumber} · ${b.plannedQuantity}` })) },
    { name: "actualQuantity", label: L(locale, "الكمية الجيدة", "Good quantity"), type: "number", required: true },
    { name: "rejectedQuantity", label: L(locale, "الكمية المرفوضة", "Rejected quantity"), type: "number", defaultValue: "0" },
    { name: "wasteQuantity", label: L(locale, "الهدر", "Waste"), type: "number", defaultValue: "0" },
  ];
  const values: FormValues = { batchId, actualQuantity: actual, rejectedQuantity: rejected, wasteQuantity: waste };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiSend(`/api/production/batches/${batchId}/complete`, "POST", {
        actualQuantity: Number(actual),
        rejectedQuantity: Number(rejected || 0),
        wasteQuantity: Number(waste || 0),
      }, locale);
      setActual("");
      setRejected("0");
      setWaste("0");
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
        <h3 className="text-sm font-bold">{L(locale, "إكمال دفعة الإنتاج", "Complete production batch")}</h3>
        <p className="muted mt-1 text-xs">
          {L(locale, "يتطلب إكمال الدفعة وجود فحص جودة ناجح وخصوص المواد من المخزون.", "Completion requires a passing QC inspection and consumes raw materials.")}
        </p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FieldInput field={fields[0]} onChange={(value) => { setSelectedBatchFromForm(String(value)); }} value={batchId} />
        <FieldInput field={fields[1]} onChange={(value) => setActual(String(value))} value={actual} />
        <FieldInput field={fields[2]} onChange={(value) => setRejected(String(value))} value={rejected} />
        <FieldInput field={fields[3]} onChange={(value) => setWaste(String(value))} value={waste} />
      </div>
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={saving || !batchId || !actual} type="submit">
          {saving ? L(locale, "جارٍ الحفظ...", "Saving...") : L(locale, "إكمال الدفعة", "Complete batch")}
        </button>
      </div>
    </form>
  );

  function setSelectedBatchFromForm(id: string) {
    // The parent owns the selected batch so table actions and this form stay in sync.
    onBatchChange(id);
  }
}
