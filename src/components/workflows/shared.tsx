"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDialog } from "@/components/ui/dialog";
import { formatDate, formatNumber, numericLocale, type Locale } from "@/lib/i18n/dictionary";

export type { Locale };
export { numericLocale };

export const L = (locale: Locale, ar: string, en: string) => (locale === "ar" ? ar : en);

type ApiErrorEnvelope = { error?: { message?: string; messageAr?: string } };

export async function apiFetch<T>(
  url: string,
  locale: Locale,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const envelope = (payload ?? {}) as ApiErrorEnvelope;
    const detail = locale === "ar"
      ? envelope.error?.messageAr ?? envelope.error?.message
      : envelope.error?.message ?? envelope.error?.messageAr;
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return payload as T;
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown,
  locale: Locale,
): Promise<T> {
  return apiFetch<T>(url, locale, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body ?? {}),
  });
}

export type Lookup = { id: string; code?: string | null; nameAr?: string | null; nameEn?: string | null };

export function useLookups(resources: string[], locale: Locale) {
  const [lookups, setLookups] = useState<Record<string, Lookup[]>>({});
  const key = resources.join("|");
  useEffect(() => {
    let active = true;
    void Promise.all(resources.map(async (resource) => {
      try {
        const payload = await apiFetch<{ items?: Lookup[] }>(`/api/resources/${resource}?pageSize=200`, locale);
        if (active) setLookups((current) => ({ ...current, [resource]: payload.items ?? [] }));
      } catch {
        // Lookup lists are best-effort; the form remains usable without them.
      }
    }));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, locale]);
  return lookups;
}

export function lookupOptions(lookups: Lookup[], locale: Locale): { value: string; label: string }[] {
  return lookups.map((item) => ({
    value: item.id,
    label: locale === "ar"
      ? item.nameAr ?? item.nameEn ?? item.code ?? item.id
      : item.nameEn ?? item.nameAr ?? item.code ?? item.id,
  }));
}

export function lookupLabel(lookups: Lookup[], id: unknown, locale: Locale): string {
  if (!id) return "—";
  const item = lookups.find((entry) => entry.id === id);
  if (!item) return String(id).slice(0, 8);
  return locale === "ar" ? item.nameAr ?? item.nameEn ?? item.code ?? item.id : item.nameEn ?? item.nameAr ?? item.code ?? item.id;
}

export type FieldType = "text" | "number" | "date" | "datetime" | "textarea" | "select" | "checkbox";
export type Field = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string | boolean;
  disabled?: boolean;
  hint?: string;
};

export type FormValues = Record<string, string | boolean>;

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
  const id = useId();
  const type = field.type ?? "text";
  if (type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm" htmlFor={id}>
        <input
          checked={Boolean(value)}
          className="h-4 w-4"
          id={id}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        {field.label}
      </label>
    );
  }
  const common = {
    className: "input",
    disabled: field.disabled,
    id,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    placeholder: field.placeholder,
    required: field.required,
    value: String(value ?? ""),
  };
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-[var(--text-muted)]" htmlFor={id}>{field.label}</label>
      {type === "textarea" ? (
        <textarea {...common} rows={3} />
      ) : type === "select" ? (
        <select {...common}>
          <option value="">—</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <input {...common} step={type === "number" ? "any" : undefined} type={type === "datetime" ? "datetime-local" : type === "date" ? "date" : type} />
      )}
      {field.hint ? <p className="muted text-[11px]">{field.hint}</p> : null}
    </div>
  );
}

export function useList<T>(
  endpoint: string | undefined,
  extract: ((payload: unknown) => T[]) | undefined,
  locale: Locale,
  refreshKey: string | number = 0,
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const extractRef = useRef(extract);
  extractRef.current = extract;
  const defaultExtract = useCallback((payload: unknown): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    if (payload && typeof payload === "object") {
      const candidate = (payload as { items?: unknown }).items;
      if (Array.isArray(candidate)) return candidate as T[];
    }
    return [];
  }, []);

  const load = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch<unknown>(endpoint, locale);
      setRows((extractRef.current ?? defaultExtract)(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : L(locale, "تعذر تحميل البيانات", "Unable to load data"));
    } finally {
      setLoading(false);
    }
  }, [defaultExtract, endpoint, locale]);

  useEffect(() => { void load(); }, [load, refreshKey]);
  return { rows, setRows, loading, error, setError, reload: load };
}

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
};

