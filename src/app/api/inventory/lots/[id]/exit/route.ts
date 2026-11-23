import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { round } from "@/lib/calculations";
import { consumeIngredient } from "@/lib/inventory/stock";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  quantity: z.number().positive(),
  note: z.string().trim().max(300).optional(),
});

/** Take stock out of one specific batch, keeping the OUT movement and audit trail. */
export const POST = apiRoute({
  permission: "inventory.manage",
  schema,
  idempotent: true,
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

    const available = Number(lot.quantity);
    if (input.quantity > available + 1e-9) {
      throw new AppError(
        "INSUFFICIENT_STOCK",
        `Only ${available} available in batch ${lot.lotNumber}`,
        `الكمية المتاحة في الدفعة ${available} فقط`,
      );
    }

    const result = await db.$transaction((tx) => consumeIngredient(tx, {
      tenantId,
      warehouseId: lot.warehouseId,
      ingredientId: lot.ingredientId,
      quantity: input.quantity,
      lotId: lot.id,
      movementType: "MANUAL_STOCK_EXIT",
      referenceType: "INVENTORY_CARD",
      referenceId: lot.lotNumber,
      note: input.note?.trim() || undefined,
      createdById: auth.user.id,
    }));

    return serialize({
      lotId: lot.id,
      exited: round(input.quantity, 6),
      remaining: round(available - input.quantity, 6),
      balance: result.balance,
      cost: result.cost,
    });
  },
});
