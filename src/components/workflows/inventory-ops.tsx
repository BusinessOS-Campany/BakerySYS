"use client";

import { useEffect, useMemo, useState } from "react";
import {
  apiFetch, apiSend, DataPanel, FieldInput, L, LineItemsEditor, lookupLabel, lookupOptions,
  numericLocale, statusBadge, useList, useLookups, type Field, type LineItem, type Locale,
} from "./shared";

type StockRow = {
  id: string;
  itemType: "RAW" | "FINISHED";
  itemId: string;
  warehouseId: string;
  quantity: string | number;
};
type CountRow = {
  id: string;
  countNumber: string;
  itemType: string;
  status: string;
  countDate: string;
  lines: { id: string; itemId: string; expected: string | number; counted: string | number; difference: string | number }[];
};
type TransferRow = {
  id: string;
  transferNumber: string;
  itemType: string;
  itemId: string;
  fromWarehouse: string;
  toWarehouse: string;
  quantity: string | number;
  status: string;
};
type AdjustmentRow = {
  id: string;
  reason: string;
  itemType: string;
  itemId: string;
  quantity: string | number;
  createdAt: string;
};
type LowStockRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  current: string | number;
  minimum: string | number;
};
type InventoryPayload = {
  ingredientStocks: { id: string; ingredientId: string; warehouseId: string; quantity: string | number }[];
  finishedStocks: { id: string; productId: string; warehouseId: string; quantity: string | number }[];
  ingredientLots: { id: string }[];
  finishedLots: { id: string }[];
  adjustments: AdjustmentRow[];
  lowStock: Omit<LowStockRow, "id">[];
  ingredients: { id: string; nameAr: string; nameEn: string; sku: string }[];
  products: { id: string; nameAr: string; nameEn: string; sku: string }[];
  warehouses: { id: string; nameAr: string; nameEn: string }[];
};

