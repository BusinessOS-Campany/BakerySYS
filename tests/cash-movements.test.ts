import { describe, expect, it } from "vitest";
import { computeExpectedCash } from "@/lib/calculations";

describe("computeExpectedCash", () => {
  it("adds cash sales and cash-in, subtracts cash-out", () => {
    expect(computeExpectedCash({ openingBalance: 100, cashSales: 50, cashIn: 20, cashOut: 30 })).toBe(140);
  });

  it("accepts decimal values returned by the database", () => {
    expect(computeExpectedCash({
      openingBalance: "100.5000", cashSales: "10.2500", cashIn: 0, cashOut: "0.7500",
    })).toBe(110);
  });

  it("goes negative when disbursements exceed available cash", () => {
    expect(computeExpectedCash({ openingBalance: 0, cashSales: 0, cashIn: 0, cashOut: 10 })).toBe(-10);
  });
});
