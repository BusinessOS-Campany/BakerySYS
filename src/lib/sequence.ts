import type { Db } from "@/lib/db";

/** Atomic, gap-tolerant document numbering scoped to tenant + document type. */
export async function nextNumber(
  tx: Db,
  tenantId: string,
  docType: string,
  prefix: string,
  scope = "GLOBAL",
): Promise<string> {
  const client = tx;
  const key = { tenantId_docType_scope: { tenantId, docType, scope } };
  const seq = await client.numberSequence.upsert({
    where: key,
    create: { tenantId, docType, scope, prefix, nextValue: 2 },
    update: { prefix, nextValue: { increment: 1 } },
  });
  return `${prefix}${String(seq.nextValue - 1).padStart(6, "0")}`;
}