export function InventoryPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<InventoryPayload | null>(null);
  const [error, setError] = useState("");
  const [countLines, setCountLines] = useState<LineItem[]>([]);
  const [movementType, setMovementType] = useState<"RAW" | "FINISHED">("RAW");
  const lookups = useLookups(["warehouses", "ingredients", "products"], locale);
  const warehouseOptions = lookupOptions(lookups.warehouses ?? [], locale);
  const ingredientOptions = lookupOptions(lookups.ingredients ?? [], locale);
  const productOptions = lookupOptions(lookups.products ?? [], locale);

  useEffect(() => {
    let active = true;
    void apiFetch<InventoryPayload>("/api/inventory", locale)
      .then((payload) => { if (active) setData(payload); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : String(err)); });
    return () => { active = false; };
  }, [locale, refresh]);

  const reload = async () => setRefresh((v) => v + 1);
  const ingredientLookup = data?.ingredients ?? lookups.ingredients ?? [];
  const productLookup = data?.products ?? lookups.products ?? [];
  const warehouseLookup = data?.warehouses ?? lookups.warehouses ?? [];

  const stockRows = useMemo<StockRow[]>(() => [
    ...(data?.ingredientStocks ?? []).map((stock) => ({
      id: `raw-${stock.id}`, itemType: "RAW" as const, itemId: stock.ingredientId,
      warehouseId: stock.warehouseId, quantity: stock.quantity,
    })),
    ...(data?.finishedStocks ?? []).map((stock) => ({
      id: `finished-${stock.id}`, itemType: "FINISHED" as const, itemId: stock.productId,
      warehouseId: stock.warehouseId, quantity: stock.quantity,
    })),
  ], [data]);

  const counts = useList<CountRow>("/api/inventory/counts", undefined, locale, refresh);
  const transfers = useList<TransferRow>("/api/inventory/transfers", undefined, locale, refresh);
  const movements = useList<{ id: string; createdAt: string; reference: string; quantity: string | number; direction: string }>(
    `/api/inventory/movements?type=${movementType}`, undefined, locale, `${refresh}-${movementType}`,
  );

  const itemOptions = (type: unknown) => (type === "RAW" ? ingredientOptions : productOptions);
  const itemName = (type: unknown, id: unknown) => type === "RAW"
    ? lookupLabel(ingredientLookup, id, locale)
    : lookupLabel(productLookup, id, locale);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "المخزون", "Inventory")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "الأرصدة، الجرد، التحويلات، وحركة المواد", "Balances, counts, transfers and stock movements")}
        </p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title={L(locale, "أصناف المواد الخام", "Raw materials")} value={String(data?.ingredientStocks.length ?? 0)} />
        <SummaryCard title={L(locale, "أصناف المنتجات التامة", "Finished goods")} value={String(data?.finishedStocks.length ?? 0)} />
        <SummaryCard title={L(locale, "دفعات المواد الخام", "Ingredient lots")} value={String(data?.ingredientLots.length ?? 0)} />
        <SummaryCard title={L(locale, "تنبيهات النقص", "Low stock alerts")} value={String(data?.lowStock.length ?? 0)} tone="text-[var(--danger)]" />
      </div>

      <DataPanel<StockRow>
        title={L(locale, "أرصدة المخزون", "Stock balances")}
        locale={locale}
        rows={stockRows}
        loading={!data}
        reload={reload}
        columns={[
          { key: "itemType", label: L(locale, "النوع", "Type"), render: (row) => row.itemType === "RAW" ? L(locale, "خام", "Raw") : L(locale, "تام", "Finished") },
          { key: "itemId", label: L(locale, "الصنف", "Item"), render: (row) => itemName(row.itemType, row.itemId) },
          { key: "warehouseId", label: L(locale, "المخزن", "Warehouse"), render: (row) => lookupLabel(warehouseLookup, row.warehouseId, locale) },
          { key: "quantity", label: L(locale, "الكمية", "Quantity") },
        ]}
      />

      <DataPanel<LowStockRow>
        title={L(locale, "تنبيهات الحد الأدنى", "Minimum stock alerts")}
        locale={locale}
        rows={(data?.lowStock ?? []).map((row, index) => ({ ...row, id: `low-${index}` }))}
        loading={!data}
        columns={[
          { key: "nameAr", label: L(locale, "الصنف", "Item"), render: (row) => locale === "ar" ? row.nameAr : row.nameEn },
          { key: "current", label: L(locale, "الحالي", "Current") },
          { key: "minimum", label: L(locale, "الحد الأدنى", "Minimum") },
        ]}
      />

      <DataPanel<AdjustmentRow>
        title={L(locale, "تعديلات المخزون", "Stock adjustments")}
        locale={locale}
        rows={data?.adjustments ?? []}
        loading={!data}
        reload={reload}
        canManage={canManage}
        columns={[
          { key: "createdAt", label: L(locale, "التاريخ", "Date"), render: (row) => new Date(row.createdAt).toLocaleString(numericLocale(locale)) },
          { key: "itemType", label: L(locale, "النوع", "Type") },
          { key: "itemId", label: L(locale, "الصنف", "Item"), render: (row) => itemName(row.itemType, row.itemId) },
          { key: "quantity", label: L(locale, "الكمية", "Quantity"), render: (row) => Number(row.quantity) > 0 ? `+${row.quantity}` : String(row.quantity) },
          { key: "reason", label: L(locale, "السبب", "Reason") },
        ]}
        form={{
          title: L(locale, "تعديل جديد", "New adjustment"),
          endpoint: "/api/inventory/adjustments",
          enabled: canManage,
          fields: [
            { name: "warehouseId", label: L(locale, "المخزن", "Warehouse"), type: "select", required: true, options: warehouseOptions },
            { name: "itemType", label: L(locale, "نوع الصنف", "Item type"), type: "select", required: true, defaultValue: "RAW", options: [
              { value: "RAW", label: L(locale, "مادة خام", "Raw material") },
              { value: "FINISHED", label: L(locale, "منتج تام", "Finished good") },
            ] },
            { name: "quantity", label: L(locale, "الكمية (+ أو -)", "Quantity (+/-)"), type: "number", required: true },
            { name: "reason", label: L(locale, "السبب", "Reason"), required: true },
          ],
          extra: (values, setValue) => (
            <FieldInput
              field={{ name: "itemId", label: L(locale, "الصنف", "Item"), type: "select", required: true, options: itemOptions(values.itemType) }}
              onChange={(value) => setValue("itemId", value)}
              value={String(values.itemId ?? "")}
            />
          ),
          build: (values) => ({
            warehouseId: String(values.warehouseId),
            itemType: values.itemType === "FINISHED" ? "FINISHED" : "RAW",
            itemId: String(values.itemId || ""),
            quantity: Number(values.quantity),
            reason: String(values.reason),
          }),
        }}
      />

      <DataPanel<CountRow>
        title={L(locale, "جرد المخزون", "Stock counts")}
        endpoint="/api/inventory/counts"
        locale={locale}
        rows={counts.rows}
        loading={counts.loading}
        reload={async () => { await counts.reload(); await reload(); }}
        canManage={canManage}
        columns={[
          { key: "countNumber", label: L(locale, "رقم الجرد", "Count") },
          { key: "countDate", label: L(locale, "التاريخ", "Date"), render: (row) => new Date(row.countDate).toLocaleDateString(numericLocale(locale)) },
          { key: "itemType", label: L(locale, "النوع", "Type") },
          { key: "lines", label: L(locale, "البنود", "Lines"), render: (row) => row.lines?.length ?? 0 },
          { key: "status", label: L(locale, "الحالة", "Status"), render: (row) => statusBadge(row.status, locale) },
        ]}
        form={{
          title: L(locale, "جرد جديد", "New stock count"),
          endpoint: "/api/inventory/counts",
          enabled: canManage,
          fields: [
            { name: "warehouseId", label: L(locale, "المخزن", "Warehouse"), type: "select", required: true, options: warehouseOptions },
            { name: "itemType", label: L(locale, "نوع الصنف", "Item type"), type: "select", required: true, defaultValue: "RAW", options: [
              { value: "RAW", label: L(locale, "مادة خام", "Raw material") },
              { value: "FINISHED", label: L(locale, "منتج تام", "Finished good") },
            ] },
            { name: "countDate", label: L(locale, "تاريخ الجرد", "Count date"), type: "date" },
            { name: "notes", label: L(locale, "ملاحظات", "Notes"), type: "textarea" },
          ],
          extra: (values) => (
            <LineItemsEditor
              itemOptions={itemOptions(values.itemType)}
              lines={countLines}
              locale={locale}
              includePrice={false}
              onChange={setCountLines}
            />
          ),
          build: (values) => ({
            warehouseId: String(values.warehouseId),
            itemType: values.itemType === "FINISHED" ? "FINISHED" : "RAW",
            countDate: values.countDate ? new Date(String(values.countDate)).toISOString() : undefined,
            notes: String(values.notes || "") || undefined,
            lines: countLines.filter((line) => line.ingredientId || line.productId).map((line) => ({
              itemId: String(line.ingredientId ?? line.productId),
              counted: Number(line.quantity),
            })),
          }),
          afterSave: async () => setCountLines([]),
        }}
        rowActions={[
          {
            label: L(locale, "اعتماد الجرد", "Post count"),
            tone: "primary",
            requiresManage: true,
            visible: (row) => canManage && row.status === "DRAFT",
            run: async (row, reloadFn, setFormError) => {
              try {
                await apiSend(`/api/inventory/counts/${row.id}/post`, "POST", {}, locale);
                await reloadFn();
                await reload();
              } catch (err) {
                setFormError(err instanceof Error ? err.message : String(err));
              }
            },
          },
        ]}
      />

      <DataPanel<TransferRow>
        title={L(locale, "تحويلات المخزون", "Warehouse transfers")}
        endpoint="/api/inventory/transfers"
        locale={locale}
        rows={transfers.rows}
        loading={transfers.loading}
        reload={async () => { await transfers.reload(); await reload(); }}
        canManage={canManage}
        columns={[
          { key: "transferNumber", label: L(locale, "رقم التحويل", "Transfer") },
          { key: "itemType", label: L(locale, "النوع", "Type") },
          { key: "itemId", label: L(locale, "الصنف", "Item"), render: (row) => itemName(row.itemType, row.itemId) },
          { key: "fromWarehouse", label: L(locale, "من", "From"), render: (row) => lookupLabel(warehouseLookup, row.fromWarehouse, locale) },
          { key: "toWarehouse", label: L(locale, "إلى", "To"), render: (row) => lookupLabel(warehouseLookup, row.toWarehouse, locale) },
          { key: "quantity", label: L(locale, "الكمية", "Quantity") },
        ]}
        form={{
          title: L(locale, "تحويل جديد", "New transfer"),
          endpoint: "/api/inventory/transfers",
          enabled: canManage,
          fields: [
            { name: "fromWarehouse", label: L(locale, "من المخزن", "From warehouse"), type: "select", required: true, options: warehouseOptions },
            { name: "toWarehouse", label: L(locale, "إلى المخزن", "To warehouse"), type: "select", required: true, options: warehouseOptions },
            { name: "itemType", label: L(locale, "نوع الصنف", "Item type"), type: "select", required: true, defaultValue: "RAW", options: [
              { value: "RAW", label: L(locale, "مادة خام", "Raw material") },
              { value: "FINISHED", label: L(locale, "منتج تام", "Finished good") },
            ] },
            { name: "quantity", label: L(locale, "الكمية", "Quantity"), type: "number", required: true },
            { name: "notes", label: L(locale, "ملاحظات", "Notes"), type: "textarea" },
          ],
          extra: (values, setValue) => (
            <FieldInput
              field={{ name: "itemId", label: L(locale, "الصنف", "Item"), type: "select", required: true, options: itemOptions(values.itemType) }}
              onChange={(value) => setValue("itemId", value)}
              value={String(values.itemId ?? "")}
            />
          ),
          build: (values) => ({
            fromWarehouse: String(values.fromWarehouse),
            toWarehouse: String(values.toWarehouse),
            itemType: values.itemType === "FINISHED" ? "FINISHED" : "RAW",
            itemId: String(values.itemId || ""),
            quantity: Number(values.quantity),
            notes: String(values.notes || "") || undefined,
          }),
        }}
      />

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4">
          <h2 className="text-base font-bold">{L(locale, "حركة المخزون", "Stock ledger")}</h2>
          <select
            className="input w-auto"
            onChange={(event) => setMovementType(event.target.value === "FINISHED" ? "FINISHED" : "RAW")}
            value={movementType}
          >
            <option value="RAW">{L(locale, "المواد الخام", "Raw materials")}</option>
            <option value="FINISHED">{L(locale, "المنتجات التامة", "Finished goods")}</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{L(locale, "التاريخ", "Date")}</th>
                <th>{L(locale, "المرجع", "Reference")}</th>
                <th>{L(locale, "الاتجاه", "Direction")}</th>
                <th>{L(locale, "الكمية", "Quantity")}</th>
              </tr>
            </thead>
            <tbody>
              {movements.rows.slice(0, 50).map((movement) => (
                <tr key={movement.id}>
                  <td>{new Date(movement.createdAt).toLocaleString(numericLocale(locale))}</td>
                  <td>{movement.reference || "—"}</td>
                  <td>{movement.direction}</td>
                  <td>{String(movement.quantity)}</td>
                </tr>
              ))}
              {movements.rows.length === 0 ? (
                <tr><td className="muted p-6 text-center" colSpan={4}>{L(locale, "لا توجد حركة", "No movements")}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: string; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="muted text-xs">{title}</div>
      <div className={`mt-2 text-xl font-bold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
