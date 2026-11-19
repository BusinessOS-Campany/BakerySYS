import { describe, expect, it } from "vitest";
import { saleSchema } from "@/lib/schemas/sale";

const validSale = {
  branchId: "branch-1",
  warehouseId: "warehouse-1",
  lines: [{ productId: "product-1", quantity: 2 }],
  payments: [{ method: "CASH", amount: 20 }],
};

describe("POS sale schema", () => {
  it("accepts a valid offline sale with an idempotency key", () => {
    const result = saleSchema.safeParse({ ...validSale, idempotencyKey: "offline-queued-key-001" });
    expect(result.success).toBe(true);
  });

  it("rejects empty lines, empty payments and short idempotency keys", () => {
    expect(saleSchema.safeParse({ ...validSale, lines: [] }).success).toBe(false);
    expect(saleSchema.safeParse({ ...validSale, payments: [] }).success).toBe(false);
    expect(saleSchema.safeParse({ ...validSale, idempotencyKey: "short" }).success).toBe(false);
  });

  it("rejects unsupported payment methods", () => {
    const result = saleSchema.safeParse({
      ...validSale,
      payments: [{ method: "CRYPTO", amount: 20 }],
    });
    expect(result.success).toBe(false);
  });
});
