import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { assertBranchAccess } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "sales.view",
  handler: async (_input, auth) => {
    const where = {
      tenantId: auth.user.tenantId,
      ...(auth.branchId ? { branchId: auth.branchId } : {}),
    };
    const items = await db.mealServing.findMany({ where, orderBy: { servedAt: "desc" }, take: 500 });
    return serialize({ items, total: items.length });
  },
});

const schema = z.object({
  branchId: z.string().nullable().optional(),
  servedAt: z.string().datetime().optional(),
  name: z.string().trim().min(1, "Meal name is required").max(120),
  quantityKg: z.number().positive().max(1_000_000),
  note: z.string().nullable().optional(),
});

export const POST = apiRoute({
  permission: "sales.create",
  schema,
  handler: async (input, auth) => {
    const branchId = input.branchId ?? auth.branchId ?? null;
    assertBranchAccess(auth, branchId);
    const meal = await db.mealServing.create({
      data: {
        tenantId: auth.user.tenantId,
        branchId,
        servedAt: input.servedAt ? new Date(input.servedAt) : undefined,
        name: input.name,
        quantityKg: input.quantityKg,
        note: input.note || null,
        createdBy: auth.user.id,
      },
    });
    return serialize(meal);
  },
});
