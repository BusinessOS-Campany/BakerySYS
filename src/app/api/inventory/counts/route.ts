import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { createStockCount } from "@/lib/inventory/workflows";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "inventory.view",
  handler: async (_input, auth) => {
    const counts = await db.stockCount.findMany({
      where: { tenantId: auth.user.tenantId },
      orderBy: { countDate: "desc" },
      take: 100,
    });
    const lines = await db.stockCountLine.findMany({
      where: { tenantId: auth.user.tenantId, countId: { in: counts.map((c) => c.id) } },
    });
    return serialize({ items: counts.map((count) => ({ ...count, lines: lines.filter((l) => l.countId === count.id) })) });
  },
});

const schema = z.object({
  warehouseId: z.string().min(1),
  itemType: z.enum(["RAW", "FINISHED"]),
  countDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({ itemId: z.string().min(1), counted: z.number().min(0) })).min(1),
});

export const POST = apiRoute({
  permission: "inventory.manage",
  schema,
  handler: async (input, auth) => {
    const warehouse = await db.warehouse.findFirst({
      where: { id: input.warehouseId, tenantId: auth.user.tenantId, active: true },
      select: { branchId: true },
    });
    if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not found", "المخزن غير موجود");
    assertBranchAccess(auth, warehouse.branchId);
    const count = await db.$transaction((tx) => createStockCount(tx, {
      tenantId: auth.user.tenantId,
      warehouseId: input.warehouseId,
      itemType: input.itemType,
      countDate: input.countDate ? new Date(input.countDate) : undefined,
      notes: input.notes,
      createdById: auth.user.id,
      lines: input.lines,
    }));
    return serialize(count);
  },
});
