import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { openCashSession, closeCashSession } from "@/lib/sales/service";
import { serialize } from "@/lib/serialize";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

export const GET = apiRoute({
  permission: "pos.open",
  handler: async (_input, auth) => {
    const sessions = await db.cashSession.findMany({
      where: {
        tenantId: auth.user.tenantId,
        ...(auth.branchId ? { branchId: auth.branchId } : {}),
      },
      orderBy: { openedAt: "desc" },
      take: 20,
    });
    const registers = await db.cashRegister.findMany({
      where: { tenantId: auth.user.tenantId, active: true, ...(auth.branchId ? { branchId: auth.branchId } : {}) },
      orderBy: { code: "asc" },
    });
    return serialize({ sessions, registers });
  },
});

const openSchema = z.object({ registerId: z.string(), openingBalance: z.number().min(0).default(0) });
export const POST = apiRoute({
  permission: "pos.open",
  schema: openSchema,
  handler: async (input, auth) => {
    const register = await db.cashRegister.findFirst({
      where: { id: input.registerId, tenantId: auth.user.tenantId },
    });
    if (!register) throw new AppError("NOT_FOUND", "Register not found", "الصندوق غير موجود");
    assertBranchAccess(auth, register.branchId);
    const session = await db.$transaction((tx) => openCashSession(tx, auth, input));
    return serialize(session);
  },
});

const closeSchema = z.object({ sessionId: z.string(), actualClosing: z.number().min(0), notes: z.string().optional() });
export const PATCH = apiRoute({
  permission: "pos.close",
  schema: closeSchema,
  handler: async (input, auth) => {
    const session = await db.cashSession.findFirst({ where: { id: input.sessionId, tenantId: auth.user.tenantId } });
    if (!session) throw new AppError("NOT_FOUND", "Session not found", "الوردية غير موجودة");
    assertBranchAccess(auth, session.branchId);
    const closed = await db.$transaction((tx) => closeCashSession(tx, auth, input));
    return serialize(closed);
  },
});
