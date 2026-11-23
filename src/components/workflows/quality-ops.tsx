"use client";

import { useState } from "react";
import {
  apiFetch, DataPanel, FieldInput, L, statusBadge, useList, useLookups, lookupOptions, numericLocale, type Locale,
} from "./shared";

type InspectionRow = {
  id: string;
  checkType: string;
  referenceType: string;
  referenceId: string | null;
  result: string;
  checkedAt: string;
  standard: string | null;
  expectedValue: string | null;
  actualResult: string | null;
  temperature: string | number | null;
  notes: string | null;
  correctiveAction: string | null;
};
type TemperatureRow = {
  id: string;
  recordedAt: string;
  location: string;
  equipment: string | null;
  temperature: string | number;
  minAllowed: string | number | null;
  maxAllowed: string | number | null;
  ok: boolean;
  notes: string | null;
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
  const [referenceType, setReferenceType] = useState("RECEIPT");

  const referenceOptions = lookupOptions(
    referenceType === "PRODUCT" ? lookups.products ?? [] : lookups.warehouses ?? [], locale,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "مراقبة الجودة", "Quality control")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "فحوص الاستلام والمنتجات ودرجات الحرارة", "Receiving and product inspections, temperature logs")}
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
          { key: "checkedAt", label: L(locale, "التاريخ", "Date"), render: (row) => new Date(row.checkedAt).toLocaleString(numericLocale(locale)) },
          { key: "checkType", label: L(locale, "نوع الفحص", "Check") },
          { key: "referenceType", label: L(locale, "المرجع", "Reference"), render: (row) => `${row.referenceType}${row.referenceId ? ` · ${String(row.referenceId).slice(0, 6)}` : ""}` },
          { key: "actualResult", label: L(locale, "النتيجة الفعلية", "Actual"), render: (row) => row.actualResult ?? "—" },
          { key: "result", label: L(locale, "الحكم", "Result"), render: (row) => statusBadge(row.result, locale) },
        ]}
        form={{
          title: L(locale, "فحص جديد", "New inspection"),
          editTitle: L(locale, "تعديل الفحص", "Edit inspection"),
          endpoint: "/api/quality",
          itemEndpoint: (row) => `/api/workflow/quality-inspections/${row.id}`,
          itemMethod: "PATCH",
          enabled: canManage,
          initialFromRow: (row) => {
            setReferenceType(row.referenceType);
            return {
              checkType: row.checkType,
              standard: row.standard ?? "",
              actualResult: row.actualResult ?? "",
              expectedValue: row.expectedValue ?? "",
              result: row.result,
              temperature: row.temperature == null ? "" : String(row.temperature),
              notes: row.notes ?? "",
              correctiveAction: row.correctiveAction ?? "",
              referenceType: row.referenceType,
              referenceId: row.referenceId ?? "",
            };
          },
          fields: [
            { name: "checkType", label: L(locale, "نوع الفحص", "Check type"), required: true, placeholder: L(locale, "مثال: حسى/ميكروبيولوجي", "e.g. sensory/microbiological") },
            { name: "standard", label: L(locale, "المعيار", "Standard") },
            { name: "expectedValue", label: L(locale, "القيمة المتوقعة", "Expected value") },
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
            referenceType: String(values.referenceType || "RECEIPT"),
            referenceId: String(values.referenceId || "") || null,
            checkType: String(values.checkType),
            standard: String(values.standard || "") || undefined,
            expectedValue: String(values.expectedValue || "") || undefined,
            actualResult: String(values.actualResult || "") || undefined,
            result: values.result === "FAIL" || values.result === "PENDING" ? String(values.result) : "PASS",
            temperature: values.temperature ? Number(values.temperature) : undefined,
            notes: String(values.notes || "") || undefined,
            correctiveAction: String(values.correctiveAction || "") || undefined,
          }),
          afterSave: async () => setReferenceType("RECEIPT"),
        }}
        rowActions={[
          {
            label: L(locale, "تعديل", "Edit"),
            kind: "edit",
            tone: "secondary",
            requiresManage: true,
          },
          {
            label: L(locale, "حذف", "Delete"),
            kind: "delete",
            tone: "danger",
            requiresManage: true,
            confirm: L(locale, "هل تريد حذف هذا الفحص نهائياً؟", "Permanently delete this inspection?"),
          },
        ]}
      />

      <DataPanel<TemperatureRow>
        title={L(locale, "سجل درجات الحرارة", "Temperature log")}
        endpoint="/api/quality"
        locale={locale}
        rows={temperatures.rows}
        loading={temperatures.loading}
        reload={async () => { await temperatures.reload(); setRefresh((v) => v + 1); }}
        refreshKey={refresh}
        canManage={canManage}
        columns={[
          { key: "recordedAt", label: L(locale, "الوقت", "Time"), render: (row) => new Date(row.recordedAt).toLocaleString(numericLocale(locale)) },
          { key: "location", label: L(locale, "الموقع", "Location"), render: (row) => row.location ?? "—" },
          { key: "equipment", label: L(locale, "الجهاز", "Equipment"), render: (row) => row.equipment ?? "—" },
          { key: "temperature", label: L(locale, "الحرارة", "Temperature") },
          { key: "ok", label: L(locale, "الحالة", "Status"), render: (row) => statusBadge(row.ok ? "PASS" : "FAIL", locale) },
          { key: "notes", label: L(locale, "ملاحظة", "Note"), render: (row) => row.notes ?? "—" },
        ]}
        form={{
          title: L(locale, "قراءة حرارة جديدة", "New temperature reading"),
          editTitle: L(locale, "تعديل قراءة الحرارة", "Edit temperature reading"),
          endpoint: "/api/quality/temperature",
          itemEndpoint: (row) => `/api/workflow/temperature-logs/${row.id}`,
          itemMethod: "PATCH",
          enabled: canManage,
          initialFromRow: (row) => ({
            location: row.location,
            equipment: row.equipment ?? "",
            temperature: String(row.temperature),
            minAllowed: row.minAllowed == null ? "" : String(row.minAllowed),
            maxAllowed: row.maxAllowed == null ? "" : String(row.maxAllowed),
            notes: row.notes ?? "",
            recordedAt: new Date(row.recordedAt).toISOString().slice(0, 16),
          }),
          fields: [
            { name: "location", label: L(locale, "الموقع", "Location"), required: true },
            { name: "equipment", label: L(locale, "الجهاز", "Equipment") },
            { name: "temperature", label: L(locale, "الحرارة (°C)", "Temperature (°C)"), type: "number", required: true },
            { name: "minAllowed", label: L(locale, "الحد الأدنى", "Minimum"), type: "number" },
            { name: "maxAllowed", label: L(locale, "الحد الأعلى", "Maximum"), type: "number" },
            { name: "recordedAt", label: L(locale, "الوقت", "Time"), type: "datetime" },
            { name: "notes", label: L(locale, "ملاحظات", "Notes"), type: "textarea" },
          ],
          build: (values) => ({
            location: String(values.location),
            equipment: String(values.equipment || "") || undefined,
            temperature: Number(values.temperature),
            minAllowed: values.minAllowed ? Number(values.minAllowed) : undefined,
            maxAllowed: values.maxAllowed ? Number(values.maxAllowed) : undefined,
            recordedAt: values.recordedAt ? new Date(String(values.recordedAt)).toISOString() : undefined,
            notes: String(values.notes || "") || undefined,
          }),
        }}
        rowActions={[
          {
            label: L(locale, "تعديل", "Edit"),
            kind: "edit",
            tone: "secondary",
            requiresManage: true,
          },
          {
            label: L(locale, "حذف", "Delete"),
            kind: "delete",
            tone: "danger",
            requiresManage: true,
            confirm: L(locale, "هل تريد حذف قراءة الحرارة نهائياً؟", "Permanently delete this reading?"),
          },
        ]}
      />
    </div>
  );
}
