import { ACCOUNT_CODES, type JournalInputLine } from "@/lib/accounting/ledger";
import { round } from "@/lib/calculations";

export type SaleJournalInput = {
  cashAmount: number;
  bankAmount: number;
  creditAmount: number;
  total: number;
  taxTotal: number;
  cogs: number;
  invoiceNumber: string;
};

/**
 * Builds the immutable journal lines for a completed sale.
 *
 * Tender is recorded in full. Any amount paid above the invoice total is
 * credited to customer advances, keeping the entry balanced and preserving
 * the customer's store credit instead of dropping the excess into revenue.
 */
export function buildSaleJournalLines(input: SaleJournalInput): JournalInputLine[] {
  const cashAmount = round(input.cashAmount, 6);
  const bankAmount = round(input.bankAmount, 6);
  const creditAmount = round(input.creditAmount, 6);
  const total = round(input.total, 6);
  const taxTotal = round(input.taxTotal, 6);
  const cogs = round(input.cogs, 6);
  const overpayment = round(Math.max(0, cashAmount + bankAmount + creditAmount - total), 6);

  return [
    ...(cashAmount > 0 ? [{ code: ACCOUNT_CODES.CASH, debit: cashAmount, credit: 0 }] : []),
    ...(bankAmount > 0 ? [{ code: ACCOUNT_CODES.BANK, debit: bankAmount, credit: 0 }] : []),
    ...(creditAmount > 0 ? [{ code: ACCOUNT_CODES.RECEIVABLES, debit: creditAmount, credit: 0 }] : []),
    { code: ACCOUNT_CODES.SALES, debit: 0, credit: round(total - taxTotal, 6) },
    ...(taxTotal > 0 ? [{ code: "2200", debit: 0, credit: taxTotal }] : []),
    { code: ACCOUNT_CODES.COGS, debit: cogs, credit: 0 },
    { code: ACCOUNT_CODES.FINISHED_INVENTORY, debit: 0, credit: cogs },
    ...(overpayment > 0 ? [{
      code: ACCOUNT_CODES.CUSTOMER_ADVANCES,
      debit: 0,
      credit: overpayment,
      memo: `Overpayment on ${input.invoiceNumber}`,
    }] : []),
  ];
}
