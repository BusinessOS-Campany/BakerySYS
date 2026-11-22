import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { productionPlanUpdateSchema } from "@/lib/schemas/production-plan";
import { updateProductionPlan } from "@/lib/production/service";
import { serialize } from "@/lib/serialize";

export const PATCH = apiRoute({
  permission: "production.manage",
  schema: productionPlanUpdateSchema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const plan = await db.productionPlan.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      select: { branchId: true },
    });
    if (!plan) throw new AppError("NOT_FOUND", "Production plan not found", "خطة الإنتاج غير موجودة");
    assertBranchAccess(auth, plan.branchId);

    const updated = await db.$transaction((tx) => updateProductionPlan(tx, {
      tenantId: auth.user.tenantId,
      planId: id,
      tableQuantity: input.tableQuantity,
      pieceQuantity: input.pieceQuantity,
      kilogramQuantity: input.kilogramQuantity,
      notes: input.notes,
    }));
    return serialize(updated);
  },
});
