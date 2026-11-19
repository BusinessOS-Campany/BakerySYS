import { z } from "zod";

export const saleLineSchema = z.object({
  productId: z.string(),
  variantId: z.string().nullable().optional(),
  quantity: z.number().positive(),
  discount: z.number().min(0).optional(),
  note: z.string().optional(),
});

export const salePaymentSchema = z.object({
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "CREDIT"]),
  amount: z.number().positive(),
  reference: z.string().optional(),
});

export const saleSchema = z.object({
  branchId: z.string(),
  warehouseId: z.string(),
  customerId: z.string().nullable().optional(),
  lines: z.array(saleLineSchema).min(1),
  payments: z.array(salePaymentSchema).min(1),
  discountAmount: z.number().min(0).optional(),
  idempotencyKey: z.string().min(8).nullable().optional(),
  cashSessionId: z.string().nullable().optional(),
  notes: z.string().optional(),
});
