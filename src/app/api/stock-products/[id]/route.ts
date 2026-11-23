import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { round } from "@/lib/calculations";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

const updateSchema = z.object({
  nameAr: z.string().trim().min(1).max(120),
  unitId: z.string().min(1),
  currentCost: z.number().min(0).max(1_000_000_000),
});

async function loadProduct(id: string, tenantId: string) {
  const product = await db.ingredient.findFirst({
    where: { id, tenantId },
    select: { id: true, nameAr: true, currentCost: true, active: true },
  });
  if (!product) throw new AppError("NOT_FOUND", "Product not found", "المنتج غير موجود");
  return product;
}

export const PATCH = apiRoute({
  permission: "ingredients.manage",
  schema: updateSchema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const tenantId = auth.user.tenantId;
    const existing = await loadProduct(id, tenantId);
    const unit = await db.unitOfMeasure.findFirst({
      where: { id: input.unitId, tenantId, active: true },
      select: { id: true },
    });
    if (!unit) throw new AppError("VALIDATION", "Invalid unit of measure", "وحدة القياس غير صالحة");

    const cost = round(input.currentCost, 6);
    const updated = await db.$transaction(async (tx) => {
      const product = await tx.ingredient.update({
        where: { id },
        data: {
          nameAr: input.nameAr,
          nameEn: input.nameAr,
          baseUnitId: unit.id,
          purchaseUnitId: unit.id,
          currentCost: cost,
        },
      });
      if (Number(existing.currentCost) !== cost) {
        await tx.priceHistory.create({
          data: {
            tenantId, ingredientId: id, price: cost, source: "MANUAL_EDIT",
          },
        });
      }
      return product;
    });
    return serialize(updated);
  },
});

export const DELETE = apiRoute({
  permission: "ingredients.manage",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const tenantId = auth.user.tenantId;
    const product = await loadProduct(id, tenantId);

    const [lots, stock, movements, recipes, orderItems, receiptItems, requestItems, returnItems, allergens] = await Promise.all([
      db.ingredientLot.count({ where: { ingredientId: id } }),
      db.ingredientStock.count({ where: { ingredientId: id } }),
      db.ingredientMovement.count({ where: { ingredientId: id } }),
      db.recipeIngredient.count({ where: { ingredientId: id } }),
      db.purchaseOrderItem.count({ where: { ingredientId: id } }),
      db.goodsReceiptItem.count({ where: { ingredientId: id } }),
      db.purchaseRequestItem.count({ where: { ingredientId: id } }),
      db.purchaseReturnItem.count({ where: { ingredientId: id } }),
      db.ingredientAllergen.count({ where: { ingredientId: id } }),
    ]);
    const inUse = [lots, stock, movements, recipes, orderItems, receiptItems, requestItems, returnItems, allergens]
      .some((count) => count > 0);

    if (inUse) {
      // Stock and documents reference this product. Deactivate instead of
      // deleting so history stays intact and it leaves the selection lists.
      const deactivated = await db.ingredient.update({
        where: { id },
        data: { active: false },
      });
      return serialize({ id, deleted: false, deactivated: true, product: deactivated });
    }

    await db.$transaction(async (tx) => {
      await tx.priceHistory.deleteMany({ where: { tenantId, ingredientId: id } });
      await tx.ingredient.delete({ where: { id } });
    });
    return serialize({ id, deleted: true, deactivated: false, product });
  },
});
