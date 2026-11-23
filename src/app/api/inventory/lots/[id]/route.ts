import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { round } from "@/lib/calculations";
import { consumeIngredient, rawBalance } from "@/lib/inventory/stock";
import { serialize } from "@/lib/serialize";

const updateSchema = z.object({
  quantity: z.number().min(0).max(1_000_000_000),
  unitCost: z.number().min(0).max(1_000_000_000),
  itemState: z.enum(["GRAINS", "GROUND"]),
  cleaned: z.boolean(),
});

/** Edit one batch: quantity, unit price, state and cleaning status. */
export const PATCH = apiRoute({
  permission: "inventory.manage",
  schema: updateSchema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const tenantId = auth.user.tenantId;
    const lot = await db.ingredientLot.findFirst({
      where: { id, tenantId, quantity: { gt: 0 } },
    });
    if (!lot) throw new AppError("NOT_FOUND", "Stock batch not found", "دفعة المخزون غير موجودة");
    const warehouse = await db.warehouse.findFirst({
      where: { id: lot.warehouseId, tenantId },
      select: { branchId: true },
    });
    assertBranchAccess(auth, warehouse?.branchId);

    const quantity = round(input.quantity, 6);
    const unitCost = round(input.unitCost, 6);
    const before = Number(lot.quantity);
    const delta = round(quantity - before, 6);

    const updated = await db.$transaction(async (tx) => {
      if (delta !== 0) {
        await rawBalance(tx, {
          tenantId, warehouseId: lot.warehouseId, createdById: auth.user.id,
        }, lot.ingredientId, delta);
      }
      const next = await tx.ingredientLot.update({
        where: { id: lot.id },
        data: { quantity, unitCost, itemState: input.itemState, cleaned: input.cleaned },
      });
      if (delta !== 0) {
        await tx.ingredientMovement.create({
          data: {
            tenantId, warehouseId: lot.warehouseId, ingredientId: lot.ingredientId, lotId: lot.id,
            direction: delta > 0 ? "IN" : "OUT", quantity: Math.abs(delta), unitCost,
            movementType: "LOT_EDIT", referenceType: "INVENTORY_CARD", referenceId: lot.lotNumber,
            note: `${before} → ${quantity}`,
            createdById: auth.user.id,
          },
        });
      }
      return next;
    });

    return serialize({ ...updated, previousQuantity: before });
  },
});

/**
 * Remove a batch from the cards. The remaining quantity is exited with an OUT
 * movement so the audit trail and stock balance stay consistent; the batch
 * record itself is kept at zero for historical references.
 */
export const DELETE = apiRoute({
  permission: "inventory.manage",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const tenantId = auth.user.tenantId;
    const lot = await db.ingredientLot.findFirst({
      where: { id, tenantId, quantity: { gt: 0 } },
    });
    if (!lot) throw new AppError("NOT_FOUND", "Stock batch not found", "دفعة المخزون غير موجودة");
    const warehouse = await db.warehouse.findFirst({
      where: { id: lot.warehouseId, tenantId },
      select: { branchId: true },
    });
    assertBranchAccess(auth, warehouse?.branchId);

    const remaining = Number(lot.quantity);
    await db.$transaction((tx) => consumeIngredient(tx, {
      tenantId,
      warehouseId: lot.warehouseId,
      ingredientId: lot.ingredientId,
      quantity: remaining,
      lotId: lot.id,
      movementType: "LOT_DELETED",
      referenceType: "INVENTORY_CARD",
      referenceId: lot.lotNumber,
      note: "حذف الدفعة",
      createdById: auth.user.id,
    }));

    return serialize({ id: lot.id, lotNumber: lot.lotNumber, exited: round(remaining, 6), remaining: 0 });
  },
});
