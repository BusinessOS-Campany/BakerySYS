import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { transferStock } from "@/lib/inventory/workflows";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "inventory.view",
  handler: async (_input, auth) => {
    const transfers = await db.warehouseTransfer.findMany({
      where: { tenantId: auth.user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return serialize(transfers);
  },
});

const schema = z.object({
  fromWarehouse: z.string().min(1),
  toWarehouse: z.string().min(1),
  itemType: z.enum(["RAW", "FINISHED"]),
  itemId: z.string().min(1),
  quantity: z.number().positive(),
  notes: z.string().optional(),
});

export const POST = apiRoute({
  permission: "inventory.manage",
  schema,
  handler: async (input, auth) => {
    const warehouses = await db.warehouse.findMany({
      where: {
        tenantId: auth.user.tenantId, active: true,
        id: { in: [input.fromWarehouse, input.toWarehouse] },
      },
      select: { id: true, branchId: true },
    });
    if (warehouses.length !== 2) throw new AppError("NOT_FOUND", "Warehouse not found", "المخزن غير موجود");
    for (const warehouse of warehouses) assertBranchAccess(auth, warehouse.branchId);
    const transfer = await db.$transaction((tx) => transferStock(tx, {
      tenantId: auth.user.tenantId,
      fromWarehouse: input.fromWarehouse,
      toWarehouse: input.toWarehouse,
      itemType: input.itemType,
      itemId: input.itemId,
      quantity: input.quantity,
      notes: input.notes,
      createdById: auth.user.id,
    }));
    return serialize(transfer);
  },
});
