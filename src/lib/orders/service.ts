import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { round } from "@/lib/calculations";
import { nextNumber } from "@/lib/sequence";
import { postJournal, ACCOUNT_CODES } from "@/lib/accounting/ledger";
import { notify } from "@/lib/notifications/notify";

export type OrderLineInput = {
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
};

export async function createOrder(tx: Db, input: {
  tenantId: string;
  branchId: string | null;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  productId?: string | null;
  cakeSize?: string;
  weightKg?: number | null;
  shape?: string;
  flavor?: string;
  filling?: string;
  decoration?: string;
  message?: string;
  allergies?: string;
  specialNotes?: string;
  requestedPickup?: Date | null;
  requestedDelivery?: Date | null;
  deliveryAddress?: string;
  assignedBakerId?: string | null;
  createdById: string;
  lines: OrderLineInput[];
}) {
  if (!input.lines.length) throw new AppError("VALIDATION", "Order has no items", "الطلب لا يحتوي على بنود");
  const quotedAmount = round(input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), 6);
  if (quotedAmount <= 0) throw new AppError("VALIDATION", "Order total must be positive", "إجمالي الطلب يجب أن يكون موجباً");
  const number = await nextNumber(tx, input.tenantId, "ORD", "ORD-");
  const order = await tx.customerOrder.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      number,
      customerId: input.customerId ?? null,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      productId: input.productId ?? input.lines[0]?.productId ?? null,
      cakeSize: input.cakeSize ?? null,
      weightKg: input.weightKg ?? null,
      shape: input.shape ?? null,
      flavor: input.flavor ?? null,
      filling: input.filling ?? null,
      decoration: input.decoration ?? null,
      message: input.message ?? null,
      allergies: input.allergies ?? null,
      specialNotes: input.specialNotes ?? null,
      requestedPickup: input.requestedPickup ?? null,
      requestedDelivery: input.requestedDelivery ?? null,
      deliveryAddress: input.deliveryAddress ?? null,
      assignedBakerId: input.assignedBakerId ?? null,
      status: "NEW",
      quotedAmount,
      totalAmount: quotedAmount,
      createdById: input.createdById,
    },
  });
  await tx.customerOrderItem.createMany({
    data: input.lines.map((line) => ({
      tenantId: input.tenantId,
      orderId: order.id,
      productId: line.productId ?? null,
      name: line.name,
      quantity: round(line.quantity, 6),
      unitPrice: round(line.unitPrice, 6),
      lineTotal: round(line.quantity * line.unitPrice, 6),
    })),
  });
  await notify(tx, {
    tenantId: input.tenantId,
    titleAr: "طلب مخصص جديد", titleEn: "New custom order",
    bodyAr: `الطلب ${number} بقيمة ${quotedAmount}`, bodyEn: `Order ${number} worth ${quotedAmount}`,
    kind: "ORDERS", link: `/orders/${order.id}`,
  });
  return order;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["READY", "CANCELLED"],
  READY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export async function updateOrderStatus(tx: Db, input: {
  tenantId: string;
  orderId: string;
  status: string;
  batchId?: string | null;
  changedById: string;
}) {
  const order = await tx.customerOrder.findFirst({
    where: { id: input.orderId, tenantId: input.tenantId },
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found", "الطلب غير موجود");
  if (!ALLOWED_TRANSITIONS[order.status]?.includes(input.status)) {
    throw new AppError(
      "INVALID_STATE",
      `Cannot move order from ${order.status} to ${input.status}`,
      "تغيير حالة الطلب غير مسموح",
    );
  }
  const updated = await tx.customerOrder.update({
    where: { id: order.id },
    data: {
      status: input.status,
      ...(input.batchId ? { batchId: input.batchId } : {}),
    },
  });
  const balance = round(Number(order.quotedAmount) - Number(order.paidAmount), 6);
  if (input.status === "READY" && balance > 0 && order.customerId) {
    const existing = await tx.customerReceivable.findFirst({
      where: { tenantId: input.tenantId, sourceType: "ORDER", sourceId: order.id },
    });
    if (!existing) {
      await tx.customerReceivable.create({
        data: {
          tenantId: input.tenantId,
          customerId: order.customerId ?? "__walkin__",
          sourceType: "ORDER",
          sourceId: order.id,
          amount: balance,
          status: "OPEN",
        },
      });
    }
  }
  await notify(tx, {
    tenantId: input.tenantId,
    titleAr: "تحديث حالة الطلب", titleEn: "Order status updated",
    bodyAr: `الطلب ${order.number}: ${input.status}`, bodyEn: `Order ${order.number}: ${input.status}`,
    kind: "ORDERS", link: `/orders/${order.id}`,
  });
  return updated;
}

export async function recordOrderPayment(tx: Db, input: {
  tenantId: string;
  orderId: string;
  amount: number;
  kind: "DEPOSIT" | "BALANCE";
  method: string;
  reference?: string;
  paidAt?: Date;
  recordedBy: string;
}) {
  const order = await tx.customerOrder.findFirst({
    where: { id: input.orderId, tenantId: input.tenantId },
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found", "الطلب غير موجود");
  const amount = round(input.amount, 6);
  if (amount <= 0) throw new AppError("VALIDATION", "Payment must be positive", "المبلغ يجب أن يكون موجباً");
  if (order.status === "CANCELLED" || order.status === "DELIVERED") {
    throw new AppError("INVALID_STATE", "Order is closed", "الطلب مغلق");
  }
  const paidAfter = round(Number(order.paidAmount) + amount, 6);
  if (paidAfter > Number(order.totalAmount) + 0.000001) {
    throw new AppError("VALIDATION", "Payment exceeds order total", "المبلغ أكبر من إجمالي الطلب");
  }
  const payment = await tx.customerOrderPayment.create({
    data: {
      tenantId: input.tenantId,
      orderId: order.id,
      amount,
      kind: input.kind,
      method: input.method,
      reference: input.reference ?? null,
      paidAt: input.paidAt ?? new Date(),
      recordedBy: input.recordedBy,
    },
  });
  await tx.customerOrder.update({
    where: { id: order.id },
    data: {
      paidAmount: paidAfter,
      ...(input.kind === "DEPOSIT" ? { depositAmount: round(Number(order.depositAmount) + amount, 6) } : {}),
    },
  });
  const journal = await postJournal(tx, {
    tenantId: input.tenantId,
    branchId: order.branchId,
    date: input.paidAt ?? new Date(),
    description: `${input.kind === "DEPOSIT" ? "Order deposit" : "Order balance"} ${order.number}`,
    referenceType: "CUSTOMER_ORDER_PAYMENT",
    referenceId: payment.id,
    createdById: input.recordedBy,
    lines: [
      { code: input.method === "BANK_TRANSFER" || input.method === "CARD" ? ACCOUNT_CODES.BANK : ACCOUNT_CODES.CASH, debit: amount, credit: 0 },
      { code: input.kind === "DEPOSIT" ? ACCOUNT_CODES.CUSTOMER_ADVANCES : ACCOUNT_CODES.RECEIVABLES, debit: 0, credit: amount },
    ],
  });
  await tx.customerOrderPayment.update({ where: { id: payment.id }, data: { journalId: journal.id } });
  if (input.kind === "BALANCE") {
    const receivable = await tx.customerReceivable.findFirst({
      where: { tenantId: input.tenantId, sourceType: "ORDER", sourceId: order.id, status: { in: ["OPEN", "PARTIAL"] } },
      orderBy: { createdAt: "asc" },
    });
    if (receivable) {
      const settled = round(Number(receivable.settled) + amount, 6);
      await tx.customerReceivable.update({
        where: { id: receivable.id },
        data: { settled, status: settled >= Number(receivable.amount) - 0.000001 ? "PAID" : "PARTIAL" },
      });
    }
  }
  return payment;
}
