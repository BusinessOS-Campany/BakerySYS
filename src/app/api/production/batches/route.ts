import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { createBatch } from "@/lib/production/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "production.view",
  handler: async (_input, auth) => {
    const batches = await db.productionBatch.findMany({
      where: { tenantId: auth.user.tenantId, ...(auth.branchId ? { branchId: auth.branchId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return serialize(batches);
  },
});

const schema = z.object({
  productId: z.string(),
  plannedQuantity: z.number().positive(),
  warehouseId: z.string(),
  sourceWarehouseId: z.string().optional().nullable(),
  planId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  notes: z.string().optional(),
  employeeIds: z.array(z.string()).optional(),
});

export const POST = apiRoute({
  permission: "production.manage",
  schema,
  handler: async (input, auth) => {
    const branchId = input.branchId ?? auth.branchId ?? null;
    assertBranchAccess(auth, branchId);
    const destination = await db.warehouse.findFirst({
      where: { id: input.warehouseId, tenantId: auth.user.tenantId, active: true },
    });
    if (!destination) throw new AppError("NOT_FOUND", "Destination warehouse not found", "مخزن المنتجات التامة غير موجود");
    const batch = await db.$transaction((tx) => createBatch(tx, {
      tenantId: auth.user.tenantId,
      planId: input.planId ?? null,
      branchId,
      warehouseId: input.warehouseId,
      sourceWarehouseId: input.sourceWarehouseId ?? null,
      productId: input.productId,
      plannedQuantity: input.plannedQuantity,
      notes: input.notes,
      createdById: auth.user.id,
      employeeIds: input.employeeIds,
    }));
    return serialize(batch);
  },
});
