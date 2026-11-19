import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { round } from "@/lib/calculations";
import { applyAdjustment, receiveIngredient, addFinishedStock, consumeIngredient, removeFinishedStock } from "@/lib/inventory/stock";

export async function createStockCount(tx: Db, input: {
  tenantId: string;
  warehouseId: string;
  itemType: "RAW" | "FINISHED";
  countDate?: Date;
  notes?: string;
  createdById: string;
  lines: { itemId: string; counted: number }[];
}) {
  if (!input.lines.length) throw new AppError("VALIDATION", "Count has no lines", "الجرد لا يحتوي على بنود");
  const count = await tx.stockCount.create({
    data: {
      tenantId: input.tenantId,
      warehouseId: input.warehouseId,
      itemType: input.itemType,
      countDate: input.countDate ?? new Date(),
      status: "DRAFT",
      createdById: input.createdById,
      notes: input.notes ?? null,
    },
  });
  const itemIds = input.lines.map((l) => l.itemId);
  const expectedMap = new Map<string, number>();
  if (input.itemType === "RAW") {
    const stocks = await tx.ingredientStock.findMany({
      where: { tenantId: input.tenantId, warehouseId: input.warehouseId, ingredientId: { in: itemIds } },
      select: { ingredientId: true, quantity: true },
    });
    for (const stock of stocks) expectedMap.set(stock.ingredientId, Number(stock.quantity));
  } else {
    const stocks = await tx.finishedStock.findMany({
      where: { tenantId: input.tenantId, warehouseId: input.warehouseId, productId: { in: itemIds } },
      select: { productId: true, quantity: true },
    });
    for (const stock of stocks) expectedMap.set(stock.productId, Number(stock.quantity));
  }
  await tx.stockCountLine.createMany({
    data: input.lines.map((line) => {
      const expected = round(expectedMap.get(line.itemId) ?? 0, 6);
      return {
        tenantId: input.tenantId,
        countId: count.id,
        itemType: input.itemType,
        itemId: line.itemId,
        expected,
        counted: round(line.counted, 6),
        difference: round(line.counted - expected, 6),
      };
    }),
  });
  return count;
}

export async function postStockCount(tx: Db, input: {
  tenantId: string;
  countId: string;
  approvedById: string;
}) {
  const count = await tx.stockCount.findFirst({
    where: { id: input.countId, tenantId: input.tenantId },
  });
  if (!count) throw new AppError("NOT_FOUND", "Stock count not found", "الجرد غير موجود");
  if (count.status !== "DRAFT") throw new AppError("INVALID_STATE", "Count already posted", "تم اعتماد الجرد مسبقاً");
  const lines = await tx.stockCountLine.findMany({
    where: { tenantId: input.tenantId, countId: count.id },
  });
  for (const line of lines) {
    if (Math.abs(Number(line.difference)) < 0.000001) continue;
    await applyAdjustment(tx, {
      tenantId: input.tenantId,
      warehouseId: count.warehouseId,
      itemType: line.itemType === "RAW" ? "RAW" : "FINISHED",
      itemId: line.itemId,
      quantity: Number(line.difference),
      reason: `Stock count ${count.id}`,
      approvedById: input.approvedById,
    });
  }
  await tx.stockCount.update({ where: { id: count.id }, data: { status: "POSTED" } });
  return count;
}

export async function transferStock(tx: Db, input: {
  tenantId: string;
  fromWarehouse: string;
  toWarehouse: string;
  itemType: "RAW" | "FINISHED";
  itemId: string;
  quantity: number;
  createdById: string;
  notes?: string;
}) {
  if (input.fromWarehouse === input.toWarehouse) {
    throw new AppError("VALIDATION", "Source and destination must differ", "المخزنان المصدر والوجهة متطابقان");
  }
  const qty = round(input.quantity, 6);
  if (qty <= 0) throw new AppError("VALIDATION", "Quantity must be positive", "الكمية يجب أن تكون موجبة");
  const transfer = await tx.warehouseTransfer.create({
    data: {
      tenantId: input.tenantId,
      fromWarehouse: input.fromWarehouse,
      toWarehouse: input.toWarehouse,
      itemType: input.itemType,
      itemId: input.itemId,
      quantity: qty,
      status: "DRAFT",
      createdById: input.createdById,
      notes: input.notes ?? null,
    },
  });
  if (input.itemType === "RAW") {
    const removal = await consumeIngredient(tx, {
      tenantId: input.tenantId, warehouseId: input.fromWarehouse,
      ingredientId: input.itemId, quantity: qty,
      movementType: "TRANSFER_OUT", referenceType: "WAREHOUSE_TRANSFER", referenceId: transfer.id,
      createdById: input.createdById, note: input.notes,
    });
    const cost = removal.allocations.length
      ? round(removal.cost / qty, 6)
      : 0;
    await receiveIngredient(tx, {
      tenantId: input.tenantId, warehouseId: input.toWarehouse,
      ingredientId: input.itemId, quantity: qty, unitCost: cost,
      movementType: "TRANSFER_IN", referenceType: "WAREHOUSE_TRANSFER", referenceId: transfer.id,
      createdById: input.createdById, note: input.notes,
    });
  } else {
    const removal = await removeFinishedStock(tx, {
      tenantId: input.tenantId, warehouseId: input.fromWarehouse,
      productId: input.itemId, quantity: qty,
      movementType: "TRANSFER_OUT", referenceType: "WAREHOUSE_TRANSFER", referenceId: transfer.id,
      createdById: input.createdById, note: input.notes,
    });
    const cost = removal.allocations.length ? round(removal.cost / qty, 6) : 0;
    await addFinishedStock(tx, {
      tenantId: input.tenantId, warehouseId: input.toWarehouse,
      productId: input.itemId, quantity: qty, unitCost: cost,
      movementType: "TRANSFER_IN", referenceType: "WAREHOUSE_TRANSFER", referenceId: transfer.id,
      createdById: input.createdById, note: input.notes,
    });
  }
  await tx.warehouseTransfer.update({
    where: { id: transfer.id },
    data: { status: "TRANSFERRED", transferredAt: new Date() },
  });
  return transfer;
}
