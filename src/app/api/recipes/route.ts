import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { createRecipe } from "@/lib/recipes/service";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "recipes.view",
  handler: async (_input, auth) => {
    const recipes = await db.recipe.findMany({
      where: { tenantId: auth.user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const [products, snapshots] = await Promise.all([
      db.product.findMany({
        where: { tenantId: auth.user.tenantId, id: { in: recipes.map((r) => r.productId) } },
        select: { id: true, nameAr: true, nameEn: true, sku: true },
      }),
      db.recipeCostSnapshot.findMany({
        where: { tenantId: auth.user.tenantId, recipeId: { in: recipes.map((r) => r.id) } },
        orderBy: { calculatedAt: "desc" },
      }),
    ]);
    const productMap = new Map(products.map((p) => [p.id, p]));
    const latest = new Map<string, (typeof snapshots)[number]>();
    for (const snap of snapshots) if (!latest.has(snap.recipeId)) latest.set(snap.recipeId, snap);
    return serialize({
      items: recipes.map((recipe) => ({
        ...recipe,
        productName: auth.locale === "ar"
          ? productMap.get(recipe.productId)?.nameAr ?? recipe.productId
          : productMap.get(recipe.productId)?.nameEn ?? recipe.productId,
        snapshot: latest.get(recipe.id) ?? null,
      })),
    });
  },
});

const schema = z.object({
  productId: z.string().min(1),
  nameAr: z.string().min(2),
  nameEn: z.string().min(2),
  description: z.string().optional(),
  prepMinutes: z.number().min(0).optional(),
  bakeTempC: z.number().min(0).nullable().optional(),
  bakeMinutes: z.number().min(0).nullable().optional(),
  restMinutes: z.number().min(0).optional(),
  yieldQuantity: z.number().positive(),
  portions: z.number().int().positive().optional(),
  laborCost: z.number().min(0).optional(),
  packagingCost: z.number().min(0).optional(),
  overheadCost: z.number().min(0).optional(),
  instructions: z.string().optional(),
  lines: z.array(z.object({
    ingredientId: z.string().min(1),
    quantity: z.number().positive(),
    unitId: z.string().min(1),
    isAlternative: z.boolean().optional(),
    note: z.string().optional(),
  })).min(1),
});

export const POST = apiRoute({
  permission: "recipes.manage",
  schema,
  handler: async (input, auth) => {
    const recipe = await db.$transaction((tx) => createRecipe(tx, {
      tenantId: auth.user.tenantId,
      ...input,
    }));
    return serialize(recipe);
  },
});
