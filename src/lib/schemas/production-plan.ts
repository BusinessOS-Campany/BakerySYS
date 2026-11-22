import { z } from "zod";

/** New production plans store three independent quantities. The piece count is
 *  the canonical value used for recipe costing, stock and batch scaling. */
export const productionPlanCreateSchema = z.object({
  productId: z.string().min(1),
  tableQuantity: z.number().min(0).default(0),
  pieceQuantity: z.number().positive(),
  kilogramQuantity: z.number().min(0).default(0),
  deadline: z.string().optional(),
  branchId: z.string().optional(),
  notes: z.string().optional(),
});

export const productionPlanUpdateSchema = z.object({
  tableQuantity: z.number().min(0).optional(),
  pieceQuantity: z.number().positive().optional(),
  kilogramQuantity: z.number().min(0).optional(),
  notes: z.string().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "No fields to update",
});
