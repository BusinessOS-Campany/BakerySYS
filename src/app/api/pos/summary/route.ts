import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { computeExpectedCash } from "@/lib/calculations";
import { sessionCashTotals } from "@/lib/sales/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "sales.create",
  handler: async (_input, auth, req) => {
    const sessionId = new URL(req.url).searchParams.get("sessionId");
    if (!sessionId) throw new AppError("VALIDATION", "Session is required", "الوردية مطلوبة");
    const session = await db.cashSession.findFirst({
      where: { id: sessionId, tenantId: auth.user.tenantId },
    });
    if (!session) throw new AppError("NOT_FOUND", "Session not found", "الوردية غير موجودة");
    assertBranchAccess(auth, session.branchId);
    const totals = await sessionCashTotals(db, auth, session.id);
    const summary = {
      openingBalance: Number(session.openingBalance),
      expectedCash: computeExpectedCash({ openingBalance: session.openingBalance, ...totals }),
      ...totals,
    };
    return serialize({ summary });
  },
});
