import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";
import { updateSaleQuantities, voidSale } from "@/lib/sales/service";

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

const editSchema = z.object({
  lines: z.array(z.object({
    saleItemId: z.string().min(1),
    quantity: z.number().positive(),
  })).min(1),
});

/** Edits invoice quantities; cashiers may correct their own sales. */
export const PATCH = apiRoute({
  permission: "sales.create",
  schema: editSchema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const result = await db.$transaction((tx) =>
      updateSaleQuantities(tx, auth, { saleId: id, lines: input.lines }));
    return serialize(result);
  },
});

/** Cancels an invoice with full stock/accounting reversal (audit trail kept). */
export const DELETE = apiRoute({
  permission: "sales.create",
  handler: async (_input, auth, req, ctx) => {
    const { id } = await ctx.params;
    const reason = new URL(req.url).searchParams.get("reason") ?? undefined;
    const result = await db.$transaction((tx) => voidSale(tx, auth, { saleId: id, reason }));
    return serialize(result);
  },
});
