import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { saleSchema } from "@/lib/schemas/sale";
import { createSale } from "@/lib/sales/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError, toAppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  sales: z.array(z.object({ key: z.string().min(8), payload: saleSchema })).max(200),
});

export const POST = apiRoute({
  permission: "sales.create",
  schema,
  handler: async (input, auth) => {
    const results: { key: string; ok: boolean; saleId?: string; duplicate?: boolean; error?: string }[] = [];
    for (const item of input.sales) {
      try {
        assertBranchAccess(auth, item.payload.branchId);
        const result = await db.$transaction((tx) => createSale(tx, auth, {
          ...item.payload,
          idempotencyKey: item.key,
        }));
        results.push({ key: item.key, ok: true, saleId: result.sale.id, duplicate: result.duplicate });
      } catch (error) {
        const appError = toAppError(error);
        results.push({ key: item.key, ok: false, error: appError.message });
      }
    }
    if (results.every((r) => !r.ok)) throw new AppError("VALIDATION", "No queued sale could be synced", "تعذرت مزامنة أي عملية بيع");
    return serialize({ results });
  },
});
