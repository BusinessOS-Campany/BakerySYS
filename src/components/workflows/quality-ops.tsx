"use client";

import { useState } from "react";
import {
  apiFetch, DataPanel, FieldInput, L, statusBadge, useList, useLookups, lookupOptions, type Locale,
} from "./shared";

type InspectionRow = {
  id: string;
  checkType: string;
  referenceType: string;
  referenceId: string | null;
  result: string;
  checkedAt: string;
  actualResult: string | null;
  correctiveAction: string | null;
};
type TemperatureRow = {
  id: string;
  recordedAt: string;
  location: string | null;
  temperature: string | number;
  note: string | null;
};

export function QualityPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const inspections = useList<InspectionRow>("/api/quality", (value) => {
    if (value && typeof value === "object" && "inspections" in value) {
      return (value as { inspections?: InspectionRow[] }).inspections ?? [];
    }
    return [];
  }, locale, refresh);
  const temperatures = useList<TemperatureRow>("/api/quality", (value) => {
    if (value && typeof value === "object" && "temperatureLogs" in value) {
      return (value as { temperatureLogs?: TemperatureRow[] }).temperatureLogs ?? [];
    }
    return [];
  }, locale, refresh);
  const lookups = useLookups(["products", "warehouses"], locale);
  const batchLookups = useList<{ id: string; batchNumber: string }>("/api/production/batches", undefined, locale, refresh);
  const [referenceType, setReferenceType] = useState("BATCH");

  const referenceOptions = referenceType === "BATCH"
    ? batchLookups.rows.map((batch) => ({ value: batch.id, label: batch.batchNumber }))
    : lookupOptions(referenceType === "PRODUCT" ? lookups.products ?? [] : lookups.warehouses ?? [], locale);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "مراقبة الجودة", "Quality control")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "فحوص الاستلام والإنتاج ودرجات الحرارة", "Receiving and production inspections, temperature logs")}
        </p>
      </div>

      <DataPanel<InspectionRow>
        title={L(locale, "فحوص الجودة", "Quality inspections")}
        endpoint="/api/quality"
        locale={locale}
        rows={inspections.rows}
        loading={inspections.loading}
        reload={async () => { await Promise.all([inspections.reload(), temperatures.reload()]); setRefresh((v) => v + 1); }}
        refreshKey={refresh}
        canManage={canManage}
        columns={[
          { key: "checkedAt", label: L(locale, "التاريخ", "Date"), render: (row) => new Date(row.checkedAt).toLocaleString(locale) },
          { key: "checkType", label: L(locale, "نوع الفحص", "Check") },
          { key: "referenceType", label: L(locale, "المرجع", "Reference"), render: (row) => `${row.referenceType}${row.referenceId ? ` · ${String(row.referenceId).slice(0, 6)}` : ""}` },
          { key: "actualResult", label: L(locale, "النتيجة الفعلية", "Actual"), render: (row) => row.actualResult ?? "—" },
          { key: "result", label: L(locale, "الحكم", "Result"), render: (row) => statusBadge(row.result, locale) },
        ]}
        form={{
          title: L(locale, "فحص جديد", "New inspection"),
          endpoint: "/api/quality",
          enabled: canManage,
          fields: [
            { name: "checkType", label: L(locale, "نوع الفحص", "Check type"), required: true, placeholder: L(locale, "مثال: حسى/ميكروبيولوجي", "e.g. sensory/microbiological") },
            { name: "standard", label: L(locale, "المعيار", "Standard") },
            { name: "actualResult", label: L(locale, "النتيجة الفعلية", "Actual result") },
            { name: "result", label: L(locale, "الحكم", "Result"), type: "select", defaultValue: "PASS", options: [
              { value: "PASS", label: L(locale, "نجح", "Pass") },
              { value: "FAIL", label: L(locale, "رسب", "Fail") },
              { value: "PENDING", label: L(locale, "قيد الانتظار", "Pending") },
            ] },
            { name: "temperature", label: L(locale, "الحرارة (°C)", "Temperature (°C)"), type: "number" },
            { name: "notes", label: L(locale, "ملاحظات", "Notes"), type: "textarea" },
            { name: "correctiveAction", label: L(locale, "الإجراء التصحيحي", "Corrective action"), type: "textarea" },
          ],
          extra: (values, setValue) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldInput
                field={{ name: "referenceType", label: L(locale, "نوع المرجع", "Reference type"), type: "select", required: true, options: [
                  { value: "BATCH", label: L(locale, "دفعة إنتاج", "Production batch") },
                  { value: "RECEIPT", label: L(locale, "إيصال استلام", "Goods receipt") },
                  { value: "PRODUCT", label: L(locale, "منتج", "Product") },
                ] }}
                onChange={(value) => { setReferenceType(String(value)); setValue("referenceType", value); setValue("referenceId", ""); }}
                value={referenceType}
              />
              <FieldInput
                field={{ name: "referenceId", label: L(locale, "المرجع", "Reference"), type: "select", options: referenceOptions }}
                onChange={(value) => setValue("referenceId", value)}
                value={String(values.referenceId ?? "")}
              />
            </div>
          ),
          build: (values) => ({
            referenceType: String(values.referenceType || "BATCH"),
            referenceId: String(values.referenceId || "") || null,
            checkType: String(values.checkType),
            standard: String(values.standard || "") || undefined,
            actualResult: String(values.actualResult || "") || undefined,
            result: values.result === "FAIL" || values.result === "PENDING" ? String(values.result) : "PASS",
            temperature: values.temperature ? Number(values.temperature) : undefined,
            notes: String(values.notes || "") || undefined,
            correctiveAction: String(values.correctiveAction || "") || undefined,
          }),
          afterSave: async () => setReferenceType("BATCH"),
        }}
      />

      <DataPanel<TemperatureRow>
        title={L(locale, "سجل درجات الحرارة", "Temperature log")}
        endpoint="/api/quality"
        locale={locale}
        rows={temperatures.rows}
        loading={temperatures.loading}
        columns={[
          { key: "recordedAt", label: L(locale, "الوقت", "Time"), render: (row) => new Date(row.recordedAt).toLocaleString(locale) },
          { key: "location", label: L(locale, "الموقع", "Location"), render: (row) => row.location ?? "—" },
          { key: "temperature", label: L(locale, "الحرارة", "Temperature") },
          { key: "note", label: L(locale, "ملاحظة", "Note"), render: (row) => row.note ?? "—" },
        ]}
      />
    </div>
  );
}
