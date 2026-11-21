import { z } from "zod";
import { db, type Db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { round } from "@/lib/calculations";
import { audit, requestId } from "@/lib/audit";

export type CustomerTransactionKind = "DEBT" | "PAYMENT";

export type CustomerTransactionItem = {
  id: string;
  tenantId: string;
  customerId: string;
  customerCode: string;
  customerNameAr: string;
  customerNameEn: string;
  kind: CustomerTransactionKind;
  amount: number;
  notes: string | null;
  sourceType: string | null;
  sourceId: string | null;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
};

export const createTransactionSchema = z.object({
  customerId: z.string().min(1),
  kind: z.enum(["DEBT", "PAYMENT"]),
  amount: z.coerce.number().finite().positive(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

type Row = {
  id: string;
  tenantId: string;
  customerId: string;
  kind: string;
  amount: { toString(): string };
  notes: string | null;
  sourceType: string | null;
  sourceId: string | null;
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

type CustomerLookup = { id: string; code: string; nameAr: string; nameEn: string };

function normalizeKind(value: string): CustomerTransactionKind {
  if (value === "DEBT" || value === "PAYMENT") return value;
  throw new AppError("VALIDATION", "Invalid transaction kind", "نوع العملية غير صالح");
}

function effect(kind: CustomerTransactionKind, amount: number): number {
  return round(kind === "DEBT" ? amount : -amount, 4);
}

async function customerLookup(tenantId: string, customerId: string, tx?: Db): Promise<CustomerLookup> {
  const client = tx ?? db;
  const customer = await client.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { id: true, code: true, nameAr: true, nameEn: true },
  });
  if (!customer) throw new AppError("NOT_FOUND", "Customer not found", "العميل غير موجود");
  return customer;
}

function serialize(row: Row, customer: CustomerLookup): CustomerTransactionItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    customerCode: customer.code,
    customerNameAr: customer.nameAr,
    customerNameEn: customer.nameEn,
    kind: normalizeKind(row.kind),
      amount: round(Number(row.amount), 4),
      notes: row.notes,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      entryDate: row.entryDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTransactions(
  tenantId: string,
  customerId?: string,
): Promise<CustomerTransactionItem[]> {
  const rows = await db.customerTransaction.findMany({
    where: { tenantId, ...(customerId ? { customerId } : {}) },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
  });
  const customers = await db.customer.findMany({
    where: { tenantId },
    select: { id: true, code: true, nameAr: true, nameEn: true },
  });
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  return rows
    .filter((row) => customerMap.has(row.customerId))
    .map((row) => serialize(row as Row, customerMap.get(row.customerId)!));
}

export async function createTransaction(
  input: z.infer<typeof createTransactionSchema>,
  auth: AuthContext,
): Promise<CustomerTransactionItem> {
  const rid = requestId();
  const amount = round(input.amount, 4);
  if (amount <= 0) throw new AppError("VALIDATION", "Amount must be positive", "المبلغ يجب أن يكون أكبر من صفر");

  const row = await db.$transaction(async (tx) => {
    const customer = await customerLookup(auth.user.tenantId, input.customerId, tx);
    const created = await tx.customerTransaction.create({
      data: {
        tenantId: auth.user.tenantId,
        customerId: customer.id,
        kind: input.kind,
        amount,
        notes: input.notes?.trim() || null,
        entryDate: new Date(),
      },
    });
    await tx.customer.update({
      where: { id: customer.id },
      data: { balance: { increment: effect(input.kind, amount) } },
    });
    const result = serialize(created as Row, customer);
    await audit(auth, {
      action: "CREATE",
      entity: "CUSTOMER_TRANSACTION",
      entityId: created.id,
      after: result,
      requestId: rid,
    }, tx);
    return result;
  });
  return row;
}

export async function updateTransaction(
  id: string,
  input: z.infer<typeof updateTransactionSchema>,
  auth: AuthContext,
): Promise<CustomerTransactionItem> {
  const rid = requestId();
  const tenantId = auth.user.tenantId;
  const existing = await db.customerTransaction.findFirst({ where: { id, tenantId } });
  if (!existing) throw new AppError("NOT_FOUND", "Transaction not found", "العملية غير موجودة");
  if (Object.keys(input).length === 0) {
    const customer = await customerLookup(tenantId, existing.customerId);
    return serialize(existing as Row, customer);
  }

  const oldKind = normalizeKind(existing.kind);
  const oldAmount = round(Number(existing.amount), 4);
  const nextCustomerId = input.customerId ?? existing.customerId;
  const nextKind = input.kind ? normalizeKind(input.kind) : oldKind;
  const nextAmount = input.amount === undefined ? oldAmount : round(input.amount, 4);
  if (nextAmount <= 0) throw new AppError("VALIDATION", "Amount must be positive", "المبلغ يجب أن يكون أكبر من صفر");

  const result = await db.$transaction(async (tx) => {
    const customer = await customerLookup(tenantId, nextCustomerId, tx);
    const oldCustomer = await customerLookup(tenantId, existing.customerId, tx);
    const before = serialize(existing as Row, oldCustomer);

    const updated = await tx.customerTransaction.update({
      where: { id },
      data: {
        customerId: customer.id,
        kind: nextKind,
        amount: nextAmount,
        ...(input.notes === undefined ? {} : { notes: input.notes?.trim() || null }),
      },
    });

    const oldEffect = effect(oldKind, oldAmount);
    const newEffect = effect(nextKind, nextAmount);
    if (nextCustomerId === existing.customerId) {
      await tx.customer.update({
        where: { id: customer.id },
        data: { balance: { increment: round(newEffect - oldEffect, 4) } },
      });
    } else {
      await tx.customer.update({
        where: { id: existing.customerId },
        data: { balance: { increment: round(-oldEffect, 4) } },
      });
      await tx.customer.update({
        where: { id: customer.id },
        data: { balance: { increment: newEffect } },
      });
    }

    const after = serialize(updated as Row, customer);
    await audit(auth, {
      action: "UPDATE",
      entity: "CUSTOMER_TRANSACTION",
      entityId: id,
      before,
      after,
      requestId: rid,
    }, tx);
    return after;
  });
  return result;
}

export async function deleteTransaction(id: string, auth: AuthContext): Promise<{ ok: true }> {
  const rid = requestId();
  const tenantId = auth.user.tenantId;
  const existing = await db.customerTransaction.findFirst({ where: { id, tenantId } });
  if (!existing) throw new AppError("NOT_FOUND", "Transaction not found", "العملية غير موجودة");

  await db.$transaction(async (tx) => {
    const customer = await customerLookup(tenantId, existing.customerId, tx);
    const before = serialize(existing as Row, customer);
    await tx.customer.update({
      where: { id: existing.customerId },
      data: { balance: { increment: round(-effect(normalizeKind(existing.kind), round(Number(existing.amount), 4)), 4) } },
    });
    await tx.customerTransaction.delete({ where: { id } });
    await audit(auth, {
      action: "DELETE",
      entity: "CUSTOMER_TRANSACTION",
      entityId: id,
      before,
      requestId: rid,
    }, tx);
  });
  return { ok: true };
}
