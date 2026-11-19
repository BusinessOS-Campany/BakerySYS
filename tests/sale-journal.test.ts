import { describe, expect, it } from "vitest";
import { journalBalanced } from "@/lib/calculations";
import { buildSaleJournalLines } from "@/lib/sales/journal";

const balanced = (lines: ReturnType<typeof buildSaleJournalLines>) =>
  journalBalanced(lines.map((line) => ({
    accountId: line.accountId ?? line.code ?? "",
    debit: line.debit ?? 0,
    credit: line.credit ?? 0,
  })));

describe("sale journal", () => {
  it("balances when the customer pays exactly the invoice total", () => {
    const lines = buildSaleJournalLines({
      cashAmount: 711.225,
      bankAmount: 0,
      creditAmount: 0,
      total: 711.225,
      taxTotal: 0,
      cogs: 11.225,
      invoiceNumber: "INV-1",
    });
    expect(balanced(lines)).toBe(true);
  });

  it("records overpayment as customer advances and stays balanced", () => {
    const lines = buildSaleJournalLines({
      cashAmount: 1000,
      bankAmount: 0,
      creditAmount: 0,
      total: 711.225,
      taxTotal: 0,
      cogs: 11.225,
      invoiceNumber: "INV-2",
    });
    expect(balanced(lines)).toBe(true);
    expect(lines.some((line) => line.code === "2100" && line.credit === 288.775)).toBe(true);
  });

  it("balances split tender with tax and credit", () => {
    const lines = buildSaleJournalLines({
      cashAmount: 200,
      bankAmount: 300,
      creditAmount: 511.225,
      total: 1011.225,
      taxTotal: 11.225,
      cogs: 120,
      invoiceNumber: "INV-3",
    });
    expect(balanced(lines)).toBe(true);
  });
});
