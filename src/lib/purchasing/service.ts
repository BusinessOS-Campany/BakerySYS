import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { round } from "@/lib/calculations";
import { nextNumber } from "@/lib/sequence";
import { postJournal, ACCOUNT_CODES } from "@/lib/accounting/ledger";
import { receiveIngredient } from "@/lib/inventory/stock";
import { toBaseQuantity } from "@/lib/recipes/costing";
import { notify } from "@/lib/notifications/notify";

export async function createPurchaseOrder(tx: Db, input: {
  tenantId: string;
  supplierId: string;
  warehouseId: string;
  branchId?: string | null;
  expectedDate?: Date | null;
  notes?: string;
  createdById: string;
  items: { ingredientId: string; quantity: number; unitId: string; unitPrice: number }[];
}) {
  const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId: input.tenantId } });
  if (!supplier) throw new AppError("NOT_FOUND", "Supplier not found", "المورد غير موجود");
  if (!input.items.length) throw new AppError("VALIDATION", "Order has no items", "الطلب لا يحتوي على بنود");
  const ingredientIds = [...new Set(input.items.map((i) => i.ingredientId))];
  const ingredients = await tx.ingredient.findMany({ where: { id: { in: ingredientIds }, tenantId: input.tenantId } });
  if (ingredients.length !== ingredientIds.length) throw new AppError("NOT_FOUND", "Ingredient not found", "أحد المكونات غير موجود");
  const total = round(input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0), 6);
  const number = await nextNumber(tx, input.tenantId, "PO", "PO-");
  const order = await tx.purchaseOrder.create({
    data: {
      tenantId: input.tenantId, supplierId: input.supplierId, warehouseId: input.warehouseId,
      branchId: input.branchId ?? null, number, total,
      expectedDate: input.expectedDate ?? null, notes: input.notes ?? null,
      createdById: input.createdById,
    },
  });
  await tx.purchaseOrderItem.createMany({
    data: input.items.map((i) => ({
      tenantId: input.tenantId, orderId: order.id, ingredientId: i.ingredientId,
      quantity: round(i.quantity, 6), unitId: i.unitId, unitPrice: round(i.unitPrice, 6),
    })),
  });
  return order;
}

export async function approvePurchaseOrder(tx: Db, input: {
  tenantId: string;
  orderId: string;
  approvedById: string;
}) {
  const order = await tx.purchaseOrder.findFirst({ where: { id: input.orderId, tenantId: input.tenantId } });
  if (!order) throw new AppError("NOT_FOUND", "Order not found", "أمر الشراء غير موجود");
  if (order.status !== "DRAFT") throw new AppError("INVALID_STATE", "Only draft orders can be approved", "يمكن اعتماد الطلبات المسودة فقط");
  return tx.purchaseOrder.update({
    where: { id: order.id }, data: { status: "APPROVED", approvedById: input.approvedById },
  });
}

