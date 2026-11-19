import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { reverseJournal } from "@/lib/accounting/ledger";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const POST = apiRoute({
  permission: "accounting.manage",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const entry = await db.journalEntry.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      select: { branchId: true },
    });
    if (!entry) throw new AppError("NOT_FOUND", "Journal entry not found", "القيد غير موجود");
    assertBranchAccess(auth, entry.branchId);
    const reversal = await db.$transaction((tx) => reverseJournal(tx, {
      tenantId: auth.user.tenantId,
      entryId: id,
      createdById: auth.user.id,
    }));
    return serialize(reversal);
  },
});
