import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { receiveIngredient } from "@/lib/inventory/stock";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  itemState: z.enum(["GRAINS", "GROUND"]).default("GRAINS"),
  cleaned: z.boolean().default(false),
});

/** Single-entry raw-material receipt used by the inventory cards page. */
export const POST = apiRoute({
  permission: "inventory.manage",
  schema,
  idempotent: true,
  handler: async (input, auth) => {
    const [ingredient, warehouse] = await Promise.all([
      db.ingredient.findFirst({
        where: { id: input.ingredientId, tenantId: auth.user.tenantId, active: true },
      }),
      db.warehouse.findFirst({
        where: {
          tenantId: auth.user.tenantId,
          active: true,
          kind: { in: ["RAW", "BOTH"] },
          ...(auth.branchId ? { branchId: auth.branchId } : {}),
        },
        orderBy: { code: "asc" },
      }),
    ]);
    if (!ingredient) throw new AppError("NOT_FOUND", "Ingredient not found", "المادة غير موجودة");
    if (!warehouse) {
      throw new AppError("NOT_FOUND", "No raw-material warehouse found", "لا يوجد مخزن للمواد الخام");
    }
    assertBranchAccess(auth, warehouse.branchId);

    const lotNumber = `STK-${randomUUID().slice(0, 10).toUpperCase()}`;
    const stateLabel = input.itemState === "GROUND" ? "مطحون" : "حبوب";
    const result = await db.$transaction((tx) => receiveIngredient(tx, {
      tenantId: auth.user.tenantId,
      warehouseId: warehouse.id,
      ingredientId: ingredient.id,
      quantity: input.quantity,
      unitCost: Number(ingredient.currentCost) || 0,
      lotNumber,
      itemState: input.itemState,
      cleaned: input.cleaned,
      movementType: "MANUAL_STOCK_ADD",
      referenceType: "INVENTORY_CARD",
      referenceId: lotNumber,
      note: `${stateLabel} · ${input.cleaned ? "تم التنقيه" : "غير منقي"}`,
      createdById: auth.user.id,
    }));
    return serialize(result);
  },
});