/** Receives goods (supports partial delivery), creates lots, movements and payables atomically. */
export async function receiveGoods(tx: Db, input: {
  tenantId: string;
  receiptId?: string;
  orderId?: string | null;
  supplierId: string;
  warehouseId: string;
  receivedAt?: Date;
  inspectionNote?: string;
  receivedById: string;
  items: {
    orderItemId?: string | null;
    ingredientId: string;
    quantity: number;
    unitId: string;
    unitCost: number;
    acceptedQuantity?: number;
    rejectedQuantity?: number;
    lotNumber?: string;
    expiryDate?: Date | null;
  }[];
}) {
  if (!input.items.length) throw new AppError("VALIDATION", "Receipt has no items", "الإيصال لا يحتوي على بنود");
  let order = null as Awaited<ReturnType<typeof tx.purchaseOrder.findFirst>>;
  if (input.orderId) {
    order = await tx.purchaseOrder.findFirst({ where: { id: input.orderId, tenantId: input.tenantId } });
    if (!order) throw new AppError("NOT_FOUND", "Purchase order not found", "أمر الشراء غير موجود");
    if (order.status === "CANCELLED") throw new AppError("INVALID_STATE", "Order cancelled", "تم إلغاء الطلب");
  }
  const number = await nextNumber(tx, input.tenantId, "GRN", "GRN-");
  const receipt = await tx.goodsReceipt.create({
    data: {
      tenantId: input.tenantId, orderId: order?.id ?? null, supplierId: input.supplierId,
      warehouseId: input.warehouseId, number, receivedAt: input.receivedAt ?? new Date(),
      status: "INSPECTED", inspectionNote: input.inspectionNote ?? null,
      inspectedBy: input.receivedById, createdById: input.receivedById,
    },
  });
  let total = 0;
  for (const item of input.items) {
    const ingredient = await tx.ingredient.findFirst({
      where: { id: item.ingredientId, tenantId: input.tenantId },
    });
    if (!ingredient) throw new AppError("NOT_FOUND", "Ingredient not found", "أحد المكونات غير موجود");
    const accepted = round(item.acceptedQuantity ?? item.quantity, 6);
    const rejected = round(item.rejectedQuantity ?? 0, 6);
    if (accepted <= 0) continue;
    const baseQty = await toBaseQuantity(tx, input.tenantId, ingredient, item.unitId, accepted);
    const unitCostInBase = item.unitId === ingredient.baseUnitId
      ? item.unitCost
      : round(item.unitCost * accepted / (baseQty || 1), 6);
    await receiveIngredient(tx, {
      tenantId: input.tenantId, warehouseId: input.warehouseId,
      ingredientId: ingredient.id, quantity: baseQty, unitCost: unitCostInBase,
      lotNumber: item.lotNumber ?? null, expiryDate: item.expiryDate ?? null,
      supplierId: input.supplierId, movementType: "PURCHASE_RECEIPT",
      referenceType: "GOODS_RECEIPT", referenceId: receipt.id,
      note: `Purchase receipt ${number}`, createdById: input.receivedById,
    });
    total += baseQty * unitCostInBase;
    await tx.goodsReceiptItem.create({
      data: {
        tenantId: input.tenantId, receiptId: receipt.id, orderItemId: item.orderItemId ?? null,
        ingredientId: ingredient.id, quantity: round(item.quantity, 6),
        acceptedQuantity: accepted, rejectedQuantity: rejected,
        unitId: item.unitId, unitCost: unitCostInBase,
        lotNumber: item.lotNumber ?? null, expiryDate: item.expiryDate ?? null,
      },
    });
    if (item.orderItemId) {
      await tx.purchaseOrderItem.update({
        where: { id: item.orderItemId },
        data: { receivedQty: { increment: accepted } },
      });
    }
  }
  total = round(total, 6);
  const updatedReceipt = await tx.goodsReceipt.update({
    where: { id: receipt.id }, data: { total },
  });
  if (order) {
    const items = await tx.purchaseOrderItem.findMany({ where: { orderId: order.id } });
    const fullyReceived = items.every((i) => Number(i.receivedQty) >= Number(i.quantity));
    await tx.purchaseOrder.update({
      where: { id: order.id }, data: { status: fullyReceived ? "RECEIVED" : "PARTIAL" },
    });
  }
  const payable = await tx.supplierPayable.create({
    data: {
      tenantId: input.tenantId, supplierId: input.supplierId, sourceType: "GOODS_RECEIPT",
      sourceId: receipt.id, amount: total, status: "OPEN",
    },
  });
  await postJournal(tx, {
    tenantId: input.tenantId, branchId: order?.branchId ?? null, description: `Goods receipt ${number}`,
    referenceType: "GOODS_RECEIPT", referenceId: receipt.id, createdById: input.receivedById,
    lines: [
      { code: ACCOUNT_CODES.RAW_INVENTORY, debit: total, credit: 0 },
      { code: ACCOUNT_CODES.PAYABLES, debit: 0, credit: total },
    ],
  });
  await tx.supplier.update({
    where: { id: input.supplierId }, data: { balance: { increment: total } },
  });
  await notify(tx, {
    tenantId: input.tenantId,
    titleAr: "تم استلام بضاعة", titleEn: "Goods received",
    bodyAr: `إيصال ${number} بقيمة ${total}`, bodyEn: `Receipt ${number} worth ${total}`,
    kind: "PURCHASING", link: `/purchases/${receipt.id}`,
  });
  return { receipt: updatedReceipt, payable, total };
}

export async function paySupplier(tx: Db, input: {
  tenantId: string;
  supplierId: string;
  invoiceId?: string | null;
  amount: number;
  method?: string;
  reference?: string;
  paidAt?: Date;
  recordedBy: string;
}) {
  const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId: input.tenantId } });
  if (!supplier) throw new AppError("NOT_FOUND", "Supplier not found", "المورد غير موجود");
  const amount = round(input.amount, 6);
  if (amount <= 0) throw new AppError("VALIDATION", "Payment must be positive", "المبلغ يجب أن يكون موجباً");
  const payment = await tx.supplierPayment.create({
    data: {
      tenantId: input.tenantId, supplierId: input.supplierId, invoiceId: input.invoiceId ?? null,
      amount, method: input.method ?? "CASH", reference: input.reference ?? null,
      paidAt: input.paidAt ?? new Date(), recordedBy: input.recordedBy,
    },
  });
  await tx.supplier.update({
    where: { id: input.supplierId }, data: { balance: { decrement: amount } },
  });
  if (input.invoiceId) {
    const invoice = await tx.supplierInvoice.findFirst({
      where: { id: input.invoiceId, tenantId: input.tenantId },
    });
    if (!invoice) throw new AppError("NOT_FOUND", "Supplier invoice not found", "فاتورة المورد غير موجودة");
    const newPaid = Number(invoice.paidAmount) + amount;
    await tx.supplierInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaid,
        status: newPaid >= Number(invoice.amount) - 0.000001 ? "PAID" : "PARTIAL",
      },
    });
  }
  await postJournal(tx, {
    tenantId: input.tenantId, description: `Supplier payment ${payment.id}`,
    referenceType: "SUPPLIER_PAYMENT", referenceId: payment.id, createdById: input.recordedBy,
    lines: [
      { code: ACCOUNT_CODES.PAYABLES, debit: amount, credit: 0 },
      { code: input.method === "BANK_TRANSFER" ? ACCOUNT_CODES.BANK : ACCOUNT_CODES.CASH, debit: 0, credit: amount },
    ],
  });
  return payment;
}
