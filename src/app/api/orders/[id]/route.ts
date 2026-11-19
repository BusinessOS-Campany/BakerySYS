import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { recordOrderPayment, updateOrderStatus } from "@/lib/orders/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "orders.view",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const order = await db.customerOrder.findFirst({
      where: { id, tenantId: auth.user.tenantId },
    });
    if (!order) throw new AppError("NOT_FOUND", "Order not found", "الطلب غير موجود");
    assertBranchAccess(auth, order.branchId);
    const [lines, payments] = await Promise.all([
      db.customerOrderItem.findMany({ where: { tenantId: auth.user.tenantId, orderId: id } }),
      db.customerOrderPayment.findMany({ where: { tenantId: auth.user.tenantId, orderId: id }, orderBy: { paidAt: "desc" } }),
    ]);
    return serialize({ order, lines, payments });
  },
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.string().min(2), batchId: z.string().nullable().optional() }),
  z.object({
    action: z.literal("payment"),
    amount: z.number().positive(),
    kind: z.enum(["DEPOSIT", "BALANCE"]),
    method: z.enum(["CASH", "BANK_TRANSFER", "CARD"]).default("CASH"),
    reference: z.string().optional(),
    paidAt: z.string().datetime().optional(),
  }),
]);

export const POST = apiRoute({
  permission: "orders.manage",
  schema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const order = await db.customerOrder.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      select: { branchId: true },
    });
    if (!order) throw new AppError("NOT_FOUND", "Order not found", "الطلب غير موجود");
    assertBranchAccess(auth, order.branchId);
    if (input.action === "status") {
      const result = await db.$transaction((tx) => updateOrderStatus(tx, {
        tenantId: auth.user.tenantId,
        orderId: id,
        status: input.status,
        batchId: input.batchId ?? null,
        changedById: auth.user.id,
      }));
      return serialize(result);
    }
    const payment = await db.$transaction((tx) => recordOrderPayment(tx, {
      tenantId: auth.user.tenantId,
      orderId: id,
      amount: input.amount,
      kind: input.kind,
      method: input.method,
      reference: input.reference,
      paidAt: input.paidAt ? new Date(input.paidAt) : undefined,
      recordedBy: auth.user.id,
    }));
    return serialize(payment);
  },
});
