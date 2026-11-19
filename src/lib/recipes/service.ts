import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { recalculateRecipeCost } from "@/lib/recipes/costing";

export type RecipeLineInput = {
  ingredientId: string;
  quantity: number;
  unitId: string;
  isAlternative?: boolean;
  note?: string;
};

async function createVersion(tx: Db, input: {
  tenantId: string;
  recipeId: string;
  version: number;
  notes?: string;
  lines: RecipeLineInput[];
  instructions?: { step: number; textAr?: string; textEn?: string }[];
}) {
  if (!input.lines.length) throw new AppError("VALIDATION", "Recipe has no ingredients", "الوصفة لا تحتوي على مكونات");
  const existing = await tx.recipeVersion.findFirst({
    where: { tenantId: input.tenantId, recipeId: input.recipeId, version: input.version },
  });
  if (existing) throw new AppError("CONFLICT", "Recipe version already exists", "نسخة الوصفة موجودة بالفعل");
  const version = await tx.recipeVersion.create({
    data: {
      tenantId: input.tenantId,
      recipeId: input.recipeId,
      version: input.version,
      notes: input.notes ?? null,
    },
  });
  await tx.recipeIngredient.createMany({
    data: input.lines.map((line) => ({
      tenantId: input.tenantId,
      versionId: version.id,
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      unitId: line.unitId,
      isAlternative: line.isAlternative ?? false,
      note: line.note ?? null,
    })),
  });
  if (input.instructions?.length) {
    await tx.recipeInstruction.createMany({
      data: input.instructions.map((step) => ({
        tenantId: input.tenantId,
        versionId: version.id,
        step: step.step,
        textAr: step.textAr ?? null,
        textEn: step.textEn ?? null,
      })),
    });
  }
  return version;
}

export async function createRecipe(tx: Db, input: {
  tenantId: string;
  productId: string;
  nameAr: string;
  nameEn: string;
  description?: string;
  prepMinutes?: number;
  bakeTempC?: number | null;
  bakeMinutes?: number | null;
  restMinutes?: number;
  yieldQuantity: number;
  portions?: number;
  laborCost?: number;
  packagingCost?: number;
  overheadCost?: number;
  instructions?: string;
  lines: RecipeLineInput[];
}) {
  const product = await tx.product.findFirst({
    where: { id: input.productId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!product) throw new AppError("NOT_FOUND", "Product not found", "المنتج غير موجود");
  const recipe = await tx.recipe.create({
    data: {
      tenantId: input.tenantId,
      productId: input.productId,
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      description: input.description ?? null,
      prepMinutes: input.prepMinutes ?? 0,
      bakeTempC: input.bakeTempC ?? null,
      bakeMinutes: input.bakeMinutes ?? null,
      restMinutes: input.restMinutes ?? 0,
      yieldQuantity: input.yieldQuantity,
      portions: input.portions ?? 1,
      laborCost: input.laborCost ?? 0,
      packagingCost: input.packagingCost ?? 0,
      overheadCost: input.overheadCost ?? 0,
      instructions: input.instructions ?? null,
      currentVersion: 1,
    },
  });
  await createVersion(tx, {
    tenantId: input.tenantId,
    recipeId: recipe.id,
    version: 1,
    lines: input.lines,
    instructions: input.instructions
      ? [{ step: 1, textAr: input.instructions, textEn: input.instructions }]
      : undefined,
  });
  await recalculateRecipeCost(tx, input.tenantId, recipe.id);
  return recipe;
}

export async function createNewVersion(tx: Db, input: {
  tenantId: string;
  recipeId: string;
  notes?: string;
  lines: RecipeLineInput[];
  changes?: Partial<{
    nameAr: string; nameEn: string; description: string;
    prepMinutes: number; bakeTempC: number | null; bakeMinutes: number | null;
    restMinutes: number; yieldQuantity: number; portions: number;
    laborCost: number; packagingCost: number; overheadCost: number; instructions: string;
  }>;
}) {
  const recipe = await tx.recipe.findFirst({
    where: { id: input.recipeId, tenantId: input.tenantId },
  });
  if (!recipe) throw new AppError("NOT_FOUND", "Recipe not found", "الوصفة غير موجودة");
  const version = recipe.currentVersion + 1;
  await createVersion(tx, {
    tenantId: input.tenantId,
    recipeId: recipe.id,
    version,
    notes: input.notes,
    lines: input.lines,
    instructions: input.changes?.instructions
      ? [{ step: 1, textAr: input.changes.instructions, textEn: input.changes.instructions }]
      : undefined,
  });
  await tx.recipe.update({
    where: { id: recipe.id },
    data: { currentVersion: version, active: true, ...input.changes },
  });
  await recalculateRecipeCost(tx, input.tenantId, recipe.id);
  return tx.recipe.findFirst({ where: { id: recipe.id } });
}
