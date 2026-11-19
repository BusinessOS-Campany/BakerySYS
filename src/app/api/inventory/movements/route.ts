import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "inventory.view",
  handler: async (_input, auth, req) => {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") === "FINISHED" ? "FINISHED" : "RAW";
    const warehouseId = url.searchParams.get("warehouseId");
    const itemId = url.searchParams.get("itemId");
    const filter = {
      tenantId: auth.user.tenantId,
      ...(warehouseId ? { warehouseId } : {}),
      ...(itemId ? (type === "RAW" ? { ingredientId: itemId } : { productId: itemId }) : {}),
    };
    const movements = type === "RAW"
      ? await db.ingredientMovement.findMany({ where: filter, orderBy: { createdAt: "desc" }, take: 200 })
      : await db.finishedMovement.findMany({ where: filter, orderBy: { createdAt: "desc" }, take: 200 });
    return serialize({ type, items: movements });
  },
});
