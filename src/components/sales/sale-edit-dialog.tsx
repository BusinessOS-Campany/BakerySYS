"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { L, apiFetch, apiSend, type Locale } from "@/components/workflows/shared";
import { formatMoney } from "@/lib/i18n/dictionary";

type DetailItem = {
  id: string;
  nameSnapshot: string;
  quantity: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
};
type SaleDetail = {
  sale: {
    id: string;
    invoiceNumber: string;
    total: string | number;
    paidAmount: string | number;
    status: string;
    refundedAmount: string | number;
  };
  items: DetailItem[];
};

export function SaleEditDialog({
  saleId,
  locale,
  currency,
  decimalPlaces,
  onClose,
  onSaved,
}: {
  saleId: string;
  locale: Locale;
  currency: string;
  decimalPlaces: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void apiFetch<SaleDetail>(`/api/sales/${saleId}`, locale)
      .then((value) => {
        if (!active) return;
        setDetail(value);
        const next: Record<string, string> = {};
        for (const item of value.items) next[item.id] = String(item.quantity);
        setQuantities(next);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale, saleId]);

  const money = (value: number | string) => formatMoney(Number(value), locale, currency, decimalPlaces);
  const editable = Boolean(detail && detail.sale.status === "COMPLETED" && Number(detail.sale.refundedAmount) <= 0.000001);

  const preview = useMemo(() => {
    if (!detail) return 0;
    let total = 0;
    for (const item of detail.items) {
      const current = Number(item.quantity);
      const next = Number(quantities[item.id] ?? current);
      const ratio = current > 0 && Number.isFinite(next) ? next / current : 0;
      total += Number(item.lineTotal) * ratio;
    }
    return Math.round(total * 100) / 100;
  }, [detail, quantities]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      await apiSend(`/api/sales/${saleId}`, "PATCH", {
        lines: detail.items.map((item) => ({
          saleItemId: item.id,
          quantity: Number(quantities[item.id] ?? item.quantity),
        })),
      }, locale);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="arap-modal-overlay"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
    >
      <form
        aria-labelledby="sale-edit-title"
        aria-modal="true"
        className="arap-modal"
        dir={locale === "ar" ? "rtl" : "ltr"}
        onSubmit={(event) => void submit(event)}
        role="dialog"
      >
        <div className="arap-modal-header">
          <h2 className="arap-modal-title" id="sale-edit-title">
            {L(locale, "تعديل كميات الفاتورة", "Edit invoice quantities")}
          </h2>
          <button
            aria-label={L(locale, "إغلاق", "Close")}
            className="arap-modal-close"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="arap-modal-body scroll-thin">
          {error ? <p className="arap-modal-error">{error}</p> : null}
          {loading ? <p className="muted text-sm">{L(locale, "جارٍ تحميل الفاتورة...", "Loading invoice...")}</p> : null}
          {detail ? (
            <>
              <p className="muted text-xs">
                {detail.sale.invoiceNumber} · {L(locale, "المدفوع", "Paid")}: {money(detail.sale.paidAmount)}
              </p>
              {!editable ? (
                <p className="arap-modal-error">
                  {L(locale, "لا يمكن تعديل هذه الفاتورة (مرتجعة أو ملغاة).", "This invoice cannot be edited (refunded or cancelled).")}
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.items.map((item) => {
                    const current = Number(item.quantity);
                    const next = Number(quantities[item.id] ?? current);
                    const linePreview = current > 0 && Number.isFinite(next)
                      ? Number(item.lineTotal) * next / current : 0;
                    return (
                      <div className="rounded-lg border border-[var(--border)] p-2" key={item.id}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-semibold">{item.nameSnapshot}</span>
                          <span className="muted tabular-nums">{money(item.unitPrice)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="muted text-[11px]">
                            {L(locale, "الكمية", "Quantity")}: {current} → {linePreview.toFixed(2)} {currency}
                          </span>
                          <input
                            aria-label={`${item.nameSnapshot} ${L(locale, "الكمية", "Quantity")}`}
                            className="input h-9 w-24 text-center"
                            min="0.000001"
                            onChange={(event) => setQuantities((q) => ({ ...q, [item.id]: event.target.value }))}
                            step="any"
                            type="number"
                            value={quantities[item.id] ?? ""}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {editable ? (
                <div className="mt-3 rounded-lg bg-[var(--surface-muted)] p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="muted">{L(locale, "الإجمالي الجديد", "New total")}</span>
                    <strong className="tabular-nums">{money(preview)}</strong>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="muted">{L(locale, "الفرق", "Difference")}</span>
                    <strong className="tabular-nums">
                      {money(Number(detail.sale.paidAmount) - preview)}
                    </strong>
                  </div>
                  {preview > Number(detail.sale.paidAmount) + 0.005 ? (
                    <p className="mt-2 text-[11px] text-[var(--danger)]">
                      {L(locale, "الإجمالي الجديد أكبر من المدفوع؛ سجّل بيعاً جديداً بالفرق.", "New total exceeds the paid amount; record a new sale for the difference.")}
                    </p>
                  ) : null}
                  <p className="muted mt-2 text-[11px]">
                    {L(locale, "سيُعاد عكس القيد المحاسبي وتعديل المخزون تلقائياً.", "The journal will be reversed and stock adjusted automatically.")}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="arap-modal-footer">
          <button
            className="arap-modal-save"
            disabled={saving || !editable || (detail ? preview > Number(detail.sale.paidAmount) + 0.005 : true)}
            type="submit"
          >
            {saving ? L(locale, "جارٍ الحفظ...", "Saving...") : L(locale, "حفظ التعديل", "Save changes")}
          </button>
          <button className="arap-modal-cancel" disabled={saving} onClick={onClose} type="button">
            {L(locale, "إلغاء", "Cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
