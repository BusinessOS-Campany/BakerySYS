import { z } from "zod";
import { db } from "@/lib/db";
import { productionPlanCreateSchema } from "@/lib/schemas/production-plan";
import { apiRoute } from "@/lib/http";
import { createProductionPlan, approveProductionPlan } from "@/lib/production/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "production.view",
  handler: async (_input, auth) => {
    const plans = await db.productionPlan.findMany({
      where: { tenantId: auth.user.tenantId, ...(auth.branchId ? { branchId: auth.branchId } : {}) },
      orderBy: [{ plannedDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return serialize(plans);
  },
});

export const POST = apiRoute({
  permission: "production.manage",
  schema: productionPlanCreateSchema,
  handler: async (input, auth) => {
    const branchId = input.branchId ?? auth.branchId ?? null;
    assertBranchAccess(auth, branchId);
    const plan = await db.$transaction((tx) => createProductionPlan(tx, {
      tenantId: auth.user.tenantId,
      branchId,
      productId: input.productId,
      tableQuantity: input.tableQuantity,
      pieceQuantity: input.pieceQuantity,
      kilogramQuantity: input.kilogramQuantity,
      plannedDate: new Date(),
      deadline: input.deadline ? new Date(input.deadline) : null,
      notes: input.notes,
      createdById: auth.user.id,
    }));
    return serialize(plan);
  },
});

const approveSchema = z.object({ planId: z.string() });
export const PATCH = apiRoute({
  permission: "production.manage",
  schema: approveSchema,
  handler: async (input, auth) => {
    const plan = await db.productionPlan.findFirst({ where: { id: input.planId, tenantId: auth.user.tenantId } });
    if (!plan) throw new AppError("NOT_FOUND", "Plan not found", "خطة الإنتاج غير موجودة");
    assertBranchAccess(auth, plan.branchId);
    return serialize(await db.$transaction((tx) => approveProductionPlan(tx, {
      tenantId: auth.user.tenantId, planId: plan.id, approvedById: auth.user.id,
    })));
  },
});
