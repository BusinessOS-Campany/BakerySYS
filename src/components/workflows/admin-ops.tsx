"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  apiFetch, apiSend, DataPanel, FieldInput, L, lookupOptions, numericLocale, type Field, type FormValues, type Locale,
} from "./shared";

type UserRow = {
  id: string;
  email: string;
  phone: string | null;
  nameAr: string;
  nameEn: string;
  locale: string;
  active: boolean;
  lastLoginAt: string | null;
};
type UserRoleRow = { id: string; userId: string; roleId: string; branchId: string | null };
type RoleRow = { id: string; code: string; nameAr: string; nameEn: string; isSystem: boolean; permissionCodes: string[] };
type UsersPayload = {
  users: UserRow[];
  userRoles: UserRoleRow[];
  branches: { id: string; nameAr: string; nameEn: string }[];
  roles: RoleRow[];
  permissions: string[];
};
type RolesPayload = { items: RoleRow[]; availablePermissions: string[] };
type SettingsPayload = {
  tenant: {
    id: string; slug: string; nameAr: string; nameEn: string; currencyCode: string;
    decimalPlaces: number; locale: string; timezone: string; taxEnabled: boolean;
    taxRate: string | number; invoicePrefix: string;
  };
  settings: { id: string; key: string; value: unknown }[];
  branches: { id: string; code: string; nameAr: string; nameEn: string; active: boolean }[];
};

