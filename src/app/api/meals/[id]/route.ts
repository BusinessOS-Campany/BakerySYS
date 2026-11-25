import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  branchId: z.string().nullable().optional(),
  servedAt: z.string().datetime().optional(),
  name: z.string().trim().min(1, "Meal name is required").max(120).optional(),
  quantityKg: z.number().positive().max(1_000_000).optional(),
  note: z.string().nullable().optional(),
});

export const PATCH = apiRoute({
  permission: "sales.create",
  schema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const meal = await db.mealServing.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      select: { branchId: true },
    });
    if (!meal) throw new AppError("NOT_FOUND", "Meal not found", "الوجبة غير موجودة");
    assertBranchAccess(auth, meal.branchId);
    const branchId = input.branchId ?? meal.branchId;
    assertBranchAccess(auth, branchId);
    const updated = await db.mealServing.update({
      where: { id },
      data: {
        branchId,
        servedAt: input.servedAt ? new Date(input.servedAt) : undefined,
        name: input.name,
        quantityKg: input.quantityKg,
        note: input.note === undefined ? undefined : input.note || null,
      },
    });
    return serialize(updated);
  },
});

export const DELETE = apiRoute({
  permission: "sales.create",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const meal = await db.mealServing.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      select: { branchId: true },
    });
    if (!meal) throw new AppError("NOT_FOUND", "Meal not found", "الوجبة غير موجودة");
    assertBranchAccess(auth, meal.branchId);
    return serialize(await db.mealServing.delete({ where: { id } }));
  },
});
