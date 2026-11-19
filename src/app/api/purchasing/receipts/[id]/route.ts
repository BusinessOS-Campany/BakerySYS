import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { paySupplier } from "@/lib/purchasing/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "purchases.view",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const receipt = await db.goodsReceipt.findFirst({
      where: { id, tenantId: auth.user.tenantId },
    });
    if (!receipt) throw new AppError("NOT_FOUND", "Receipt not found", "إيصال الاستلام غير موجود");
    if (receipt.orderId) {
      const order = await db.purchaseOrder.findFirst({
        where: { id: receipt.orderId, tenantId: auth.user.tenantId },
        select: { branchId: true },
      });
      assertBranchAccess(auth, order?.branchId);
    }
    const [lines, payables, payments] = await Promise.all([
      db.goodsReceiptItem.findMany({ where: { tenantId: auth.user.tenantId, receiptId: id } }),
      db.supplierPayable.findMany({
        where: { tenantId: auth.user.tenantId, sourceType: "GOODS_RECEIPT", sourceId: id },
      }),
      db.supplierPayment.findMany({
        where: { tenantId: auth.user.tenantId, supplierId: receipt.supplierId },
        orderBy: { paidAt: "desc" },
        take: 50,
      }),
    ]);
    return serialize({ receipt, lines, payables, payments });
  },
});

const schema = z.object({
  action: z.literal("payment"),
  amount: z.number().positive(),
  method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "CARD"]).default("CASH"),
  reference: z.string().optional(),
  paidAt: z.string().datetime().optional(),
});

/** Records a supplier payment for the receipt's supplier and reduces the payable balance. */
export const POST = apiRoute({
  permission: "purchases.manage",
  schema,
  idempotent: true,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const receipt = await db.goodsReceipt.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      select: { supplierId: true, orderId: true },
    });
    if (!receipt) throw new AppError("NOT_FOUND", "Receipt not found", "إيصال الاستلام غير موجود");
    if (receipt.orderId) {
      const order = await db.purchaseOrder.findFirst({
        where: { id: receipt.orderId, tenantId: auth.user.tenantId },
        select: { branchId: true },
      });
      assertBranchAccess(auth, order?.branchId);
    }
    const payable = await db.supplierPayable.findFirst({
      where: { tenantId: auth.user.tenantId, sourceType: "GOODS_RECEIPT", sourceId: id, status: { in: ["OPEN", "PARTIAL"] } },
      orderBy: { createdAt: "asc" },
    });
    const outstanding = payable ? Number(payable.amount) - Number(payable.settled) : 0;
    if (payable && input.amount > outstanding + 0.000001) {
      throw new AppError("VALIDATION", "Payment exceeds outstanding balance", "المبلغ أكبر من الرصيد المستحق");
    }
    const payment = await db.$transaction((tx) => {
      const created = paySupplier(tx, {
        tenantId: auth.user.tenantId,
        supplierId: receipt.supplierId,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        paidAt: input.paidAt ? new Date(input.paidAt) : undefined,
        recordedBy: auth.user.id,
      });
      if (payable) {
        return created.then(async (value) => {
          const settled = Number(payable.settled) + input.amount;
          await tx.supplierPayable.update({
            where: { id: payable.id },
            data: {
              settled,
              status: settled >= Number(payable.amount) - 0.000001 ? "PAID" : "PARTIAL",
            },
          });
          return value;
        });
      }
      return created;
    });
    return serialize(payment);
  },
});
