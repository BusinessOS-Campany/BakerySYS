import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { calcRecipeCost, round, type RecipeCostResult } from "@/lib/calculations";

/** Converts a recipe quantity into the ingredient's base inventory unit. */
export async function toBaseQuantity(
  tx: Db,
  tenantId: string,
  ingredient: { id: string; baseUnitId: string },
  unitId: string,
  quantity: number,
): Promise<number> {
  if (unitId === ingredient.baseUnitId) return round(quantity, 6);
  const direct = await tx.unitConversion.findUnique({
    where: {
      tenantId_fromUnitId_toUnitId: { tenantId, fromUnitId: unitId, toUnitId: ingredient.baseUnitId },
    },
  });
  if (direct) return round(quantity * Number(direct.factor), 6);
  const inverse = await tx.unitConversion.findUnique({
    where: {
      tenantId_fromUnitId_toUnitId: { tenantId, fromUnitId: ingredient.baseUnitId, toUnitId: unitId },
    },
  });
  if (inverse && Number(inverse.factor) !== 0) return round(quantity / Number(inverse.factor), 6);
  throw new AppError(
    "VALIDATION",
    `Incompatible units for ingredient ${ingredient.id}`,
    "ظˆط­ط¯ط§طھ ط§ظ„ظ‚ظٹط§ط³ ط؛ظٹط± ظ…طھظˆط§ظپظ‚ط© ظ…ط¹ ط§ظ„ظ…ظƒظˆظ†",
  );
}

export async function recipeRequirements(tx: Db, tenantId: string, versionId: string, multiplier = 1) {
  const lines = await tx.recipeIngredient.findMany({
    where: { tenantId, versionId, isAlternative: false },
  });
  const ingredientIds = [...new Set(lines.map((l) => l.ingredientId))];
  const ingredients = await tx.ingredient.findMany({ where: { id: { in: ingredientIds }, tenantId } });
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const stocks = await tx.ingredientStock.findMany({
    where: { tenantId, ingredientId: { in: ingredientIds } },
  });
  const available = new Map<string, number>();
  for (const s of stocks) {
    available.set(s.ingredientId, (available.get(s.ingredientId) ?? 0) + Number(s.quantity));
  }

  const items = [] as {
    ingredientId: string;
    nameEn: string;
    nameAr: string;
    quantity: number;
    baseQuantity: number;
    unitId: string;
    unitCost: number;
    lineCost: number;
    available: number;
    shortage: number;
  }[];
  for (const line of lines) {
    const ingredient = byId.get(line.ingredientId);
    if (!ingredient) {
      throw new AppError("NOT_FOUND", "Recipe references a missing ingredient", "ط§ظ„ظˆطµظپط© طھط­طھظˆظٹ ط¹ظ„ظ‰ ظ…ظƒظˆظ† ط؛ظٹط± ظ…ظˆط¬ظˆط¯");
    }
    const baseQuantity = await toBaseQuantity(tx, tenantId, ingredient, line.unitId, Number(line.quantity) * multiplier);
    const unitCost = Number(ingredient.currentCost);
    const have = available.get(ingredient.id) ?? 0;
    items.push({
      ingredientId: ingredient.id,
      nameEn: ingredient.nameEn,
      nameAr: ingredient.nameAr,
      quantity: round(Number(line.quantity) * multiplier, 6),
      baseQuantity,
      unitId: line.unitId,
      unitCost,
      lineCost: round(baseQuantity * unitCost, 6),
      available: round(have, 6),
      shortage: round(Math.max(0, baseQuantity - have), 6),
    });
  }
  return items;
}

/** Recalculates current cost from current ingredient prices, creating an immutable snapshot. */
export async function recalculateRecipeCost(tx: Db, tenantId: string, recipeId: string): Promise<{
  snapshotId: string;
  result: RecipeCostResult;
}> {
  const recipe = await tx.recipe.findFirst({ where: { id: recipeId, tenantId } });
  if (!recipe) throw new AppError("NOT_FOUND", "Recipe not found", "ط§ظ„ظˆطµظپط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©");
  const product = await tx.product.findFirst({ where: { id: recipe.productId, tenantId } });
  if (!product) throw new AppError("NOT_FOUND", "Linked product not found", "ط§ظ„ظ…ظ†طھط¬ ط§ظ„ظ…ط±طھط¨ط· ط؛ظٹط± ظ…ظˆط¬ظˆط¯");
  const version = await tx.recipeVersion.findFirst({
    where: { recipeId, version: recipe.currentVersion },
    orderBy: { version: "desc" },
  });
  if (!version) throw new AppError("NOT_FOUND", "Recipe version not found", "ظ†ط³ط®ط© ط§ظ„ظˆطµظپط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©");
  const items = await recipeRequirements(tx, tenantId, version.id, 1);
  const flourLine = items.find((i) => /flour|ط¯ظ‚ظٹظ‚/i.test(i.nameEn + i.nameAr));
  const result = calcRecipeCost({
    ingredients: items.map((i) => ({
      quantity: i.quantity,
      quantityInBase: i.baseQuantity,
      unitCostPerBase: i.unitCost,
    })),
    laborCost: Number(recipe.laborCost),
    packagingCost: Number(recipe.packagingCost),
    overheadCost: Number(recipe.overheadCost),
    yieldQuantity: Number(recipe.yieldQuantity) || 1,
    sellingPrice: Number(product.sellingPrice),
    flourBaseQuantity: flourLine?.baseQuantity,
  });
  const snapshot = await tx.recipeCostSnapshot.create({
    data: {
      tenantId, recipeId, versionId: version.id,
      ingredientCost: result.ingredientCost,
      laborCost: result.laborCost,
      packagingCost: result.packagingCost,
      overheadCost: result.overheadCost,
      totalCost: result.totalCost,
      costPerUnit: result.costPerUnit,
      sellingPrice: result.sellingPrice,
      grossProfit: result.grossProfit,
      profitPercent: result.profitPercent,
      lineItems: JSON.parse(JSON.stringify(items)) as never,
    },
  });
  await tx.product.update({
    where: { id: product.id },
    data: { costPrice: result.costPerUnit },
  });
  return { snapshotId: snapshot.id, result };
}

export async function latestSnapshot(tx: Db, tenantId: string, recipeId: string) {
  return tx.recipeCostSnapshot.findFirst({
    where: { tenantId, recipeId },
    orderBy: { calculatedAt: "desc" },
  });
}
