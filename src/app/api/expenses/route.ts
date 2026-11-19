import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { createExpense } from "@/lib/expenses/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "expenses.view",
  handler: async (_input, auth, req) => {
    const url = new URL(req.url);
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? 25), 1), 100);
    const where = {
      tenantId: auth.user.tenantId,
      ...(auth.branchId ? { branchId: auth.branchId } : {}),
    };
    const [expenses, total] = await Promise.all([
      db.expense.findMany({ where, orderBy: { expenseDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      db.expense.count({ where }),
    ]);
    const categories = await db.expenseCategory.findMany({
      where: { tenantId: auth.user.tenantId, id: { in: expenses.map((e) => e.categoryId).filter((id): id is string => Boolean(id)) } },
      select: { id: true, nameAr: true, nameEn: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    return serialize({
      items: expenses.map((expense) => ({
        ...expense,
        categoryName: expense.categoryId
          ? auth.locale === "ar" ? categoryMap.get(expense.categoryId)?.nameAr : categoryMap.get(expense.categoryId)?.nameEn
          : null,
      })),
      total, page, pageSize,
    });
  },
});

const schema = z.object({
  branchId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  expenseDate: z.string().datetime().optional(),
  amount: z.number().positive(),
  taxAmount: z.number().min(0).optional(),
  vendor: z.string().optional(),
  description: z.string().optional(),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "CHEQUE"]).default("CASH"),
});

export const POST = apiRoute({
  permission: "expenses.manage",
  schema,
  idempotent: true,
  handler: async (input, auth) => {
    const branchId = input.branchId ?? auth.branchId ?? null;
    assertBranchAccess(auth, branchId);
    const expense = await db.$transaction((tx) => createExpense(tx, {
      tenantId: auth.user.tenantId,
      branchId,
      categoryId: input.categoryId ?? null,
      accountId: input.accountId ?? null,
      expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined,
      amount: input.amount,
      taxAmount: input.taxAmount,
      vendor: input.vendor,
      description: input.description,
      method: input.method,
      recordedBy: auth.user.id,
    }));
    return serialize(expense);
  },
});