export type RowAction<T> = {
  label: string;
  /** Built-in actions handled by DataPanel; `run` is used for custom actions. */
  kind?: "edit" | "delete";
  run?: (row: T, reload: () => Promise<void>, setError: (message: string) => void) => void | Promise<void>;
  tone?: "primary" | "secondary" | "danger";
  requiresManage?: boolean;
  visible?: (row: T) => boolean;
  confirm?: string;
};

export type PanelForm<T = unknown> = {
  title: string;
  editTitle?: string;
  /** Create endpoint (defaults to the panel endpoint). */
  endpoint?: string;
  /** Edit/delete endpoint for a specific row. */
  itemEndpoint?: (row: T) => string;
  method?: "POST" | "PATCH" | "PUT";
  itemMethod?: "PATCH" | "PUT";
  fields: Field[];
  initial?: FormValues;
  /** Seed the form from an existing row when editing. */
  initialFromRow?: (row: T) => FormValues;
  extra?: (values: FormValues, setValue: (name: string, value: string | boolean) => void) => ReactNode;
  build: (values: FormValues, row: T | null) => unknown;
  submitLabel?: string;
  enabled?: boolean;
  afterSave?: (result: unknown, reload: () => Promise<void>) => void | Promise<void>;
};

function defaultValues(fields: Field[], initial?: FormValues): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    values[field.name] = initial?.[field.name] ?? field.defaultValue ?? (field.type === "checkbox" ? false : "");
  }
  return values;
}

