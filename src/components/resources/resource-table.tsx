"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { CustomerStatement } from "@/components/customers/customer-statement";
import type { ResourceConfig, ResourceField } from "@/lib/resources/config";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber, translate, type Locale } from "@/lib/i18n/dictionary";

type Row = Record<string, unknown> & { id: string };
type Option = { id: string; code?: string; nameAr?: string; nameEn?: string };

function fieldOptions(field: ResourceField, options: Record<string, Option[]>): Option[] {
  const all = field.optionResource ? (options[field.optionResource] ?? []) : [];
  if (!field.optionCodes?.length) return all;
  return all.filter((option) => field.optionCodes!.includes(String(option.code)));
}

export function ResourceTable({
  config,
  locale,
  canManage,
  currency,
  decimalPlaces,
}: {
  config: ResourceConfig;
  locale: Locale;
  canManage: boolean;
  currency: string;
  decimalPlaces: number;
}) {
  const t = useCallback((key: string) => translate(locale, key), [locale]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlSearch = searchParams.get("search") ?? "";
  const statementId = config.key === "customers" ? searchParams.get("statement") : null;
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [search, setSearch] = useState(urlSearch);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [saving, setSaving] = useState(false);
  const pageSize = 25;

  useEffect(() => {
    setSearchInput(urlSearch);
    setSearch(urlSearch);
    setPage(1);
  }, [urlSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      const response = await fetch(`/api/resources/${config.key}?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.[locale === "ar" ? "messageAr" : "message"] ?? t("common.error"));
      setRows(payload.items ?? []);
      setTotal(Number(payload.total ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [config.key, locale, page, search, t]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const sources = [...new Set(config.fields.map((f) => f.optionResource).filter((v): v is string => Boolean(v)))];
    void Promise.all(sources.map(async (resource) => {
      try {
        const response = await fetch(`/api/resources/${resource}?pageSize=200`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        setOptions((current) => ({ ...current, [resource]: payload.items ?? [] }));
      } catch { /* options are best-effort */ }
    }));
  }, [config.fields]);

  const columns = useMemo(() => config.fields.filter((f) => f.list), [config.fields]);
  const pages = Math.max(Math.ceil(total / pageSize), 1);

  function optionLabelFor(field: ResourceField, value: unknown) {
    const option = fieldOptions(field, options).find((o) => o.id === value);
    if (!option) return String(value ?? "").slice(0, 8);
    const override = option.code ? field.optionLabels?.[String(option.code)] : undefined;
    if (override) return override[locale];
    return locale === "ar" ? (option.nameAr ?? option.code ?? option.id) : (option.nameEn ?? option.code ?? option.id);
  }

  function renderCell(field: ResourceField, row: Row) {
    const value = row[field.name];
    if (field.optionResource && value) return optionLabelFor(field, value);
    if (field.options) {
      const opt = field.options.find((o) => o.value === value);
      return opt ? opt.label[locale] : String(value ?? "—");
    }
    if (field.type === "boolean") {
      return (
        <span className={cn("rounded-full px-2 py-0.5 text-xs", value ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>
          {value ? t("common.active") : t("common.inactive")}
        </span>
      );
    }
    if (field.type === "number") return formatNumber(value as number, locale, decimalPlaces);
    if (field.type === "date" && value) return formatDate(String(value), locale);
    return String(value ?? "—");
  }

  async function remove(row: Row) {
    if (!window.confirm(t("common.confirmDelete"))) return;
    setError("");
    const response = await fetch(`/api/resources/${config.key}/${row.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload?.error?.[locale === "ar" ? "messageAr" : "message"] ?? t("common.error"));
      return;
    }
    await load();
  }

  function openStatement(row: Row) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("statement", row.id);
    router.push(`${pathname}?${params.toString()}`);
  }

  function closeStatement() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("statement");
    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }

  const statementCustomer = statementId ? rows.find((row) => row.id === statementId) ?? ({ id: statementId } as Row) : null;

  if (statementCustomer) {
    return (
      <CustomerStatement
        customer={statementCustomer}
        currency={currency}
        decimalPlaces={decimalPlaces}
        locale={locale}
        onBack={closeStatement}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{config.title[locale]}</h1>
          <p className="muted mt-1 text-sm">{total} {t("common.nameEn") === "Name (English)" ? "records" : "سجل"}</p>
        </div>
        <div className="flex gap-2">
          {canManage ? (
            <button className="btn btn-primary" onClick={() => setEditing("new")} type="button">
              <Plus className="h-4 w-4" /> {t("action.new")}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--border)] p-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[var(--text-muted)]" />
            <input
              className="input ps-9"
              placeholder={t("action.search")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((field) => <th key={field.name}>{field.label[locale]}</th>)}
                {canManage ? <th>{t("common.actions")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td className="muted p-6 text-center" colSpan={columns.length + 1}>{t("common.loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="muted p-6 text-center" colSpan={columns.length + 1}>{t("common.empty")}</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((field) => <td key={field.name}>{renderCell(field, row)}</td>)}
                  {canManage ? (
                    <td>
                      <div className="flex gap-1">
                        {config.key === "customers" ? (
                          <button className="rounded p-1.5 text-[var(--primary)] hover:bg-[var(--surface-muted)]" onClick={() => openStatement(row)} title={t("statement.action")} type="button">
                            <FileText className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button className="rounded p-1.5 hover:bg-[var(--surface-muted)]" onClick={() => setEditing(row)} title={t("action.edit")} type="button">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1.5 text-[var(--danger)] hover:bg-red-50" onClick={() => void remove(row)} title={t("action.delete")} type="button">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--border)] p-3 text-xs">
            <span className="muted">{page} / {pages}</span>
            <div className="flex gap-2">
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">‹</button>
              <button className="btn btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} type="button">›</button>
            </div>
          </div>
        ) : null}
      </div>

      {editing ? (
        <ResourceForm
          config={config}
          locale={locale}
          row={editing === "new" ? null : editing}
          options={options}
          saving={saving}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
          setSaving={setSaving}
          onError={setError}
        />
      ) : null}

    </div>
  );
}

function ResourceForm({
  config,
  locale,
  row,
  options,
  saving,
  onClose,
  onSaved,
  setSaving,
  onError,
}: {
  config: ResourceConfig;
  locale: Locale;
  row: Row | null;
  options: Record<string, Option[]>;
  saving: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  setSaving: (value: boolean) => void;
  onError: (value: string) => void;
}) {
  const t = useCallback((key: string) => translate(locale, key), [locale]);
  const visibleFields = config.fields.filter((field) => !field.hidden);
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const initial: Record<string, string | boolean> = {};
    for (const field of config.fields) {
      const raw = row?.[field.name];
      if (field.type === "boolean") initial[field.name] = raw === undefined ? Boolean(field.defaultValue) : Boolean(raw);
      else if (raw instanceof Date) initial[field.name] = raw.toISOString().slice(0, 10);
      else initial[field.name] = raw === null || raw === undefined ? String(field.defaultValue ?? "") : String(raw);
    }
    return initial;
  });

  function setValue(name: string, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    onError("");
    try {
      const response = await fetch(row ? `/api/resources/${config.key}/${row.id}` : `/api/resources/${config.key}`, {
        method: row ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.[locale === "ar" ? "messageAr" : "message"] ?? t("common.error"));
      await onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true">
      <form className="card my-6 w-full max-w-2xl p-5" onSubmit={submit}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{row ? t("action.edit") : t("action.new")} · {config.title[locale]}</h2>
          <button className="rounded p-1 hover:bg-[var(--surface-muted)]" onClick={onClose} type="button"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleFields.map((field) => (
            <label key={field.name} className={cn("block text-xs font-medium", field.type === "textarea" && "sm:col-span-2")}>
              {field.label[locale]}{field.required ? " *" : ""}
              {field.type === "boolean" ? (
                <span className="mt-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={Boolean(values[field.name])}
                    onChange={(e) => setValue(field.name, e.target.checked)}
                  />
                  <span className="muted font-normal">{field.label[locale]}</span>
                </span>
              ) : field.type === "select" ? (
                <select
                  className="input mt-1"
                  value={String(values[field.name] ?? "")}
                  required={field.required}
                  onChange={(e) => setValue(field.name, e.target.value)}
                >
                  <option value="">—</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>{option.label[locale]}</option>
                  ))}
                  {field.optionResource ? fieldOptions(field, options).map((option) => {
                    const override = option.code ? field.optionLabels?.[String(option.code)] : undefined;
                    const label = override ? override[locale] : locale === "ar" ? (option.nameAr ?? option.code ?? option.id) : (option.nameEn ?? option.code ?? option.id);
                    return <option key={option.id} value={option.id}>{label}</option>;
                  }) : null}
                </select>
              ) : field.type === "textarea" ? (
                <textarea className="input mt-1" rows={3} value={String(values[field.name] ?? "")} onChange={(e) => setValue(field.name, e.target.value)} />
              ) : (
                <input
                  className="input mt-1"
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  step={field.type === "number" ? "any" : undefined}
                  required={field.required}
                  value={String(values[field.name] ?? "")}
                  onChange={(e) => setValue(field.name, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose} type="button">{t("action.cancel")}</button>
          <button className="btn btn-primary" disabled={saving} type="submit">{saving ? t("common.loading") : t("action.save")}</button>
        </div>
      </form>
    </div>
  );
}
