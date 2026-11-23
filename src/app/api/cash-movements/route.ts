import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { recordCashOut } from "@/lib/sales/service";
import { serialize } from "@/lib/serialize";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

const sessionSchema = z.object({ sessionId: z.string().min(1) });

export const GET = apiRoute({
  permission: "pos.close",
  handler: async (_input, auth, req) => {
    const { sessionId } = sessionSchema.parse({ sessionId: new URL(req.url).searchParams.get("sessionId") ?? "" });
    const session = await db.cashSession.findFirst({
      where: { id: sessionId, tenantId: auth.user.tenantId },
    });
    if (!session) throw new AppError("NOT_FOUND", "Session not found", "الوردية غير موجودة");
    assertBranchAccess(auth, session.branchId);
    const [items, sales] = await Promise.all([
      db.cashMovement.findMany({
        where: { tenantId: auth.user.tenantId, sessionId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.sale.findMany({
        where: { tenantId: auth.user.tenantId, cashSessionId: sessionId },
        select: { id: true, invoiceNumber: true, status: true, refundedAmount: true },
      }),
    ]);
    const byInvoice = new Map(sales.map((sale) => [sale.invoiceNumber, sale]));
    const enriched = items.map((movement) => {
      const sale = movement.reference ? byInvoice.get(movement.reference) ?? null : null;
      return {
        ...movement,
        saleId: sale?.id ?? null,
        saleStatus: sale?.status ?? null,
        saleRefundedAmount: sale ? Number(sale.refundedAmount) : 0,
      };
    });
    return serialize({ items: enriched });
  },
});

const cashOutSchema = z.object({
  sessionId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().trim().max(200).optional(),
});

export const POST = apiRoute({
  permission: "pos.close",
  schema: cashOutSchema,
  idempotent: true,
  handler: async (input, auth) => {
    const movement = await db.$transaction((tx) => recordCashOut(tx, auth, input));
    return serialize(movement);
  },
});
