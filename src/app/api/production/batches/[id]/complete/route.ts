import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { completeBatch } from "@/lib/production/service";
import { serialize } from "@/lib/serialize";
import { AppError } from "@/lib/errors";
import { assertBranchAccess } from "@/lib/auth/session";

const schema = z.object({
  actualQuantity: z.number().positive(),
  rejectedQuantity: z.number().min(0).default(0),
  wasteQuantity: z.number().min(0).default(0),
  actuals: z.record(z.string(), z.number()).optional(),
});

export const POST = apiRoute({
  permission: "production.complete",
  schema,
  handler: async (input, auth, _req, ctx) => {
    const { id: batchId } = await ctx.params;
    const batch = await db.productionBatch.findFirst({ where: { id: batchId, tenantId: auth.user.tenantId } });
    if (!batch) throw new AppError("NOT_FOUND", "Batch not found", "دفعة الإنتاج غير موجودة");
    assertBranchAccess(auth, batch.branchId);
    const result = await db.$transaction((tx) => completeBatch(tx, {
      tenantId: auth.user.tenantId,
      batchId,
      actualQuantity: input.actualQuantity,
      rejectedQuantity: input.rejectedQuantity,
      wasteQuantity: input.wasteQuantity,
      actuals: input.actuals,
      completedById: auth.user.id,
    }));
    return serialize(result);
  },
});
