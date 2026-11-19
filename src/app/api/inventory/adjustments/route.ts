import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { applyAdjustment } from "@/lib/inventory/stock";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  warehouseId: z.string().min(1),
  itemType: z.enum(["RAW", "FINISHED"]),
  itemId: z.string().min(1),
  quantity: z.number().refine((v) => v !== 0, "Quantity must not be zero"),
  reason: z.string().min(3),
});

export const POST = apiRoute({
  permission: "inventory.adjust",
  schema,
  handler: async (input, auth) => {
    const warehouse = await db.warehouse.findFirst({
      where: { id: input.warehouseId, tenantId: auth.user.tenantId, active: true },
      select: { branchId: true },
    });
    if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not found", "المخزن غير موجود");
    assertBranchAccess(auth, warehouse.branchId);
    const item = input.itemType === "RAW"
      ? await db.ingredient.findFirst({
          where: { id: input.itemId, tenantId: auth.user.tenantId },
          select: { id: true },
        })
      : await db.product.findFirst({
          where: { id: input.itemId, tenantId: auth.user.tenantId },
          select: { id: true },
        });
    if (!item) throw new AppError("NOT_FOUND", "Item not found", "الصنف غير موجود");
    const adjustment = await db.$transaction((tx) => applyAdjustment(tx, {
      tenantId: auth.user.tenantId,
      warehouseId: input.warehouseId,
      itemType: input.itemType,
      itemId: input.itemId,
      quantity: input.quantity,
      reason: input.reason,
      approvedById: auth.user.id,
    }));
    return serialize(adjustment);
  },
});