export function DataPanel<T extends { id: string }>({
  title,
  description,
  endpoint,
  extract,
  columns,
  rows: controlledRows,
  loading: controlledLoading,
  reload: controlledReload,
  form,
  rowActions = [],
  canManage = true,
  locale,
  refreshKey = 0,
  emptyLabel,
}: {
  title: string;
  description?: string;
  endpoint?: string;
  extract?: (payload: unknown) => T[];
  columns: Column<T>[];
  rows?: T[];
  loading?: boolean;
  reload?: () => Promise<void>;
  form?: PanelForm<T>;
  rowActions?: RowAction<T>[];
  canManage?: boolean;
  locale: Locale;
  refreshKey?: string | number;
  emptyLabel?: string;
}) {
  const [internalRows, setInternalRows] = useState<T[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editingRow, setEditingRow] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<FormValues>(() => defaultValues(form?.fields ?? [], form?.initial));
  const { confirm } = useDialog();
  const hasControlledRows = controlledRows !== undefined;
  const extractRef = useRef(extract);
  extractRef.current = extract;

  const defaultExtract = useCallback((payload: unknown): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    if (payload && typeof payload === "object") {
      const candidate = (payload as { items?: unknown }).items;
      if (Array.isArray(candidate)) return candidate as T[];
    }
    return [];
  }, []);

  const load = useCallback(async () => {
    if (!endpoint || hasControlledRows) return;
    setInternalLoading(true);
    setError("");
    try {
      const payload = await apiFetch<unknown>(endpoint, locale);
      setInternalRows((extractRef.current ?? defaultExtract)(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : L(locale, "تعذر تحميل البيانات", "Unable to load data"));
    } finally {
      setInternalLoading(false);
    }
  }, [defaultExtract, endpoint, hasControlledRows, locale]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  function openForm(row: T | null) {
    if (!form) return;
    setEditingRow(row);
    setValues(row && form.initialFromRow
      ? form.initialFromRow(row)
      : defaultValues(form.fields, form.initial));
    setError("");
    setEditing(true);
  }

  function closeForm() {
    setEditing(false);
    setEditingRow(null);
  }

  const rows = controlledRows ?? internalRows;
  const loading = controlledLoading ?? internalLoading;
  const reload = controlledReload ?? load;

  function setValue(name: string, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const row = editingRow;
      const url = row ? form.itemEndpoint?.(row) : (form.endpoint ?? endpoint);
      if (!url) throw new Error(L(locale, "عنوان الحفظ غير محدد", "Save endpoint is not configured"));
      const result = await apiSend<unknown>(
        url,
        row ? (form.itemMethod ?? "PATCH") : (form.method ?? "POST"),
        form.build(values, row),
        locale,
      );
      closeForm();
      await reload();
      await form.afterSave?.(result, reload);
    } catch (err) {
      setError(err instanceof Error ? err.message : L(locale, "تعذر حفظ البيانات", "Unable to save"));
    } finally {
      setSaving(false);
    }
  }

  async function builtInDelete(row: T, confirmMessage?: string) {
    if (!form?.itemEndpoint) return;
    if (!await confirm({ message: confirmMessage ?? L(locale, "هل تريد حذف هذا السجل؟", "Delete this record?"), tone: "danger" })) return;
    setError("");
    try {
      await apiFetch(form.itemEndpoint(row), locale, { method: "DELETE" });
      await reload();
      await form.afterSave?.(null, reload);
    } catch (err) {
      setError(err instanceof Error ? err.message : L(locale, "تعذر حذف السجل", "Unable to delete record"));
    }
  }

  const showForm = Boolean(form && form.enabled !== false && canManage);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] p-4">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          {description ? <p className="muted mt-1 text-xs">{description}</p> : null}
        </div>
        <div className="flex gap-2">
          {showForm ? (
            <button className="btn btn-primary" onClick={() => openForm(null)} type="button">
              <Plus className="h-4 w-4" /> {form?.submitLabel ?? L(locale, "إضافة", "Add")}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {editing && form ? (
        <form className="m-4 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4" onSubmit={(event) => void submit(event)}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editingRow ? (form.editTitle ?? form.title) : form.title}</h3>
            <button className="rounded p-1 hover:bg-[var(--surface)]" onClick={closeForm} type="button">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {form.fields.map((field) => (
              <FieldInput key={field.name} field={field} onChange={(value) => setValue(field.name, value)} value={values[field.name] ?? ""} />
            ))}
          </div>
          {form.extra?.(values, setValue)}
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={closeForm} type="button">
              {L(locale, "إلغاء", "Cancel")}
            </button>
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? L(locale, "جارٍ الحفظ...", "Saving...") : L(locale, "حفظ", "Save")}
            </button>
          </div>
        </form>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => <th key={column.key}>{column.label}</th>)}
              {rowActions.length > 0 ? <th>{L(locale, "إجراءات", "Actions")}</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td className="muted p-6 text-center" colSpan={columns.length + (rowActions.length ? 1 : 0)}>
                {L(locale, "جارٍ التحميل...", "Loading...")}
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="muted p-6 text-center" colSpan={columns.length + (rowActions.length ? 1 : 0)}>
                {emptyLabel ?? L(locale, "لا توجد بيانات", "No records")}
              </td></tr>
            ) : rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render
                      ? column.render(row)
                      : (() => {
                          const value = (row as Record<string, unknown>)[column.key];
                          if (value === null || value === undefined || value === "") return "—";
                          if (typeof value === "number") return formatNumber(value, locale, 2);
                          if (typeof value === "boolean") return value ? "✓" : "—";
                          if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDate(value, locale);
                          return String(value);
                        })()}
                  </td>
                ))}
                {rowActions.length > 0 ? (
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {rowActions
                        .filter((action) => !action.requiresManage || canManage)
                        .filter((action) => !action.visible || action.visible(row))
                        .map((action) => {
                          const handler = action.kind === "edit"
                            ? () => openForm(row)
                            : action.kind === "delete"
                              ? () => void builtInDelete(row, action.confirm)
                              : () => { void action.run?.(row, reload, setError); };
                          return (
                            <button
                              className={cn("btn text-xs", action.tone === "danger" ? "btn-danger" : action.tone === "primary" ? "btn-primary" : "btn-secondary")}
                              key={action.label}
                              onClick={handler}
                              type="button"
                            >
                              {action.label}
                            </button>
                          );
                        })}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ActionForm({
  title,
  description,
  fields,
  build,
  endpoint,
  method = "POST",
  locale,
  onSuccess,
  submitLabel,
  initial,
  extra,
  disabled,
}: {
  title: string;
  description?: string;
  fields: Field[];
  build: (values: FormValues) => unknown;
  endpoint: string | ((values: FormValues) => string);
  method?: "POST" | "PATCH" | "PUT";
  locale: Locale;
  onSuccess?: (result: unknown) => void | Promise<void>;
  submitLabel?: string;
  initial?: FormValues;
  extra?: (values: FormValues, setValue: (name: string, value: string | boolean) => void) => ReactNode;
  disabled?: boolean;
}) {
  const [values, setValues] = useState<FormValues>(() => defaultValues(fields, initial));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function setValue(name: string, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const target = typeof endpoint === "function" ? endpoint(values) : endpoint;
      const result = await apiSend<unknown>(target, method, build(values), locale);
      await onSuccess?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : L(locale, "تعذر حفظ البيانات", "Unable to save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card space-y-3 p-4" onSubmit={(event) => void submit(event)}>
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        {description ? <p className="muted mt-1 text-xs">{description}</p> : null}
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <FieldInput key={field.name} field={field} onChange={(value) => setValue(field.name, value)} value={values[field.name] ?? ""} />
        ))}
      </div>
      {extra?.(values, setValue)}
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={disabled || saving} type="submit">
          {saving ? L(locale, "جارٍ الحفظ...", "Saving...") : submitLabel ?? L(locale, "تنفيذ", "Submit")}
        </button>
      </div>
    </form>
  );
}

