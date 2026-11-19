import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { voidExpense } from "@/lib/expenses/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const POST = apiRoute({
  permission: "expenses.manage",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const expense = await db.expense.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      select: { branchId: true },
    });
    if (!expense) throw new AppError("NOT_FOUND", "Expense not found", "المصروف غير موجود");
    assertBranchAccess(auth, expense.branchId);
    const result = await db.$transaction((tx) => voidExpense(tx, {
      tenantId: auth.user.tenantId,
      expenseId: id,
      recordedBy: auth.user.id,
    }));
    return serialize(result);
  },
});
