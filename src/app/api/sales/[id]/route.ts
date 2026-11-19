import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "sales.view",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const sale = await db.sale.findFirst({ where: { id, tenantId: auth.user.tenantId } });
    if (!sale) throw new AppError("NOT_FOUND", "Sale not found", "الفاتورة غير موجودة");
    assertBranchAccess(auth, sale.branchId);
    const [items, payments, returns] = await Promise.all([
      db.saleItem.findMany({ where: { tenantId: auth.user.tenantId, saleId: id } }),
      db.salePayment.findMany({ where: { tenantId: auth.user.tenantId, saleId: id }, orderBy: { paidAt: "desc" } }),
      db.saleReturn.findMany({ where: { tenantId: auth.user.tenantId, saleId: id }, orderBy: { createdAt: "desc" } }),
    ]);
    return serialize({ sale, items, payments, returns });
  },
});
