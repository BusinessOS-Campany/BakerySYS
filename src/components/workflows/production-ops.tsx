"use client";

import { useState, type FormEvent } from "react";
import {
  apiSend, DataPanel, FieldInput, L, lookupLabel, lookupOptions, statusBadge, useList, useLookups,
  type Field, type FormValues, type Locale,
} from "./shared";

type PlanRow = {
  id: string;
  planNumber: string;
  productId: string;
  plannedQuantity: string | number;
  plannedDate: string;
  priority: string;
  status: string;
};
type BatchRow = {
  id: string;
  batchNumber: string;
  productId: string;
  plannedQuantity: string | number;
  actualQuantity: string | number | null;
  rejectedQuantity: string | number | null;
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
          { key: "planNumber", label: L(locale, "رقم الخطة", "Plan") },
          { key: "productId", label: L(locale, "المنتج", "Product"), render: (row) => lookupLabel(lookups.products ?? [], row.productId, locale) },
          { key: "plannedQuantity", label: L(locale, "الكمية", "Quantity") },
          { key: "plannedDate", label: L(locale, "التاريخ", "Date"), render: (row) => new Date(row.plannedDate).toLocaleDateString(locale) },
          { key: "priority", label: L(locale, "الأولوية", "Priority") },
          { key: "status", label: L(locale, "الحالة", "Status"), render: (row) => statusBadge(row.status, locale) },
        ]}
        form={{
          title: L(locale, "خطة إنتاج جديدة", "New production plan"),
          endpoint: "/api/production/plans",
          enabled: canManage,
          fields: [
            { name: "productId", label: L(locale, "المنتج", "Product"), type: "select", required: true, options: productOptions },
            { name: "plannedQuantity", label: L(locale, "الكمية المخططة", "Planned quantity"), type: "number", required: true },
            { name: "plannedDate", label: L(locale, "تاريخ الإنتاج", "Production date"), type: "date", required: true },
            { name: "priority", label: L(locale, "الأولوية", "Priority"), type: "select", defaultValue: "NORMAL", options: [
              { value: "LOW", label: L(locale, "منخفضة", "Low") },
              { value: "NORMAL", label: L(locale, "عادية", "Normal") },
              { value: "HIGH", label: L(locale, "عالية", "High") },
            ] },
            { name: "notes", label: L(locale, "ملاحظات", "Notes"), type: "textarea" },
          ],
          build: (values) => ({
            productId: String(values.productId),
            plannedQuantity: Number(values.plannedQuantity),
            plannedDate: String(values.plannedDate),
            priority: String(values.priority || "NORMAL"),
            notes: String(values.notes || "") || undefined,
          }),
        }}
        rowActions={[
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
          endpoint: "/api/production/batches",
          enabled: canManage,
          fields: [
            { name: "productId", label: L(locale, "المنتج", "Product"), type: "select", required: true, options: productOptions },
            { name: "plannedQuantity", label: L(locale, "الكمية", "Quantity"), type: "number", required: true },
            { name: "warehouseId", label: L(locale, "مخزن المنتجات التامة", "Finished goods warehouse"), type: "select", required: true, options: warehouseOptions },
            { name: "sourceWarehouseId", label: L(locale, "مخزن المواد الخام", "Raw material warehouse"), type: "select", options: warehouseOptions },
            { name: "planId", label: L(locale, "الخطة", "Plan"), type: "select", options: plans.rows.map((plan) => ({ value: plan.id, label: `${plan.planNumber} · ${plan.plannedQuantity}` })) },
            { name: "notes", label: L(locale, "ملاحظات", "Notes"), type: "textarea" },
          ],
          build: (values) => ({
            productId: String(values.productId),
            plannedQuantity: Number(values.plannedQuantity),
            warehouseId: String(values.warehouseId),
            sourceWarehouseId: String(values.sourceWarehouseId || "") || null,
            planId: String(values.planId || "") || null,
            notes: String(values.notes || "") || undefined,
          }),
        }}
        rowActions={[
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
