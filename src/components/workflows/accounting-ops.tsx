"use client";

import { useState } from "react";
import { useDialog } from "@/components/ui/dialog";
import {
  apiSend, DataPanel, L, lookupOptions, numericLocale, statusBadge, useList, useLookups, type Locale,
} from "./shared";

type JournalRow = {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  status: string;
  lines: { id: string; accountId: string; debit: string | number; credit: string | number; account: { code: string; nameAr: string; nameEn: string } | null }[];
};
type JournalLine = { key: string; accountId: string; debit: string; credit: string; memo: string };

export function AccountingPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const { confirm } = useDialog();
  const [refresh, setRefresh] = useState(0);
  const entries = useList<JournalRow>("/api/accounting?pageSize=100", undefined, locale, refresh);
  const accounts = useLookups(["accounts"], locale);
  const accountOptions = lookupOptions(accounts.accounts ?? [], locale);
  const [lines, setLines] = useState<JournalLine[]>([
    { key: crypto.randomUUID(), accountId: "", debit: "0", credit: "0", memo: "" },
    { key: crypto.randomUUID(), accountId: "", debit: "0", credit: "0", memo: "" },
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "المحاسبة", "Accounting")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "القيود اليومية، دليل الحسابات، وعكس القيود", "Journal entries, chart of accounts and reversals")}
        </p>
      </div>

      <DataPanel<JournalRow>
        title={L(locale, "القيود اليومية", "Journal entries")}
        endpoint="/api/accounting?pageSize=100"
        locale={locale}
        rows={entries.rows}
        loading={entries.loading}
        reload={entries.reload}
        refreshKey={refresh}
        canManage={canManage}
        columns={[
          { key: "entryNumber", label: L(locale, "رقم القيد", "Entry") },
          { key: "date", label: L(locale, "التاريخ", "Date"), render: (row) => new Date(row.date).toLocaleDateString(numericLocale(locale)) },
          { key: "description", label: L(locale, "البيان", "Description") },
          { key: "debit", label: L(locale, "مدين", "Debit"), render: (row) => row.lines.reduce((sum, line) => sum + Number(line.debit), 0).toFixed(2) },
          { key: "credit", label: L(locale, "دائن", "Credit"), render: (row) => row.lines.reduce((sum, line) => sum + Number(line.credit), 0).toFixed(2) },
          { key: "status", label: L(locale, "الحالة", "Status"), render: (row) => statusBadge(row.status, locale) },
        ]}
        form={{
          title: L(locale, "قيد يومية جديد", "New journal entry"),
          endpoint: "/api/accounting",
          enabled: canManage,
          fields: [
            { name: "description", label: L(locale, "البيان", "Description"), required: true },
            { name: "date", label: L(locale, "التاريخ", "Date"), type: "date" },
          ],
          extra: () => <JournalLinesEditor lines={lines} onChange={setLines} locale={locale} accountOptions={accountOptions} />,
          build: (values) => ({
            description: String(values.description),
            date: values.date ? new Date(String(values.date)).toISOString() : undefined,
            lines: lines.filter((line) => line.accountId).map((line) => ({
              accountId: line.accountId,
              debit: Number(line.debit || 0),
              credit: Number(line.credit || 0),
              memo: line.memo || undefined,
            })),
          }),
          afterSave: async () => setLines([
            { key: crypto.randomUUID(), accountId: "", debit: "0", credit: "0", memo: "" },
            { key: crypto.randomUUID(), accountId: "", debit: "0", credit: "0", memo: "" },
          ]),
        }}
        rowActions={[
          {
            label: L(locale, "عكس القيد", "Reverse"),
            tone: "danger",
            requiresManage: true,
            visible: (row) => canManage && row.status === "POSTED",
            run: async (row, reloadFn, setError) => {
              if (!await confirm({ message: L(locale, "هل تريد عكس هذا القيد؟", "Reverse this journal entry?"), tone: "danger" })) return;
              try {
                await apiSend(`/api/accounting/${row.id}/reverse`, "POST", {}, locale);
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

function JournalLinesEditor({
  lines,
  onChange,
  locale,
  accountOptions,
}: {
  lines: JournalLine[];
  onChange: (lines: JournalLine[]) => void;
  locale: Locale;
  accountOptions: { value: string; label: string }[];
}) {
  function update(key: string, patch: Partial<JournalLine>) {
    onChange(lines.map((line) => line.key === key ? { ...line, ...patch } : line));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{L(locale, "بنود القيد", "Journal lines")}</h4>
        <button
          className="btn btn-secondary text-xs"
          onClick={() => onChange([...lines, { key: crypto.randomUUID(), accountId: "", debit: "0", credit: "0", memo: "" }])}
          type="button"
        >
          + {L(locale, "سطر", "Line")}
        </button>
      </div>
      {lines.map((line, index) => (
        <div className="grid gap-2 rounded-lg border border-[var(--border)] p-2 sm:grid-cols-[2fr_1fr_1fr_1.5fr_auto]" key={line.key}>
          <select className="input" onChange={(event) => update(line.key, { accountId: event.target.value })} value={line.accountId}>
            <option value="">{L(locale, "اختر الحساب", "Select account")}</option>
            {accountOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input className="input" min="0" onChange={(event) => update(line.key, { debit: event.target.value })} placeholder={L(locale, "مدين", "Debit")} step="any" type="number" value={line.debit} />
          <input className="input" min="0" onChange={(event) => update(line.key, { credit: event.target.value })} placeholder={L(locale, "دائن", "Credit")} step="any" type="number" value={line.credit} />
          <input className="input" onChange={(event) => update(line.key, { memo: event.target.value })} placeholder={L(locale, "ملاحظة", "Memo")} value={line.memo} />
          <button className="btn btn-danger text-xs" onClick={() => onChange(lines.filter((entry) => entry.key !== line.key))} type="button">×</button>
          <span className="muted self-center text-[11px]">#{index + 1}</span>
        </div>
      ))}
    </div>
  );
}
