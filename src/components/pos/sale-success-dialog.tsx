"use client";

import { CheckCircle2, Plus, Printer, X } from "lucide-react";
import { formatMoney, formatNumber, translate, type Locale } from "@/lib/i18n/dictionary";

export type ReceiptLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type SaleReceipt = {
  invoiceNumber: string;
  invoiceDate: string;
  customer: string;
  paymentMethod: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
};

export function SaleSuccessDialog({
  receipt,
  locale,
  currency,
  decimalPlaces,
  tenantName,
  cashierName,
  branchName,
  onClose,
  onNewSale,
}: {
  receipt: SaleReceipt;
  locale: Locale;
  currency: string;
  decimalPlaces: number;
  tenantName: string;
  cashierName: string;
  branchName: string;
  onClose: () => void;
  onNewSale: () => void;
}) {
  const t = (key: string) => translate(locale, key);
  const money = (value: number) => formatMoney(value, locale, currency, decimalPlaces);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const change = Math.max(0, receipt.paid - receipt.total);
  const date = new Date(receipt.invoiceDate);
  const dateText = Number.isNaN(date.getTime())
    ? receipt.invoiceDate
    : date.toLocaleString(locale === "ar" ? "ar-YE-u-nu-latn" : "en-US");

  return (
    <>
      <div
        className="arap-modal-overlay"
        onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      >
        <div
          aria-labelledby="pos-sale-success-title"
          aria-modal="true"
          className="arap-modal"
          dir={dir}
          role="dialog"
        >
          <div className="arap-modal-header">
            <h2 className="arap-modal-title" id="pos-sale-success-title">{t("pos.saleComplete")}</h2>
            <button
              aria-label={t("action.close")}
              className="arap-modal-close"
              onClick={onClose}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="arap-modal-body">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <div className="text-sm font-semibold">{t("sales.invoice")} #{receipt.invoiceNumber}</div>
              <div className="text-2xl font-bold tabular-nums">{money(receipt.total)}</div>
              <p className="arap-modal-hint">{t("pos.saleCompleteHint")}</p>
            </div>
          </div>
          <div className="arap-modal-footer arap-modal-actions">
            <button className="arap-modal-save" onClick={() => window.print()} type="button">
              <Printer className="h-4 w-4" /> {t("pos.printInvoice")}
            </button>
            <button className="arap-modal-cancel" onClick={onNewSale} type="button">
              <Plus className="h-4 w-4" /> {t("sales.new")}
            </button>
          </div>
        </div>
      </div>

      <div className="invoice-print-root" dir={dir}>
        <div className="invoice-print-head">
          <strong>{tenantName}</strong>
          <div>{branchName}</div>
          <div>{t("sales.invoice")} #{receipt.invoiceNumber}</div>
          <div>{t("pos.invoiceDate")}: {dateText}</div>
        </div>
        <div className="invoice-print-meta">
          <div>{t("pos.customer")}: {receipt.customer}</div>
          <div>{t("pos.payment")}: {receipt.paymentMethod}</div>
          <div>{t("pos.cashier")}: {cashierName}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{t("pos.products")}</th>
              <th>{t("pos.quantity")}</th>
              <th>{t("pos.unitPrice")}</th>
              <th>{t("common.total")}</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line, index) => (
              <tr key={`${line.name}-${index}`}>
                <td>{formatNumber(index + 1, locale, 0)}</td>
                <td>{line.name}</td>
                <td>{formatNumber(line.quantity, locale, 0)}</td>
                <td>{money(line.unitPrice)}</td>
                <td>{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="invoice-print-totals">
          <div><span>{t("pos.subtotal")}</span><span>{money(receipt.subtotal)}</span></div>
          <div><span>{t("pos.discount")}</span><span>{money(receipt.discount)}</span></div>
          <div><span>{t("sales.tax")}</span><span>{money(receipt.tax)}</span></div>
          <div className="invoice-print-total"><span>{t("common.total")}</span><span>{money(receipt.total)}</span></div>
          <div><span>{t("pos.paid")}</span><span>{money(receipt.paid)}</span></div>
          {change > 0 ? <div><span>{t("pos.change")}</span><span>{money(change)}</span></div> : null}
        </div>
      </div>
    </>
  );
}
