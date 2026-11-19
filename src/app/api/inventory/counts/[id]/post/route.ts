import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { postStockCount } from "@/lib/inventory/workflows";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const POST = apiRoute({
  permission: "inventory.adjust",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const count = await db.stockCount.findFirst({
      where: { id, tenantId: auth.user.tenantId },
    });
    if (!count) throw new AppError("NOT_FOUND", "Stock count not found", "الجرد غير موجود");
    const warehouse = await db.warehouse.findFirst({
      where: { id: count.warehouseId, tenantId: auth.user.tenantId },
      select: { branchId: true },
    });
    assertBranchAccess(auth, warehouse?.branchId);
    const posted = await db.$transaction((tx) => postStockCount(tx, {
      tenantId: auth.user.tenantId,
      countId: id,
      approvedById: auth.user.id,
    }));
    return serialize(posted);
  },
});