export type LineItem = {
  key: string;
  ingredientId?: string;
  productId?: string;
  name?: string;
  quantity: string;
  unitPrice: string;
  unitId?: string;
  saleItemId?: string;
};

export function LineItemsEditor({
  lines,
  onChange,
  locale,
  itemOptions,
  includePrice = true,
  includeUnit = false,
  unitOptions = [],
}: {
  lines: LineItem[];
  onChange: (lines: LineItem[]) => void;
  locale: Locale;
  itemOptions: { value: string; label: string }[];
  includePrice?: boolean;
  includeUnit?: boolean;
  unitOptions?: { value: string; label: string }[];
}) {
  function update(key: string, patch: Partial<LineItem>) {
    onChange(lines.map((line) => line.key === key ? { ...line, ...patch } : line));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{L(locale, "بنود المستند", "Document lines")}</h4>
        <button
          className="btn btn-secondary text-xs"
          onClick={() => onChange([...lines, { key: crypto.randomUUID(), quantity: "1", unitPrice: "0" }])}
          type="button"
        >
          <Plus className="h-3 w-3" /> {L(locale, "بند", "Line")}
        </button>
      </div>
      {lines.map((line, index) => (
        <div className="grid gap-2 rounded-lg border border-[var(--border)] p-2 sm:grid-cols-[2fr_1fr_1fr_auto]" key={line.key}>
          <select
            className="input"
            onChange={(event) => update(line.key, {
              ingredientId: event.target.value || undefined,
              productId: event.target.value || undefined,
              name: event.target.value || undefined,
            })}
            value={line.ingredientId ?? line.productId ?? line.name ?? ""}
          >
            <option value="">{L(locale, "اختر الصنف", "Select item")}</option>
            {itemOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input
            className="input"
            min="0"
            onChange={(event) => update(line.key, { quantity: event.target.value })}
            placeholder={L(locale, "الكمية", "Quantity")}
            step="any"
            type="number"
            value={line.quantity}
          />
          {includePrice ? (
            <input
              className="input"
              min="0"
              onChange={(event) => update(line.key, { unitPrice: event.target.value })}
              placeholder={L(locale, "السعر", "Price")}
              step="any"
              type="number"
              value={line.unitPrice}
            />
          ) : <span />}
          <button
            className="btn btn-danger text-xs"
            onClick={() => onChange(lines.filter((entry) => entry.key !== line.key))}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
          {includeUnit ? (
            <select
              className="input sm:col-span-3"
              onChange={(event) => update(line.key, { unitId: event.target.value })}
              value={line.unitId ?? ""}
            >
              <option value="">{L(locale, "الوحدة", "Unit")}</option>
              {unitOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : null}
          <span className="muted self-center text-[11px]">#{index + 1}</span>
        </div>
      ))}
    </div>
  );
}

export function iso(value: string | boolean | undefined): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function num(value: string | boolean | undefined): number {
  const parsed = Number(typeof value === "string" ? value : 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function statusBadge(status: unknown, locale: Locale) {
  const text = String(status ?? "—");
  const tone = /COMPLETED|PAID|POSTED|PASS|APPROVED|ACTIVE/.test(text)
    ? "bg-emerald-100 text-emerald-700"
    : /FAIL|CANCELLED|VOID|REVERSED|REJECTED/.test(text)
      ? "bg-red-100 text-red-700"
      : "bg-amber-100 text-amber-700";
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tone)}>{locale === "ar" ? text.replaceAll("_", " ") : text.replaceAll("_", " ")}</span>;
}
