import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { createNewVersion } from "@/lib/recipes/service";
import { recalculateRecipeCost, latestSnapshot, recipeRequirements } from "@/lib/recipes/costing";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "recipes.view",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const recipe = await db.recipe.findFirst({ where: { id, tenantId: auth.user.tenantId } });
    if (!recipe) throw new AppError("NOT_FOUND", "Recipe not found", "الوصفة غير موجودة");
    const version = await db.recipeVersion.findFirst({
      where: { tenantId: auth.user.tenantId, recipeId: id, version: recipe.currentVersion },
    });
    if (!version) throw new AppError("NOT_FOUND", "Recipe version not found", "نسخة الوصفة غير موجودة");
    const [lines, instructions, snapshot] = await Promise.all([
      recipeRequirements(db, auth.user.tenantId, version.id, 1),
      db.recipeInstruction.findMany({ where: { tenantId: auth.user.tenantId, versionId: version.id }, orderBy: { step: "asc" } }),
      latestSnapshot(db, auth.user.tenantId, id),
    ]);
    return serialize({ recipe, version, lines, instructions, snapshot });
  },
});

const schema = z.object({
  action: z.literal("version"),
  notes: z.string().optional(),
  lines: z.array(z.object({
    ingredientId: z.string().min(1),
    quantity: z.number().positive(),
    unitId: z.string().min(1),
    isAlternative: z.boolean().optional(),
    note: z.string().optional(),
  })).min(1),
  changes: z.object({
    nameAr: z.string().optional(), nameEn: z.string().optional(), description: z.string().optional(),
    prepMinutes: z.number().optional(), bakeTempC: z.number().nullable().optional(),
    bakeMinutes: z.number().nullable().optional(), restMinutes: z.number().optional(),
    yieldQuantity: z.number().positive().optional(), portions: z.number().int().positive().optional(),
    laborCost: z.number().optional(), packagingCost: z.number().optional(),
    overheadCost: z.number().optional(), instructions: z.string().optional(),
  }).optional(),
});

export const POST = apiRoute({
  permission: "recipes.manage",
  schema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const recipe = await db.$transaction((tx) => createNewVersion(tx, {
      tenantId: auth.user.tenantId,
      recipeId: id,
      notes: input.notes,
      lines: input.lines,
      changes: input.changes,
    }));
    return serialize(recipe);
  },
});

export const PATCH = apiRoute({
  permission: "recipes.manage",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const result = await db.$transaction((tx) => recalculateRecipeCost(tx, auth.user.tenantId, id));
    return serialize(result);
  },
});