export function UsersPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const [payload, setPayload] = useState<UsersPayload | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      setPayload(await apiFetch<UsersPayload>("/api/users", locale));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  useEffect(() => { void load(); }, [locale, refresh]);

  const roleOptions = lookupOptions(payload?.roles ?? [], locale);
  const branchOptions = lookupOptions(payload?.branches ?? [], locale);
  const userRoles = payload?.userRoles ?? [];
  const selectedRoleIds = (userId: string) => userRoles.filter((row) => row.userId === userId && !row.branchId).map((row) => row.roleId);
  const selectedBranchIds = (userId: string) => userRoles.filter((row) => row.userId === userId && row.branchId).map((row) => row.branchId ?? "");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "المستخدمون والصلاحيات", "Users & permissions")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "إدارة الحسابات والأدوار ونطاق الفروع", "Manage accounts, roles and branch scope")}
        </p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <DataPanel<UserRow>
        title={L(locale, "المستخدمون", "Users")}
        locale={locale}
        rows={payload?.users ?? []}
        loading={!payload}
        reload={async () => { await load(); setRefresh((v) => v + 1); }}
        refreshKey={refresh}
        canManage={canManage}
        columns={[
          { key: "nameEn", label: L(locale, "الاسم", "Name"), render: (row) => locale === "ar" ? row.nameAr : row.nameEn },
          { key: "email", label: L(locale, "البريد", "Email") },
          { key: "phone", label: L(locale, "الهاتف", "Phone"), render: (row) => row.phone ?? "—" },
          { key: "locale", label: L(locale, "اللغة", "Language") },
          { key: "active", label: L(locale, "الحالة", "Status"), render: (row) => row.active ? L(locale, "نشط", "Active") : L(locale, "معطل", "Inactive") },
          { key: "lastLoginAt", label: L(locale, "آخر دخول", "Last login"), render: (row) => row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString(numericLocale(locale)) : "—" },
        ]}
        form={{
          title: L(locale, "مستخدم جديد", "New user"),
          endpoint: "/api/users",
          enabled: canManage,
          fields: [
            { name: "nameAr", label: L(locale, "الاسم (عربي)", "Name (Arabic)"), required: true },
            { name: "nameEn", label: L(locale, "الاسم (إنجليزي)", "Name (English)"), required: true },
            { name: "email", label: L(locale, "البريد", "Email"), type: "text", required: true },
            { name: "phone", label: L(locale, "الهاتف", "Phone") },
            { name: "password", label: L(locale, "كلمة المرور", "Password"), required: true },
            { name: "locale", label: L(locale, "اللغة", "Language"), type: "select", defaultValue: "ar", options: [
              { value: "ar", label: "العربية" }, { value: "en", label: "English" },
            ] },
          ],
          extra: (values, setValue) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <MultiSelect label={L(locale, "الأدوار", "Roles")} options={roleOptions} value={(values.roleIds as unknown as string[]) ?? []} onChange={(next) => setValue("roleIds", next as never)} />
              <MultiSelect label={L(locale, "الفروع", "Branches")} options={branchOptions} value={(values.branchIds as unknown as string[]) ?? []} onChange={(next) => setValue("branchIds", next as never)} />
            </div>
          ),
          build: (values) => ({
            nameAr: String(values.nameAr),
            nameEn: String(values.nameEn),
            email: String(values.email),
            phone: String(values.phone || "") || undefined,
            password: String(values.password),
            locale: values.locale === "en" ? "en" : "ar",
            roleIds: (values.roleIds as unknown as string[]) ?? [],
            branchIds: (values.branchIds as unknown as string[]) ?? [],
            active: true,
          }),
          afterSave: async () => { await load(); },
        }}
        rowActions={[
          {
            label: L(locale, "تعديل", "Edit"),
            tone: "secondary",
            requiresManage: true,
            run: (row) => setEditing(row),
          },
        ]}
      />

      {canManage && editing ? (
        <UserEditor
          locale={locale}
          user={editing}
          roleIds={selectedRoleIds(editing.id)}
          branchIds={selectedBranchIds(editing.id)}
          roleOptions={roleOptions}
          branchOptions={branchOptions}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); setRefresh((v) => v + 1); }}
        />
      ) : null}

      <RolesPanel locale={locale} canManage={canManage} refresh={refresh} />
    </div>
  );
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-[var(--text-muted)]">{label}</div>
      <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
        {options.length === 0 ? <div className="muted text-xs">—</div> : null}
        {options.map((option) => (
          <label className="flex items-center gap-2 text-xs" key={option.value}>
            <input
              checked={value.includes(option.value)}
              onChange={(event) => onChange(event.target.checked ? [...value, option.value] : value.filter((id) => id !== option.value))}
              type="checkbox"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function UserEditor({
  locale,
  user,
  roleIds: initialRoles,
  branchIds: initialBranches,
  roleOptions,
  branchOptions,
  onClose,
  onSaved,
}: {
  locale: Locale;
  user: UserRow;
  roleIds: string[];
  branchIds: string[];
  roleOptions: { value: string; label: string }[];
  branchOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>({
    nameAr: user.nameAr, nameEn: user.nameEn, phone: user.phone ?? "", locale: user.locale,
    active: user.active, password: "", roleIds: initialRoles as never, branchIds: initialBranches as never,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fields: Field[] = [
    { name: "nameAr", label: L(locale, "الاسم (عربي)", "Name (Arabic)") },
    { name: "nameEn", label: L(locale, "الاسم (إنجليزي)", "Name (English)") },
    { name: "phone", label: L(locale, "الهاتف", "Phone") },
    { name: "password", label: L(locale, "كلمة مرور جديدة", "New password") },
    { name: "locale", label: L(locale, "اللغة", "Language"), type: "select", options: [
      { value: "ar", label: "العربية" }, { value: "en", label: "English" },
    ] },
    { name: "active", label: L(locale, "نشط", "Active"), type: "checkbox" },
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiSend(`/api/users/${user.id}`, "PATCH", {
        nameAr: String(values.nameAr), nameEn: String(values.nameEn), phone: String(values.phone || "") || null,
        locale: values.locale === "en" ? "en" : "ar", active: Boolean(values.active),
        password: String(values.password || "") || undefined,
        roleIds: (values.roleIds as unknown as string[]) ?? [],
        branchIds: (values.branchIds as unknown as string[]) ?? [],
      }, locale);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card space-y-3 p-4" onSubmit={(event) => void submit(event)}>
      <h3 className="text-sm font-bold">{L(locale, "تعديل المستخدم", "Edit user")} · {user.email}</h3>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <FieldInput key={field.name} field={field} onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))} value={values[field.name] ?? ""} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MultiSelect label={L(locale, "الأدوار", "Roles")} options={roleOptions} value={(values.roleIds as unknown as string[]) ?? []} onChange={(next) => setValues((current) => ({ ...current, roleIds: next as never }))} />
        <MultiSelect label={L(locale, "الفروع", "Branches")} options={branchOptions} value={(values.branchIds as unknown as string[]) ?? []} onChange={(next) => setValues((current) => ({ ...current, branchIds: next as never }))} />
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={onClose} type="button">{L(locale, "إلغاء", "Cancel")}</button>
        <button className="btn btn-primary" disabled={saving} type="submit">{L(locale, "حفظ", "Save")}</button>
      </div>
    </form>
  );
}

function RolesPanel({ locale, canManage, refresh }: { locale: Locale; canManage: boolean; refresh: number }) {
  const [payload, setPayload] = useState<RolesPayload | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    try { setPayload(await apiFetch<RolesPayload>("/api/roles", locale)); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };
  useEffect(() => { void load(); }, [locale, refresh]);

  return (
    <div className="space-y-3">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <DataPanel<RoleRow>
        title={L(locale, "الأدوار", "Roles")}
        locale={locale}
        rows={payload?.items ?? []}
        loading={!payload}
        reload={load}
        canManage={canManage}
        columns={[
          { key: "code", label: L(locale, "الرمز", "Code") },
          { key: "nameEn", label: L(locale, "الاسم", "Name"), render: (row) => locale === "ar" ? row.nameAr : row.nameEn },
          { key: "permissionCodes", label: L(locale, "الصلاحيات", "Permissions"), render: (row) => row.permissionCodes.length },
          { key: "isSystem", label: L(locale, "النوع", "Type"), render: (row) => row.isSystem ? L(locale, "نظام", "System") : L(locale, "مخصص", "Custom") },
        ]}
        form={{
          title: L(locale, "دور جديد", "New role"),
          endpoint: "/api/roles",
          enabled: canManage,
          fields: [
            { name: "code", label: L(locale, "الرمز", "Code"), required: true },
            { name: "nameAr", label: L(locale, "الاسم (عربي)", "Name (Arabic)"), required: true },
            { name: "nameEn", label: L(locale, "الاسم (إنجليزي)", "Name (English)"), required: true },
            { name: "description", label: L(locale, "الوصف", "Description"), type: "textarea" },
          ],
          extra: () => (
            <MultiSelect
              label={L(locale, "الصلاحيات", "Permissions")}
              options={(payload?.availablePermissions ?? []).map((code) => ({ value: code, label: code }))}
              value={permissions}
              onChange={setPermissions}
            />
          ),
          build: (values) => ({
            code: String(values.code).toUpperCase().replace(/\s+/g, "_"),
            nameAr: String(values.nameAr), nameEn: String(values.nameEn),
            description: String(values.description || "") || undefined,
            permissionCodes: permissions,
          }),
          afterSave: async () => { setPermissions([]); await load(); },
        }}
      />
    </div>
  );
}

export function SettingsPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [values, setValues] = useState<FormValues>({});
  const [systemValues, setSystemValues] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const payload = await apiFetch<SettingsPayload>("/api/settings", locale);
      setData(payload);
      setValues({
        nameAr: payload.tenant.nameAr, nameEn: payload.tenant.nameEn,
        currencyCode: payload.tenant.currencyCode, decimalPlaces: String(payload.tenant.decimalPlaces),
        locale: payload.tenant.locale, timezone: payload.tenant.timezone,
        taxEnabled: payload.tenant.taxEnabled, taxRate: String(payload.tenant.taxRate),
        invoicePrefix: payload.tenant.invoicePrefix,
      });
      const next: Record<string, string> = {};
      for (const setting of payload.settings) next[setting.key] = typeof setting.value === "string" ? setting.value : JSON.stringify(setting.value ?? "");
      setSystemValues(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  useEffect(() => { void load(); }, [locale]);

  const tenantFields: Field[] = [
    { name: "nameAr", label: L(locale, "اسم المنشأة (عربي)", "Tenant name (Arabic)") },
    { name: "nameEn", label: L(locale, "اسم المنشأة (إنجليزي)", "Tenant name (English)") },
    { name: "currencyCode", label: L(locale, "العملة", "Currency") },
    { name: "decimalPlaces", label: L(locale, "الكسور العشرية", "Decimal places"), type: "number" },
    { name: "locale", label: L(locale, "اللغة الافتراضية", "Default locale"), type: "select", options: [
      { value: "ar", label: "العربية" }, { value: "en", label: "English" },
    ] },
    { name: "timezone", label: L(locale, "المنطقة الزمنية", "Timezone") },
    { name: "taxEnabled", label: L(locale, "تفعيل الضريبة", "Tax enabled"), type: "checkbox" },
    { name: "taxRate", label: L(locale, "نسبة الضريبة", "Tax rate"), type: "number" },
    { name: "invoicePrefix", label: L(locale, "بادئة الفواتير", "Invoice prefix") },
  ];

  async function saveTenant(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    try {
      await apiSend("/api/settings", "PATCH", {
        nameAr: String(values.nameAr), nameEn: String(values.nameEn), currencyCode: String(values.currencyCode),
        decimalPlaces: Number(values.decimalPlaces), locale: values.locale === "en" ? "en" : "ar",
        timezone: String(values.timezone), taxEnabled: Boolean(values.taxEnabled), taxRate: Number(values.taxRate),
        invoicePrefix: String(values.invoicePrefix),
      }, locale);
      setMessage(L(locale, "تم حفظ إعدادات المنشأة", "Tenant settings saved"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveSystem(key: string) {
    setError(""); setMessage("");
    try {
      let parsed: unknown = systemValues[key];
      try { parsed = JSON.parse(systemValues[key]); } catch { /* keep raw string */ }
      await apiSend("/api/settings/system", "PUT", { key, value: parsed }, locale);
      setMessage(L(locale, "تم حفظ الإعداد", "Setting saved"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "الإعدادات", "Settings")}</h1>
        <p className="muted mt-1 text-sm">{L(locale, "إعدادات المنشأة والفروع والنظام", "Tenant, branch and system settings")}</p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}

      <form className="card space-y-4 p-4" onSubmit={(event) => void saveTenant(event)}>
        <h2 className="text-base font-bold">{L(locale, "بيانات المنشأة", "Tenant profile")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tenantFields.map((field) => (
            <FieldInput key={field.name} field={{ ...field, disabled: !canManage }} onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))} value={values[field.name] ?? ""} />
          ))}
        </div>
        {canManage ? <div className="flex justify-end"><button className="btn btn-primary" type="submit">{L(locale, "حفظ الإعدادات", "Save settings")}</button></div> : null}
      </form>

      <section className="card overflow-hidden">
        <h2 className="border-b border-[var(--border)] p-4 text-base font-bold">{L(locale, "الفروع", "Branches")}</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>{L(locale, "الرمز", "Code")}</th>
              <th>{L(locale, "الاسم", "Name")}</th>
              <th>{L(locale, "الحالة", "Status")}</th>
            </tr></thead>
            <tbody>
              {(data?.branches ?? []).map((branch) => (
                <tr key={branch.id}>
                  <td>{branch.code}</td>
                  <td>{locale === "ar" ? branch.nameAr : branch.nameEn}</td>
                  <td>{branch.active ? L(locale, "نشط", "Active") : L(locale, "معطل", "Inactive")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-base font-bold">{L(locale, "إعدادات النظام", "System settings")}</h2>
        {(data?.settings ?? []).map((setting) => (
          <div className="grid gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[1fr_2fr_auto]" key={setting.id}>
            <div className="self-center text-xs font-semibold">{setting.key}</div>
            <input className="input" disabled={!canManage} onChange={(event) => setSystemValues((current) => ({ ...current, [setting.key]: event.target.value }))} value={systemValues[setting.key] ?? ""} />
            <button className="btn btn-secondary" disabled={!canManage} onClick={() => void saveSystem(setting.key)} type="button">{L(locale, "حفظ", "Save")}</button>
          </div>
        ))}
        {!data?.settings.length ? <p className="muted text-sm">{L(locale, "لا توجد إعدادات إضافية", "No additional settings")}</p> : null}
      </section>
    </div>
  );
}
