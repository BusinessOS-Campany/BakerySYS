import { z } from "zod";
import { db } from "@/lib/db";
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
      orderBy: { plannedDate: "desc" },
      take: 100,
    });
    return serialize(plans);
  },
});

const createSchema = z.object({
  productId: z.string(),
  plannedQuantity: z.number().positive(),
  plannedDate: z.string(),
  deadline: z.string().optional(),
  branchId: z.string().optional(),
  priority: z.string().default("NORMAL"),
  notes: z.string().optional(),
});

export const POST = apiRoute({
  permission: "production.manage",
  schema: createSchema,
  handler: async (input, auth) => {
    const branchId = input.branchId ?? auth.branchId ?? null;
    assertBranchAccess(auth, branchId);
    const plan = await db.$transaction((tx) => createProductionPlan(tx, {
      tenantId: auth.user.tenantId,
      branchId,
      productId: input.productId,
      plannedQuantity: input.plannedQuantity,
      plannedDate: new Date(input.plannedDate),
      deadline: input.deadline ? new Date(input.deadline) : null,
      priority: input.priority,
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
