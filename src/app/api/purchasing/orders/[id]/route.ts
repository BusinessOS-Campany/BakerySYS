import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { approvePurchaseOrder } from "@/lib/purchasing/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "purchases.view",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const order = await db.purchaseOrder.findFirst({
      where: { id, tenantId: auth.user.tenantId },
    });
    if (!order) throw new AppError("NOT_FOUND", "Order not found", "أمر الشراء غير موجود");
    assertBranchAccess(auth, order.branchId);
    const lines = await db.purchaseOrderItem.findMany({
      where: { tenantId: auth.user.tenantId, orderId: id },
    });
    return serialize({ order, lines });
  },
});

const schema = z.object({ action: z.literal("approve") });

export const POST = apiRoute({
  permission: "purchases.approve",
  schema,
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const order = await db.purchaseOrder.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      select: { branchId: true },
    });
    if (!order) throw new AppError("NOT_FOUND", "Order not found", "أمر الشراء غير موجود");
    assertBranchAccess(auth, order.branchId);
    const approved = await db.$transaction((tx) => approvePurchaseOrder(tx, {
      tenantId: auth.user.tenantId,
      orderId: id,
      approvedById: auth.user.id,
    }));
    return serialize(approved);
  },
});
