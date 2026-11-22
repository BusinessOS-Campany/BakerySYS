import { describe, expect, it } from "vitest";
import {
  productionPlanCreateSchema,
  productionPlanUpdateSchema,
} from "@/lib/schemas/production-plan";

const validPlan = {
  productId: "product-1",
  tableQuantity: 4,
  pieceQuantity: 120,
  kilogramQuantity: 18.5,
};

describe("production plan schemas", () => {
  it("accepts the three independent quantity fields", () => {
    const result = productionPlanCreateSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pieceQuantity).toBe(120);
      expect(result.data.tableQuantity).toBe(4);
      expect(result.data.kilogramQuantity).toBe(18.5);
    }
  });

  it("ignores the removed priority and date fields", () => {
    const result = productionPlanCreateSchema.safeParse({
      ...validPlan,
      priority: "HIGH",
      plannedDate: "2020-01-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("priority");
      expect(result.data).not.toHaveProperty("plannedDate");
    }
  });

  it("requires a positive piece count and non-negative table/kilo counts", () => {
    expect(productionPlanCreateSchema.safeParse({ ...validPlan, pieceQuantity: 0 }).success).toBe(false);
    expect(productionPlanCreateSchema.safeParse({ ...validPlan, tableQuantity: -1 }).success).toBe(false);
    expect(productionPlanCreateSchema.safeParse({ ...validPlan, kilogramQuantity: -1 }).success).toBe(false);
  });

  it("requires at least one field on update", () => {
    expect(productionPlanUpdateSchema.safeParse({}).success).toBe(false);
    expect(productionPlanUpdateSchema.safeParse({ pieceQuantity: 10 }).success).toBe(true);
  });
});
