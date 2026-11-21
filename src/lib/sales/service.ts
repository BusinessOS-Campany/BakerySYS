import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { calcLineTotals, round } from "@/lib/calculations";
import { nextNumber } from "@/lib/sequence";
import { postJournal, reverseJournal, ACCOUNT_CODES } from "@/lib/accounting/ledger";
import { buildSaleJournalLines } from "@/lib/sales/journal";
import { addFinishedStock, removeFinishedStock } from "@/lib/inventory/stock";
import { assertBranchAccess, type AuthContext } from "@/lib/auth/session";
import { notify } from "@/lib/notifications/notify";

export type SaleLineInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  discount?: number;
  note?: string;
};

export type SalePaymentInput = { method: string; amount: number; reference?: string };

export async function createSale(tx: Db, auth: AuthContext, input: {
  branchId: string;
  warehouseId: string;
  customerId?: string | null;
  lines: SaleLineInput[];
  payments: SalePaymentInput[];
  discountAmount?: number;
  idempotencyKey?: string | null;
  cashSessionId?: string | null;
  notes?: string;
}) {
  assertBranchAccess(auth, input.branchId);
  if (!input.lines?.length) throw new AppError("VALIDATION", "Cart is empty", "السلة فارغة");
  if (input.idempotencyKey) {
    const existing = await tx.sale.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: auth.user.tenantId, idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return { sale: existing, duplicate: true };
  }

  const productIds = [...new Set(input.lines.map((l) => l.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds }, tenantId: auth.user.tenantId, active: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantIds = input.lines.map((l) => l.variantId).filter((v): v is string => Boolean(v));
  const variants = variantIds.length
    ? await tx.productVariant.findMany({ where: { id: { in: variantIds }, tenantId: auth.user.tenantId } })
    : [];
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  let subtotal = 0;
  let taxTotal = 0;
  let cogs = 0;
  let discountTotal = round(input.discountAmount ?? 0, 6);
  const prepared: {
    line: SaleLineInput;
    name: string;
    unitPrice: number;
    net: number;
    tax: number;
    total: number;
    unitCost: number;
  }[] = [];

  for (const line of input.lines) {
    const product = productMap.get(line.productId);
    if (!product) throw new AppError("NOT_FOUND", "Product not available", "المنتج غير متاح");
    const variant = line.variantId ? variantMap.get(line.variantId) : undefined;
    const unitPrice = round(Number(product.sellingPrice) + Number(variant?.priceAdjustment ?? 0), 6);
    const lineDiscount = round((line.discount ?? 0) + (discountTotal > 0 ? Math.min(discountTotal, unitPrice * line.quantity) : 0), 6);
    discountTotal = round(Math.max(0, discountTotal - lineDiscount), 6);
    const totals = calcLineTotals({
      quantity: line.quantity,
      unitPrice,
      discount: lineDiscount,
      taxRate: Number(product.taxRate) || auth.tenant.taxRate,
      taxEnabled: auth.tenant.taxEnabled,
    });
    const removal = await removeFinishedStock(tx, {
      tenantId: auth.user.tenantId, warehouseId: input.warehouseId,
      productId: product.id, variantId: line.variantId ?? null,
      quantity: line.quantity, movementType: "SALE",
      referenceType: "SALE", referenceId: "pending", createdById: auth.user.id,
      note: line.note ?? undefined,
      allowNegative: true, fallbackUnitCost: Number(product.costPrice),
    });
    const unitCost = removal.allocations.length
      ? round(removal.cost / round(line.quantity, 6), 6)
      : round(Number(product.costPrice), 6);
    cogs = round(cogs + removal.cost, 6);
    subtotal = round(subtotal + unitPrice * line.quantity, 6);
    taxTotal = round(taxTotal + totals.tax, 6);
    prepared.push({
      line, name: auth.locale === "ar" ? product.nameAr : product.nameEn,
      unitPrice, net: totals.net, tax: totals.tax, total: totals.total, unitCost,
    });
  }

  const total = round(prepared.reduce((s, p) => s + p.total, 0), 6);
  const paid = round(input.payments.reduce((s, p) => s + p.amount, 0), 6);
  if (paid < total - 0.000001) {
    throw new AppError("VALIDATION", "Payments do not cover the invoice total", "المبالغ المدفوعة لا تغطي إجمالي الفاتورة");
  }
  const invoiceNumber = await nextNumber(tx, auth.user.tenantId, auth.tenant.invoicePrefix, auth.tenant.invoicePrefix + "-");
  const sale = await tx.sale.create({
    data: {
      tenantId: auth.user.tenantId, branchId: input.branchId, warehouseId: input.warehouseId,
      customerId: input.customerId ?? null, invoiceNumber, status: "COMPLETED",
      subtotal, discountAmount: round(input.discountAmount ?? 0, 6), taxAmount: taxTotal,
      total, paidAmount: paid, costAmount: cogs, profit: round(total - taxTotal - cogs, 6),
      cashSessionId: input.cashSessionId ?? null, cashierId: auth.user.id,
      idempotencyKey: input.idempotencyKey ?? null, notes: input.notes ?? null,
    },
  });

  for (const p of prepared) {
    await tx.saleItem.create({
      data: {
        tenantId: auth.user.tenantId, saleId: sale.id, productId: p.line.productId,
        variantId: p.line.variantId ?? null, nameSnapshot: p.name,
        quantity: round(p.line.quantity, 6), unitPrice: p.unitPrice,
        discount: round(p.line.discount ?? 0, 6), tax: p.tax,
        lineTotal: p.total, unitCost: p.unitCost,
      },
    });
  }
  await tx.finishedMovement.updateMany({
    where: {
      tenantId: auth.user.tenantId, referenceType: "SALE", referenceId: "pending",
      createdById: auth.user.id, createdAt: { gte: new Date(Date.now() - 60_000) },
    },
    data: { referenceId: sale.id },
  });

  let cashAmount = 0;
  let bankAmount = 0;
  let creditAmount = 0;
  for (const payment of input.payments) {
    await tx.salePayment.create({
      data: {
        tenantId: auth.user.tenantId, saleId: sale.id,
        method: payment.method, amount: round(payment.amount, 6),
        reference: payment.reference ?? null,
      },
    });
    if (payment.method === "CASH") cashAmount += payment.amount;
    else if (payment.method === "CREDIT") creditAmount += payment.amount;
    else bankAmount += payment.amount;
  }

  const journalLines = buildSaleJournalLines({
    cashAmount, bankAmount, creditAmount, total, taxTotal, cogs, invoiceNumber,
  });
  const journal = await postJournal(tx, {
    tenantId: auth.user.tenantId, branchId: input.branchId, date: new Date(sale.invoiceDate),
    description: `Sale ${invoiceNumber}`, referenceType: "SALE", referenceId: sale.id,
    createdById: auth.user.id, lines: journalLines,
  });
  const postedSale = await tx.sale.update({
    where: { id: sale.id }, data: { journalId: journal.id },
  });

  if (creditAmount > 0 && input.customerId) {
    await tx.customerReceivable.create({
      data: {
        tenantId: auth.user.tenantId, customerId: input.customerId, sourceType: "SALE", sourceId: sale.id,
        amount: round(creditAmount, 6), status: "OPEN",
      },
    });
    await tx.customerTransaction.create({
      data: {
        tenantId: auth.user.tenantId, customerId: input.customerId,
        kind: "DEBT", amount: round(creditAmount, 4),
        notes: `فاتورة ${invoiceNumber}`,
        sourceType: "SALE", sourceId: sale.id,
        entryDate: new Date(sale.invoiceDate),
      },
    });
    await tx.customer.update({
      where: { id: input.customerId },
      data: { balance: { increment: round(creditAmount, 6) }, loyaltyPoints: { increment: Math.floor(total) } },
    });
  }
  const overpayment = round(Math.max(0, paid - total), 6);
  if (overpayment > 0 && input.customerId) {
    await tx.customer.update({
      where: { id: input.customerId },
      data: { balance: { decrement: overpayment } },
    });
  }
  if (input.cashSessionId && cashAmount > 0) {
    await tx.cashMovement.create({
      data: {
        tenantId: auth.user.tenantId, sessionId: input.cashSessionId, kind: "SALE",
        amount: round(cashAmount, 6), reference: invoiceNumber,
      },
    });
  }
  return { sale: postedSale, duplicate: false };
}

/** Refunds restore stock and post return entries; the sale journal is reversed only when fully refunded. */
export async function refundSale(tx: Db, auth: AuthContext, input: {
  saleId: string;
  reason: string;
  items: { saleItemId: string; quantity: number }[];
  method?: string;
}) {
  const sale = await tx.sale.findFirst({ where: { id: input.saleId, tenantId: auth.user.tenantId } });
  if (!sale) throw new AppError("NOT_FOUND", "Sale not found", "البيع غير موجود");
  if (sale.status === "REFUNDED") throw new AppError("INVALID_STATE", "Sale already refunded", "تم استرداد الفاتورة مسبقاً");
  if (!input.items.length) throw new AppError("VALIDATION", "No refund items", "لا توجد بنود للاسترجاع");
  const saleItems = await tx.saleItem.findMany({ where: { saleId: sale.id } });
  const requested = new Map<string, number>();
  for (const refund of input.items) {
    const original = saleItems.find((i) => i.id === refund.saleItemId);
    if (!original) throw new AppError("NOT_FOUND", "Sale item not found", "بند الفاتورة غير موجود");
    if (refund.quantity <= 0) {
      throw new AppError("VALIDATION", "Invalid refund quantity", "كمية الاسترجاع غير صحيحة");
    }
    requested.set(original.id, round((requested.get(original.id) ?? 0) + refund.quantity, 6));
  }

  const existingReturns = await tx.saleReturnItem.findMany({
    where: { tenantId: auth.user.tenantId, saleItemId: { in: saleItems.map((i) => i.id) } },
    select: { saleItemId: true, quantity: true },
  });
  const alreadyRefunded = new Map<string, number>();
  for (const item of existingReturns) {
    alreadyRefunded.set(
      item.saleItemId,
      round((alreadyRefunded.get(item.saleItemId) ?? 0) + Number(item.quantity), 6),
    );
  }

  let originalQtyTotal = 0;
  let refundedQtyTotal = 0;
  const refundLines: { item: (typeof saleItems)[number]; quantity: number; amount: number; cost: number }[] = [];
  for (const item of saleItems) {
    const originalQty = round(Number(item.quantity), 6);
    const previous = alreadyRefunded.get(item.id) ?? 0;
    const quantity = requested.get(item.id) ?? 0;
    if (previous + quantity > originalQty + 0.000001) {
      throw new AppError("VALIDATION", "Refund quantity exceeds remaining quantity", "كمية الاسترجاع تتجاوز الكمية المتبقية");
    }
    originalQtyTotal = round(originalQtyTotal + originalQty, 6);
    refundedQtyTotal = round(refundedQtyTotal + previous + quantity, 6);
    if (quantity > 0) {
      const ratio = quantity / originalQty;
      refundLines.push({
        item, quantity,
        amount: round(Number(item.lineTotal) * ratio, 6),
        cost: round(Number(item.unitCost) * quantity, 6),
      });
    }
  }
  const fullyRefunded = refundedQtyTotal >= originalQtyTotal - 0.000001;

  let refundAmount = 0;
  let returnedCost = 0;
  for (const line of refundLines) {
    refundAmount = round(refundAmount + line.amount, 6);
    returnedCost = round(returnedCost + line.cost, 6);
    await tx.saleReturnItem.create({
      data: {
        tenantId: auth.user.tenantId, returnId: "pending", saleItemId: line.item.id,
        productId: line.item.productId, quantity: line.quantity, amount: line.amount,
      },
    });
    await addFinishedStock(tx, {
      tenantId: auth.user.tenantId, warehouseId: sale.warehouseId,
      productId: line.item.productId, quantity: line.quantity,
      unitCost: Number(line.item.unitCost), movementType: "CUSTOMER_RETURN",
      referenceType: "SALE_RETURN", referenceId: "pending", createdById: auth.user.id,
    });
  }
  const number = await nextNumber(tx, auth.user.tenantId, "RET", "RET-");
  const returnDoc = await tx.saleReturn.create({
    data: {
      tenantId: auth.user.tenantId, saleId: sale.id, number, reason: input.reason,
      amount: refundAmount, refundMethod: input.method ?? "CASH", recordedBy: auth.user.id,
    },
  });
  await tx.saleReturnItem.updateMany({
    where: {
      tenantId: auth.user.tenantId, returnId: "pending",
      saleItemId: { in: refundLines.map((line) => line.item.id) },
    },
    data: { returnId: returnDoc.id },
  });
  await tx.finishedMovement.updateMany({
    where: {
      tenantId: auth.user.tenantId, referenceType: "SALE_RETURN", referenceId: "pending",
      productId: { in: refundLines.map((line) => line.item.productId) },
      createdById: auth.user.id, createdAt: { gte: new Date(Date.now() - 60_000) },
    },
    data: { referenceId: returnDoc.id },
  });
  if (fullyRefunded && sale.journalId) {
    await reverseJournal(tx, {
      tenantId: auth.user.tenantId, entryId: sale.journalId, createdById: auth.user.id,
      description: `Full refund ${number}`,
    });
  }
  const newJournal = await postJournal(tx, {
    tenantId: auth.user.tenantId, branchId: sale.branchId, description: `Sale return ${number}`,
    referenceType: "SALE_RETURN", referenceId: returnDoc.id, createdById: auth.user.id,
    lines: [
      { code: ACCOUNT_CODES.SALES_RETURNS, debit: refundAmount, credit: 0 },
      { code: input.method === "CREDIT" ? ACCOUNT_CODES.RECEIVABLES : ACCOUNT_CODES.CASH, debit: 0, credit: refundAmount },
      { code: ACCOUNT_CODES.FINISHED_INVENTORY, debit: returnedCost, credit: 0 },
      { code: ACCOUNT_CODES.COGS, debit: 0, credit: returnedCost },
    ],
  });
  const postedReturn = await tx.saleReturn.update({
    where: { id: returnDoc.id }, data: { journalId: newJournal.id },
  });
  await tx.sale.update({
    where: { id: sale.id },
    data: {
      status: fullyRefunded ? "REFUNDED" : "COMPLETED",
      refundedAmount: { increment: refundAmount },
    },
  });
  if (sale.customerId) {
    await tx.customer.update({
      where: { id: sale.customerId },
      data: { balance: { decrement: refundAmount } },
    });
    await tx.customerTransaction.create({
      data: {
        tenantId: auth.user.tenantId, customerId: sale.customerId,
        kind: "PAYMENT", amount: round(refundAmount, 4),
        notes: `مرتجع ${number}`,
        sourceType: "SALE_RETURN", sourceId: returnDoc.id,
      },
    });
  }
  return postedReturn;
}

export async function openCashSession(tx: Db, auth: AuthContext, input: {
  registerId: string;
  openingBalance: number;
}) {
  const register = await tx.cashRegister.findFirst({
    where: { id: input.registerId, tenantId: auth.user.tenantId },
  });
  if (!register) throw new AppError("NOT_FOUND", "Register not found", "الصندوق غير موجود");
  const open = await tx.cashSession.findFirst({
    where: { tenantId: auth.user.tenantId, registerId: register.id, status: "OPEN" },
  });
  if (open) throw new AppError("CONFLICT", "Register already open", "الصندوق مفتوح بالفعل");
  return tx.cashSession.create({
    data: {
      tenantId: auth.user.tenantId, registerId: register.id, cashierId: auth.user.id,
      branchId: register.branchId, openingBalance: round(input.openingBalance, 6), status: "OPEN",
    },
  });
}

export async function closeCashSession(tx: Db, auth: AuthContext, input: {
  sessionId: string;
  actualClosing: number;
  notes?: string;
}) {
  const session = await tx.cashSession.findFirst({
    where: { id: input.sessionId, tenantId: auth.user.tenantId },
  });
  if (!session || session.status !== "OPEN") throw new AppError("INVALID_STATE", "Session is not open", "الوردية غير مفتوحة");
  const movements = await tx.cashMovement.findMany({ where: { sessionId: session.id } });
  const sales = await tx.sale.findMany({
    where: {
      tenantId: auth.user.tenantId, cashSessionId: session.id,
      status: { in: ["COMPLETED", "REFUNDED"] },
    },
    select: { id: true },
  });
  const salePayments = sales.length
    ? await tx.salePayment.findMany({ where: { saleId: { in: sales.map((s) => s.id) }, method: "CASH" } })
    : [];
  const cashSales = salePayments.reduce((s, p) => s + Number(p.amount), 0);
  const cashIn = movements.filter((m) => m.kind === "IN").reduce((s, m) => s + Number(m.amount), 0);
  const cashOut = movements.filter((m) => m.kind === "OUT").reduce((s, m) => s + Number(m.amount), 0);
  const expected = round(Number(session.openingBalance) + cashSales + cashIn - cashOut, 6);
  const difference = round(input.actualClosing - expected, 6);
  if (Math.abs(difference) >= 0.000001) {
    await notify(tx, {
      tenantId: auth.user.tenantId, userId: auth.user.id,
      titleAr: "فرق في الصندوق", titleEn: "Cash discrepancy",
      bodyAr: `الفرق: ${difference}`, bodyEn: `Difference: ${difference}`,
      kind: "CASH", link: `/pos`,
    });
  }
  return tx.cashSession.update({
    where: { id: session.id },
    data: {
      status: "CLOSED", closedAt: new Date(), expectedClosing: expected,
      actualClosing: round(input.actualClosing, 6), difference, notes: input.notes ?? null,
    },
  });
}
