import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { journalBalanced, journalTotals, round, type JournalLineInput } from "@/lib/calculations";
import { nextNumber } from "@/lib/sequence";

export const ACCOUNT_CODES = {
  CASH: "1000",
  BANK: "1010",
  RECEIVABLES: "1100",
  RAW_INVENTORY: "1200",
  FINISHED_INVENTORY: "1210",
  PAYABLES: "2000",
  CUSTOMER_ADVANCES: "2100",
  EQUITY: "3000",
  SALES: "4000",
  SALES_RETURNS: "4100",
  COGS: "5000",
  OPERATING_EXPENSE: "6000",
  PAYROLL: "6100",
  OTHER_INCOME: "7000",
} as const;

export type JournalInputLine = { code?: string; accountId?: string; debit?: number; credit?: number; memo?: string };

/**
 * Posts a balanced journal entry. Journal lines are immutable once posted;
 * corrections must use `reverseJournal` and a new entry.
 */
export async function postJournal(tx: Db, input: {
  tenantId: string;
  branchId?: string | null;
  date?: Date;
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdById: string;
  lines: JournalInputLine[];
}) {
  const resolved: JournalLineInput[] = [];
  for (const line of input.lines) {
    let accountId = line.accountId;
    if (!accountId && line.code) {
      const account = await tx.account.findFirst({
        where: { tenantId: input.tenantId, code: line.code },
        select: { id: true, active: true },
      });
      if (!account || !account.active) {
        throw new AppError("INVALID_STATE", `Account ${line.code} is not configured`, "ط§ظ„ط­ط³ط§ط¨ ط؛ظٹط± ظ…ظڈط¹ط¯ ظپظٹ ط¯ظ„ظٹظ„ ط§ظ„ط­ط³ط§ط¨ط§طھ");
      }
      accountId = account.id;
    }
    if (!accountId) throw new AppError("VALIDATION", "Journal line requires an account", "ظƒظ„ ظ‚ظٹط¯ ظٹط­طھط§ط¬ ط¥ظ„ظ‰ ط­ط³ط§ط¨");
    resolved.push({ accountId, debit: Math.abs(round(line.debit ?? 0, 6)), credit: Math.abs(round(line.credit ?? 0, 6)) });
  }
  if (resolved.length < 2) throw new AppError("VALIDATION", "A journal needs at least two lines", "ط§ظ„ظ‚ظٹط¯ ظٹط­طھط§ط¬ ط¥ظ„ظ‰ ط³ط·ط±ظٹظ† ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„");
  if (!journalBalanced(resolved)) {
    const totals = journalTotals(resolved);
    throw new AppError(
      "UNBALANCED_JOURNAL",
      `Journal is not balanced (debit ${totals.debit}, credit ${totals.credit})`,
      "ط§ظ„ظ‚ظٹط¯ ط؛ظٹط± ظ…طھظˆط§ط²ظ† (ط§ظ„ظ…ط¯ظٹظ† ظ„ط§ ظٹط³ط§ظˆظٹ ط§ظ„ط¯ط§ط¦ظ†)",
    );
  }
  const entryNumber = await nextNumber(tx, input.tenantId, "JV", "JV-");
  const entry = await tx.journalEntry.create({
    data: {
      tenantId: input.tenantId, branchId: input.branchId ?? null, entryNumber,
      date: input.date ?? new Date(), description: input.description,
      referenceType: input.referenceType ?? null, referenceId: input.referenceId ?? null,
      status: "POSTED", createdById: input.createdById,
    },
  });
  await tx.journalLine.createMany({
    data: resolved.map((line, i) => ({
      tenantId: input.tenantId, entryId: entry.id, accountId: line.accountId,
      branchId: input.branchId ?? null, debit: line.debit, credit: line.credit,
      memo: input.lines[i]?.memo ?? null,
    })),
  });
  return entry;
}

/** Creates a compensating entry and marks the original as reversed. Never deletes history. */
export async function reverseJournal(tx: Db, input: {
  tenantId: string;
  entryId: string;
  createdById: string;
  description?: string;
}) {
  const original = await tx.journalEntry.findFirst({
    where: { id: input.entryId, tenantId: input.tenantId },
  });
  if (!original) throw new AppError("NOT_FOUND", "Journal entry not found", "ط§ظ„ظ‚ظٹط¯ ط؛ظٹط± ظ…ظˆط¬ظˆط¯");
  if (original.status === "REVERSED") {
    throw new AppError("INVALID_STATE", "Entry already reversed", "طھظ… ط¹ظƒط³ ط§ظ„ظ‚ظٹط¯ ظ…ط³ط¨ظ‚ط§ظ‹");
  }
  const lines = await tx.journalLine.findMany({ where: { entryId: original.id } });
  const reversal = await postJournal(tx, {
    tenantId: input.tenantId,
    branchId: original.branchId,
    date: new Date(),
    description: input.description ?? `Reversal of ${original.entryNumber}`,
    referenceType: "JOURNAL_REVERSAL",
    referenceId: original.id,
    createdById: input.createdById,
    lines: lines.map((l) => ({
      accountId: l.accountId,
      debit: Number(l.credit),
      credit: Number(l.debit),
      memo: `Reversal: ${original.entryNumber}`,
    })),
  });
  await tx.journalEntry.update({
    where: { id: original.id },
    data: { status: "REVERSED" },
  });
  return reversal;
}

export async function accountBalance(tx: Db, tenantId: string, code: string, asOf?: Date): Promise<number> {
  const account = await tx.account.findFirst({ where: { tenantId, code } });
  if (!account) return 0;
  const entries = await tx.journalEntry.findMany({
    where: {
      tenantId, status: "POSTED",
      date: asOf ? { lte: asOf } : undefined,
    },
    select: { id: true },
  });
  const lines = await tx.journalLine.findMany({
    where: { tenantId, accountId: account.id, entryId: { in: entries.map((e) => e.id) } },
    select: { debit: true, credit: true },
  });
  return round(lines.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0), 6);
}
