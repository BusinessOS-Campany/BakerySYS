import { randomUUID } from "node:crypto";
import { db, type Db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth/session";

export function requestId(): string {
  return randomUUID();
}

export async function audit(
  auth: AuthContext | null,
  input: {
    action: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    requestId?: string;
    ipAddress?: string | null;
    tenantId?: string;
  },
  tx?: Db,
): Promise<void> {
  const client = tx ?? db;
  await client.auditLog.create({
    data: {
      tenantId: input.tenantId ?? auth?.user.tenantId ?? "",
      userId: auth?.user.id ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before: (input.before ?? undefined) as never,
      after: (input.after ?? undefined) as never,
      requestId: input.requestId ?? requestId(),
      ipAddress: input.ipAddress?.slice(0, 100) ?? null,
    },
  });
}
