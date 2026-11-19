import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { postJournal } from "@/lib/accounting/ledger";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "accounting.view",
  handler: async (_input, auth, req) => {
    const url = new URL(req.url);
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? 25), 1), 100);
    const where = {
      tenantId: auth.user.tenantId,
      ...(auth.branchId ? { branchId: auth.branchId } : {}),
    };
    const [entries, total] = await Promise.all([
      db.journalEntry.findMany({ where, orderBy: { date: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      db.journalEntry.count({ where }),
    ]);
    const [lines, accounts] = await Promise.all([
      db.journalLine.findMany({
        where: { tenantId: auth.user.tenantId, entryId: { in: entries.map((e) => e.id) } },
      }),
      db.account.findMany({
        where: { tenantId: auth.user.tenantId },
        select: { id: true, code: true, nameAr: true, nameEn: true },
      }),
    ]);
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    return serialize({
      items: entries.map((entry) => ({
        ...entry,
        lines: lines
          .filter((line) => line.entryId === entry.id)
          .map((line) => ({
            ...line,
            account: accountMap.get(line.accountId) ?? null,
          })),
      })),
      total, page, pageSize, accounts,
    });
  },
});

const schema = z.object({
  branchId: z.string().nullable().optional(),
  date: z.string().datetime().optional(),
  description: z.string().min(3),
  lines: z.array(z.object({
    accountId: z.string().min(1),
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
    memo: z.string().optional(),
  })).min(2),
});

export const POST = apiRoute({
  permission: "accounting.manage",
  schema,
  idempotent: true,
  handler: async (input, auth) => {
    const branchId = input.branchId ?? auth.branchId ?? null;
    assertBranchAccess(auth, branchId);
    const accountIds = [...new Set(input.lines.map((l) => l.accountId))];
    const accounts = await db.account.findMany({
      where: { tenantId: auth.user.tenantId, id: { in: accountIds }, active: true },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) throw new AppError("NOT_FOUND", "Account not found", "الحساب غير موجود");
    const entry = await db.$transaction((tx) => postJournal(tx, {
      tenantId: auth.user.tenantId,
      branchId,
      date: input.date ? new Date(input.date) : undefined,
      description: input.description,
      referenceType: "MANUAL_JOURNAL",
      createdById: auth.user.id,
      lines: input.lines,
    }));
    return serialize(entry);
  },
});
