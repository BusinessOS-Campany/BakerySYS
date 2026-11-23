import { describe, expect, it } from "vitest";
import {
  calcLineTotals,
  calcRecipeCost,
  convertQuantity,
  journalBalanced,
  journalTotals,
  paymentBalance,
  safeNumber,
  selectFefoLots,
} from "@/lib/calculations";

describe("calculations", () => {
  it("normalises unsafe numbers", () => {
    expect(safeNumber("12.5")).toBe(12.5);
    expect(safeNumber("n/a")).toBe(0);
    expect(safeNumber(null)).toBe(0);
  });

  it("calculates line totals with and without tax", () => {
    expect(calcLineTotals({ quantity: 2, unitPrice: 10, discount: 4 })).toEqual({ net: 16, tax: 0, total: 16 });
    expect(calcLineTotals({ quantity: 2, unitPrice: 10, discount: 4, taxRate: 0.15, taxEnabled: true }))
      .toEqual({ net: 16, tax: 2.4, total: 18.4 });
  });

  it("converts quantities across a unit graph", () => {
    const edges = [
      { from: "g", to: "kg", factor: 0.001 },
      { from: "kg", to: "bag", factor: 0.05 },
    ];
    expect(convertQuantity(1000, "g", "kg", edges)).toBe(1);
    expect(convertQuantity(20, "kg", "bag", edges)).toBe(1);
    expect(convertQuantity(1, "bag", "g", edges)).toBeCloseTo(20000, 6);
  });

  it("allocates FEFO lots by expiry and never overallocates", () => {
    const allocation = selectFefoLots([
      { id: "late", quantity: 10, unitCost: 12, expiryDate: "2026-12-31" },
      { id: "early", quantity: 4, unitCost: 10, expiryDate: "2026-06-30" },
      { id: "empty", quantity: 0, unitCost: 8, expiryDate: "2026-01-01" },
    ], 6);
    expect(allocation).toEqual([
      { lotId: "early", quantity: 4, unitCost: 10 },
      { lotId: "late", quantity: 2, unitCost: 12 },
    ]);
    expect(() => selectFefoLots([{ id: "only", quantity: 1 }], 2)).toThrowError(/Insufficient stock/);
  });

  it("calculates recipe cost and baker's percentages", () => {
    const result = calcRecipeCost({
      ingredients: [
        { quantity: 1000, unitCostPerBase: 2, quantityInBase: 1 },
        { quantity: 500, unitCostPerBase: 4, quantityInBase: 0.5 },
      ],
      laborCost: 10,
      packagingCost: 5,
      overheadCost: 5,
      yieldQuantity: 10,
      sellingPrice: 6,
      flourBaseQuantity: 1,
    });
    expect(result.ingredientCost).toBe(4);
    expect(result.totalCost).toBe(24);
    expect(result.costPerUnit).toBe(2.4);
    expect(result.grossProfit).toBe(3.6);
    expect(result.profitPercent).toBe(60);
    expect(result.bakersPercentages).toEqual([100, 50]);
  });

  it("validates journal balance", () => {
    expect(journalTotals([{ accountId: "a", debit: 10, credit: 0 }, { accountId: "b", debit: 0, credit: 10 }]))
      .toEqual({ debit: 10, credit: 10 });
    expect(journalBalanced([{ accountId: "a", debit: 10, credit: 0 }, { accountId: "b", debit: 0, credit: 9 }])).toBe(false);
  });

  it("calculates payment balance", () => {
    expect(paymentBalance(100, [30, 20])).toBe(50);
  });
});
