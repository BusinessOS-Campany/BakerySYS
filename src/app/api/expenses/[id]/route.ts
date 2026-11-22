import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { deleteExpense, updateExpense, voidExpense } from "@/lib/expenses/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

const updateSchema = z.object({
  branchId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  expenseDate: z.string().datetime().optional(),
  amount: z.number().positive(),
  taxAmount: z.number().min(0).optional(),
  vendor: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "CHEQUE"]).optional(),
});

export const PATCH = apiRoute({
  permission: "expenses.manage",
  schema: updateSchema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const expense = await db.expense.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      select: { branchId: true },
    });
    if (!expense) throw new AppError("NOT_FOUND", "Expense not found", "المصروف غير موجود");
    assertBranchAccess(auth, expense.branchId);
    const result = await db.$transaction((tx) => updateExpense(tx, {
      tenantId: auth.user.tenantId,
      expenseId: id,
      recordedBy: auth.user.id,
      branchId: input.branchId ?? expense.branchId,
      categoryId: input.categoryId,
      accountId: input.accountId,
      expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined,
      amount: input.amount,
      taxAmount: input.taxAmount,
      vendor: input.vendor,
      description: input.description,
      method: input.method,
    }));
    return serialize(result);
  },
});

export const DELETE = apiRoute({
  permission: "expenses.manage",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const expense = await db.expense.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      select: { branchId: true },
    });
    if (!expense) throw new AppError("NOT_FOUND", "Expense not found", "المصروف غير موجود");
    assertBranchAccess(auth, expense.branchId);
    return serialize(await db.$transaction((tx) => deleteExpense(tx, {
      tenantId: auth.user.tenantId,
      expenseId: id,
      recordedBy: auth.user.id,
    })));
  },
});

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
