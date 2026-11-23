import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { assertBranchAccess, type AuthContext } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { computeExpectedCash, round } from "@/lib/calculations";
import { sessionCashTotals } from "@/lib/sales/service";
import { serialize } from "@/lib/serialize";

const updateSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().trim().max(200).nullable().optional(),
});

/** Only POS cash disbursements of an open register may be changed. */
async function loadEditableCashOut(id: string, auth: AuthContext) {
  const movement = await db.cashMovement.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!movement) {
    throw new AppError("NOT_FOUND", "Cash movement not found", "حركة الصندوق غير موجودة");
  }
  const session = await db.cashSession.findFirst({
    where: { id: movement.sessionId, tenantId: auth.user.tenantId },
  });
  if (!session) throw new AppError("NOT_FOUND", "Session not found", "الوردية غير موجودة");
  assertBranchAccess(auth, session.branchId);
  if (movement.kind !== "OUT") {
    throw new AppError("INVALID_STATE", "Only cash disbursements can be changed", "يمكن تعديل صرف الصندوق فقط");
  }
  if (session.status !== "OPEN") {
    throw new AppError("INVALID_STATE", "Register is closed", "الصندوق مغلق");
  }
  return { movement, session };
}

export const PATCH = apiRoute({
  permission: "pos.close",
  schema: updateSchema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const { movement, session } = await loadEditableCashOut(id, auth);
    const amount = round(input.amount, 6);

    // The current balance already contains this disbursement, so add its old
    // value back before checking the new one against the drawer.
    const totals = await sessionCashTotals(db, auth, session.id);
    const available = computeExpectedCash({
      openingBalance: session.openingBalance,
      ...totals,
    }) + Number(movement.amount);
    if (amount > available + 0.000001) {
      throw new AppError(
        "VALIDATION",
        `Insufficient cash in drawer. Available: ${available}`,
        `الرصيد المتاح في الصندوق غير كافٍ. المتاح: ${available}`,
      );
    }

    const updated = await db.cashMovement.update({
      where: { id: movement.id },
      data: { amount, reason: (input.reason ?? "").trim() || null },
    });
    return serialize(updated);
  },
});

export const DELETE = apiRoute({
  permission: "pos.close",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const { movement } = await loadEditableCashOut(id, auth);
    await db.cashMovement.delete({ where: { id: movement.id } });
    return serialize({ id: movement.id });
  },
});
