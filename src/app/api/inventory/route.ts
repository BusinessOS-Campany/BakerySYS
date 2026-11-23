import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { checkLowStock } from "@/lib/notifications/notify";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "inventory.view",
  handler: async (_input, auth, req) => {
    const url = new URL(req.url);
    const warehouseId = url.searchParams.get("warehouseId");
    const warehouseFilter = warehouseId ? { warehouseId } : {};
    const [ingredientStocks, finishedStocks, ingredientLots, finishedLots, adjustments, lowStock] = await Promise.all([
      db.ingredientStock.findMany({
        where: { tenantId: auth.user.tenantId, ...warehouseFilter },
        orderBy: { quantity: "asc" },
        take: 200,
      }),
      db.finishedStock.findMany({
        where: { tenantId: auth.user.tenantId, ...warehouseFilter },
        orderBy: { quantity: "asc" },
        take: 200,
      }),
      db.ingredientLot.findMany({
        where: { tenantId: auth.user.tenantId, ...warehouseFilter, quantity: { gt: 0 } },
        orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
        take: 200,
      }),
      db.finishedLot.findMany({
        where: { tenantId: auth.user.tenantId, ...warehouseFilter, quantity: { gt: 0 } },
        orderBy: [{ expiryDate: "asc" }, { producedAt: "asc" }],
        take: 200,
      }),
      db.stockAdjustment.findMany({
        where: { tenantId: auth.user.tenantId, ...warehouseFilter },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      checkLowStock(db, auth.user.tenantId),
    ]);
    const [ingredients, products, warehouses] = await Promise.all([
      db.ingredient.findMany({
        where: { tenantId: auth.user.tenantId, active: true },
        select: { id: true, nameAr: true, nameEn: true, sku: true, minStock: true, currentCost: true },
      }),
      db.product.findMany({
        where: { tenantId: auth.user.tenantId },
        select: { id: true, nameAr: true, nameEn: true, sku: true, minStock: true },
      }),
      db.warehouse.findMany({
        where: { tenantId: auth.user.tenantId },
        select: { id: true, nameAr: true, nameEn: true },
      }),
    ]);
    return serialize({
      ingredientStocks, finishedStocks, ingredientLots, finishedLots, adjustments, lowStock,
      ingredients, products, warehouses,
    });
  },
});
