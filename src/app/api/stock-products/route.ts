import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { round } from "@/lib/calculations";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  nameAr: z.string().trim().min(1).max(120),
  unitId: z.string().optional(),
  currentCost: z.number().min(0).max(1_000_000_000).optional(),
});

/** Raw-material products available to the inventory add-to-stock form. */
export const GET = apiRoute({
  permission: "ingredients.view",
  handler: async (_input, auth) => {
    const tenantId = auth.user.tenantId;
    const [items, units] = await Promise.all([
      db.ingredient.findMany({
        where: { tenantId, active: true },
        select: {
          id: true, sku: true, nameAr: true, nameEn: true, baseUnitId: true,
          currentCost: true, minStock: true, active: true,
        },
        orderBy: { nameAr: "asc" },
        take: 300,
      }),
      db.unitOfMeasure.findMany({
        where: { tenantId, active: true },
        select: { id: true, code: true, nameAr: true, nameEn: true },
        orderBy: { code: "asc" },
      }),
    ]);
    return serialize({ items, units });
  },
});

export const POST = apiRoute({
  permission: "ingredients.manage",
  schema,
  idempotent: true,
  handler: async (input, auth) => {
    const tenantId = auth.user.tenantId;
    const units = await db.unitOfMeasure.findMany({
      where: { tenantId, active: true },
      select: { id: true, code: true, nameAr: true, nameEn: true },
      orderBy: { code: "asc" },
    });
    if (!units.length) {
      throw new AppError("NOT_FOUND", "No unit of measure configured", "لا توجد وحدة قياس معرّفة");
    }
    const unit = (input.unitId && units.find((entry) => entry.id === input.unitId))
      || units.find((entry) => entry.code === "kg")
      || units[0];

    const sku = `ING-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    const product = await db.ingredient.create({
      data: {
        tenantId,
        sku,
        nameAr: input.nameAr,
        nameEn: input.nameAr,
        baseUnitId: unit.id,
        purchaseUnitId: unit.id,
        currentCost: round(input.currentCost ?? 0, 6),
        active: true,
      },
    });
    return serialize(product);
  },
});
