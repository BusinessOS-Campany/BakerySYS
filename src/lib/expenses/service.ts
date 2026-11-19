import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { round } from "@/lib/calculations";
import { nextNumber } from "@/lib/sequence";
import { postJournal, reverseJournal, ACCOUNT_CODES } from "@/lib/accounting/ledger";

export async function createExpense(tx: Db, input: {
  tenantId: string;
  branchId: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  expenseDate?: Date;
  amount: number;
  taxAmount?: number;
  vendor?: string;
  description?: string;
  method?: string;
  recordedBy: string;
}) {
  const amount = round(input.amount, 6);
  if (amount <= 0) throw new AppError("VALIDATION", "Amount must be positive", "المبلغ يجب أن يكون موجباً");
  let accountId = input.accountId ?? null;
  if (!accountId && input.categoryId) {
    const category = await tx.expenseCategory.findFirst({
      where: { id: input.categoryId, tenantId: input.tenantId },
      select: { accountId: true },
    });
    if (!category) throw new AppError("NOT_FOUND", "Expense category not found", "تصنيف المصروف غير موجود");
    accountId = category.accountId;
  }
  const number = await nextNumber(tx, input.tenantId, "EXP", "EXP-");
  const expense = await tx.expense.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      categoryId: input.categoryId ?? null,
      accountId: accountId ?? null,
      number,
      expenseDate: input.expenseDate ?? new Date(),
      amount,
      taxAmount: round(input.taxAmount ?? 0, 6),
      vendor: input.vendor ?? null,
      description: input.description ?? null,
      method: input.method ?? "CASH",
      status: "POSTED",
      recordedBy: input.recordedBy,
    },
  });
  const paymentCode = input.method === "BANK_TRANSFER" || input.method === "CARD"
    ? ACCOUNT_CODES.BANK
    : ACCOUNT_CODES.CASH;
  const journal = await postJournal(tx, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    date: input.expenseDate ?? new Date(),
    description: `Expense ${number}${input.description ? ` — ${input.description}` : ""}`,
    referenceType: "EXPENSE",
    referenceId: expense.id,
    createdById: input.recordedBy,
    lines: [
      { accountId: accountId ?? undefined, code: accountId ? undefined : ACCOUNT_CODES.OPERATING_EXPENSE, debit: amount, credit: 0 },
      { code: paymentCode, debit: 0, credit: amount },
    ],
  });
  const postedExpense = await tx.expense.update({
    where: { id: expense.id }, data: { journalId: journal.id },
  });
  return postedExpense;
}

export async function voidExpense(tx: Db, input: {
  tenantId: string;
  expenseId: string;
  recordedBy: string;
}) {
  const expense = await tx.expense.findFirst({
    where: { id: input.expenseId, tenantId: input.tenantId },
  });
  if (!expense) throw new AppError("NOT_FOUND", "Expense not found", "المصروف غير موجود");
  if (expense.status === "VOID") throw new AppError("INVALID_STATE", "Expense already voided", "تم إلغاء المصروف مسبقاً");
  if (expense.journalId) {
    await reverseJournal(tx, {
      tenantId: input.tenantId,
      entryId: expense.journalId,
      createdById: input.recordedBy,
      description: `Void expense ${expense.number}`,
    });
  }
  const voided = await tx.expense.update({
    where: { id: expense.id }, data: { status: "VOID", journalId: null },
  });
  return voided;
}
