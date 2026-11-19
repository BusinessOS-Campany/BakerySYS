import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { round, selectFefoLots, type FefoLot } from "@/lib/calculations";

type StockOwner = { tenantId: string; warehouseId: string; createdById?: string | null };

async function rawBalance(
  tx: Db, owner: StockOwner, ingredientId: string, delta: number,
) {
  const existing = await tx.ingredientStock.findUnique({
    where: {
      tenantId_warehouseId_ingredientId: {
        tenantId: owner.tenantId, warehouseId: owner.warehouseId, ingredientId,
      },
    },
  });
  if (!existing) {
    if (delta < 0) {
      throw new AppError("INSUFFICIENT_STOCK", "No stock record for ingredient", "ظ„ط§ ظٹظˆط¬ط¯ ط±طµظٹط¯ ظ„ظ‡ط°ط§ ط§ظ„ظ…ظƒظˆظ†");
    }
    await tx.ingredientStock.create({
      data: { tenantId: owner.tenantId, warehouseId: owner.warehouseId, ingredientId, quantity: round(delta, 6) },
    });
    return round(delta, 6);
  }
  const next = round(Number(existing.quantity) + delta, 6);
  if (next < 0) {
    throw new AppError("INSUFFICIENT_STOCK", `Insufficient ingredient stock (${ingredientId})`, "ط§ظ„ط±طµظٹط¯ ط؛ظٹط± ظƒط§ظپظچ ظ…ظ† ط§ظ„ظ…ظƒظˆظ†");
  }
  await tx.ingredientStock.update({
    where: { id: existing.id },
    data: { quantity: next, version: { increment: 1 } },
  });
  return next;
}

async function finishedBalance(
  tx: Db, owner: StockOwner, productId: string, variantId: string | null, delta: number,
) {
  const existing = await tx.finishedStock.findFirst({
    where: {
      tenantId: owner.tenantId, warehouseId: owner.warehouseId,
      productId, variantId: variantId ?? null,
    },
  });
  if (!existing) {
    if (delta < 0) {
      throw new AppError("INSUFFICIENT_STOCK", "No finished stock record", "ظ„ط§ ظٹظˆط¬ط¯ ط±طµظٹط¯ ظ…ظ† ظ‡ط°ط§ ط§ظ„ظ…ظ†طھط¬");
    }
    await tx.finishedStock.create({
      data: {
        tenantId: owner.tenantId, warehouseId: owner.warehouseId,
        productId, variantId, quantity: round(delta, 6),
      },
    });
    return round(delta, 6);
  }
  const next = round(Number(existing.quantity) + delta, 6);
  if (next < 0) {
    throw new AppError("INSUFFICIENT_STOCK", `Insufficient finished stock (${productId})`, "ط§ظ„ط±طµظٹط¯ ط؛ظٹط± ظƒط§ظپظچ ظ…ظ† ط§ظ„ظ…ظ†طھط¬ ط§ظ„طھط§ظ…");
  }
  await tx.finishedStock.update({
    where: { id: existing.id },
    data: { quantity: next, version: { increment: 1 } },
  });
  return next;
}

export async function receiveIngredient(tx: Db, input: StockOwner & {
  ingredientId: string;
  quantity: number;
  unitCost: number;
  lotNumber?: string | null;
  expiryDate?: Date | null;
  supplierId?: string | null;
  movementType?: string;
  referenceType?: string;
  referenceId?: string;
  note?: string;
}) {
  const qty = round(input.quantity, 6);
  if (qty <= 0) throw new AppError("VALIDATION", "Receipt quantity must be positive", "ظƒظ…ظٹط© ط§ظ„ط§ط³طھظ„ط§ظ… ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ظ…ظˆط¬ط¨ط©");
  const lotNumber = input.lotNumber || `LOT-${Date.now().toString(36).toUpperCase()}`;
  const lot = await tx.ingredientLot.upsert({
    where: {
      tenantId_warehouseId_ingredientId_lotNumber: {
        tenantId: input.tenantId, warehouseId: input.warehouseId,
        ingredientId: input.ingredientId, lotNumber,
      },
    },
    create: {
      tenantId: input.tenantId, warehouseId: input.warehouseId,
      ingredientId: input.ingredientId, supplierId: input.supplierId ?? null,
      lotNumber, quantity: qty, initialQty: qty, unitCost: round(input.unitCost, 6),
      expiryDate: input.expiryDate ?? null,
    },
    update: {
      quantity: { increment: qty },
      initialQty: { increment: qty },
      unitCost: round(input.unitCost, 6),
      expiryDate: input.expiryDate ?? undefined,
    },
  });
  const balance = await rawBalance(tx, input, input.ingredientId, qty);
  await tx.ingredientMovement.create({
    data: {
      tenantId: input.tenantId, warehouseId: input.warehouseId,
      ingredientId: input.ingredientId, lotId: lot.id, direction: "IN", quantity: qty,
      unitCost: round(input.unitCost, 6),
      movementType: input.movementType ?? "PURCHASE_RECEIPT",
      referenceType: input.referenceType ?? null, referenceId: input.referenceId ?? null,
      note: input.note ?? null, createdById: input.createdById ?? null,
    },
  });
  await tx.priceHistory.create({
    data: {
      tenantId: input.tenantId, ingredientId: input.ingredientId,
      supplierId: input.supplierId ?? null, price: round(input.unitCost, 6),
      source: input.referenceType ?? "PURCHASE_RECEIPT",
    },
  });
  await tx.ingredient.update({
    where: { id: input.ingredientId },
    data: { currentCost: round(input.unitCost, 6) },
  }).catch(() => undefined);
  return { balance, lotId: lot.id };
}

export async function consumeIngredient(tx: Db, input: StockOwner & {
  ingredientId: string;
  quantity: number;
  movementType?: string;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  lotId?: string | null;
}) {
  const qty = round(input.quantity, 6);
  if (qty <= 0) return { cost: 0, allocations: [] as { lotId: string; quantity: number; unitCost: number }[] };

  let lots: FefoLot[];
  if (input.lotId) {
    const lot = await tx.ingredientLot.findFirst({
      where: { id: input.lotId, tenantId: input.tenantId, warehouseId: input.warehouseId },
    });
    if (!lot) throw new AppError("NOT_FOUND", "Lot not found", "ط§ظ„ط¯ظپط¹ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©");
    lots = [{ id: lot.id, quantity: Number(lot.quantity), unitCost: Number(lot.unitCost), expiryDate: lot.expiryDate, receivedAt: lot.receivedAt }];
  } else {
    const rows = await tx.ingredientLot.findMany({
      where: {
        tenantId: input.tenantId, warehouseId: input.warehouseId,
        ingredientId: input.ingredientId, quantity: { gt: 0 },
      },
      orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
    });
    lots = rows.map((l) => ({
      id: l.id, quantity: Number(l.quantity), unitCost: Number(l.unitCost),
      expiryDate: l.expiryDate, receivedAt: l.receivedAt,
    }));
  }

  let allocations: { lotId: string; quantity: number; unitCost: number }[];
  try {
    allocations = selectFefoLots(lots, qty);
  } catch {
    throw new AppError("INSUFFICIENT_STOCK", `Insufficient stock for ingredient ${input.ingredientId}`, "ط§ظ„ط±طµظٹط¯ ط؛ظٹط± ظƒط§ظپظچ ظ…ظ† ط§ظ„ظ…ظƒظˆظ†");
  }
  for (const a of allocations) {
    await tx.ingredientLot.update({
      where: { id: a.lotId },
      data: { quantity: { decrement: a.quantity } },
    });
    await tx.ingredientMovement.create({
      data: {
        tenantId: input.tenantId, warehouseId: input.warehouseId,
        ingredientId: input.ingredientId, lotId: a.lotId, direction: "OUT", quantity: a.quantity,
        unitCost: a.unitCost,
        movementType: input.movementType ?? "PRODUCTION_CONSUMPTION",
        referenceType: input.referenceType ?? null, referenceId: input.referenceId ?? null,
        note: input.note ?? null, createdById: input.createdById ?? null,
      },
    });
  }
  const balance = await rawBalance(tx, input, input.ingredientId, -qty);
  return { balance, allocations, cost: round(allocations.reduce((s, a) => s + a.quantity * a.unitCost, 0), 6) };
}

export async function addFinishedStock(tx: Db, input: StockOwner & {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitCost: number;
  batchId?: string | null;
  lotNumber?: string;
  expiryDate?: Date | null;
  qualityApproved?: boolean;
  movementType?: string;
  referenceType?: string;
  referenceId?: string;
  note?: string;
}) {
  const qty = round(input.quantity, 6);
  if (qty <= 0) return { balance: 0, lotId: null as string | null };
  if (input.qualityApproved === false) {
    throw new AppError("INVALID_STATE", "Only quality-approved goods can become sellable", "ظ„ط§ ظٹظ…ظƒظ† ط¥ط¶ط§ظپط© ظ…ظ†طھط¬ط§طھ ط؛ظٹط± ظ…ط¹طھظ…ط¯ط© ظ„ظ„ظ…ط®ط²ظˆظ† ط§ظ„ظ‚ط§ط¨ظ„ ظ„ظ„ط¨ظٹط¹");
  }
  const lotNumber = input.lotNumber || `FG-${Date.now().toString(36).toUpperCase()}`;
  const lot = await tx.finishedLot.upsert({
    where: {
      tenantId_warehouseId_productId_lotNumber: {
        tenantId: input.tenantId, warehouseId: input.warehouseId,
        productId: input.productId, lotNumber,
      },
    },
    create: {
      tenantId: input.tenantId, warehouseId: input.warehouseId,
      productId: input.productId, variantId: input.variantId ?? null,
      batchId: input.batchId ?? null, lotNumber, quantity: qty, initialQty: qty,
      unitCost: round(input.unitCost, 6), expiryDate: input.expiryDate ?? null,
      qualityApproved: true,
    },
    update: {
      quantity: { increment: qty }, initialQty: { increment: qty },
      unitCost: round(input.unitCost, 6), expiryDate: input.expiryDate ?? undefined,
    },
  });
  const balance = await finishedBalance(tx, input, input.productId, input.variantId ?? null, qty);
  await tx.finishedMovement.create({
    data: {
      tenantId: input.tenantId, warehouseId: input.warehouseId,
      productId: input.productId, variantId: input.variantId ?? null, lotId: lot.id,
      direction: "IN", quantity: qty, unitCost: round(input.unitCost, 6),
      movementType: input.movementType ?? "PRODUCTION_OUTPUT",
      referenceType: input.referenceType ?? null, referenceId: input.referenceId ?? null,
      note: input.note ?? null, createdById: input.createdById ?? null,
    },
  });
  return { balance, lotId: lot.id };
}

export async function removeFinishedStock(tx: Db, input: StockOwner & {
  productId: string;
  variantId?: string | null;
  quantity: number;
  movementType?: string;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  lotId?: string | null;
}) {
  const qty = round(input.quantity, 6);
  if (qty <= 0) return { cost: 0, allocations: [] as { lotId: string; quantity: number; unitCost: number }[] };
  const rows = await tx.finishedLot.findMany({
    where: {
      tenantId: input.tenantId, warehouseId: input.warehouseId,
      productId: input.productId, ...(input.lotId ? { id: input.lotId } : {}),
      quantity: { gt: 0 }, qualityApproved: true,
    },
    orderBy: [{ expiryDate: "asc" }, { producedAt: "asc" }],
  });
  const lots: FefoLot[] = rows.map((l) => ({
    id: l.id, quantity: Number(l.quantity), unitCost: Number(l.unitCost),
    expiryDate: l.expiryDate, receivedAt: l.producedAt,
  }));
  let allocations;
  try {
    allocations = selectFefoLots(lots, qty);
  } catch {
    throw new AppError("INSUFFICIENT_STOCK", `Insufficient stock for product ${input.productId}`, "ط§ظ„ط±طµظٹط¯ ط؛ظٹط± ظƒط§ظپظچ ظ…ظ† ط§ظ„ظ…ظ†طھط¬");
  }
  for (const a of allocations) {
    await tx.finishedLot.update({ where: { id: a.lotId }, data: { quantity: { decrement: a.quantity } } });
    await tx.finishedMovement.create({
      data: {
        tenantId: input.tenantId, warehouseId: input.warehouseId,
        productId: input.productId, variantId: input.variantId ?? null, lotId: a.lotId,
        direction: "OUT", quantity: a.quantity, unitCost: a.unitCost,
        movementType: input.movementType ?? "SALE",
        referenceType: input.referenceType ?? null, referenceId: input.referenceId ?? null,
        note: input.note ?? null, createdById: input.createdById ?? null,
      },
    });
  }
  const balance = await finishedBalance(tx, input, input.productId, input.variantId ?? null, -qty);
  return { balance, allocations, cost: round(allocations.reduce((s, a) => s + a.quantity * a.unitCost, 0), 6) };
}

/** Signed manual adjustment with mandatory reason and authorizer. */
export async function applyAdjustment(tx: Db, input: StockOwner & {
  itemType: "RAW" | "FINISHED";
  itemId: string;
  quantity: number;
  reason: string;
  approvedById: string;
  variantId?: string | null;
}) {
  if (!input.reason?.trim()) throw new AppError("VALIDATION", "Adjustment reason is required", "ط³ط¨ط¨ ط§ظ„طھط¹ط¯ظٹظ„ ظ…ط·ظ„ظˆط¨");
  const adjustment = await tx.stockAdjustment.create({
    data: {
      tenantId: input.tenantId, warehouseId: input.warehouseId, itemType: input.itemType,
      itemId: input.itemId, quantity: round(input.quantity, 6), reason: input.reason,
      approvedById: input.approvedById,
    },
  });
  if (input.itemType === "RAW") {
    await rawBalance(tx, input, input.itemId, round(input.quantity, 6));
    await tx.ingredientMovement.create({
      data: {
        tenantId: input.tenantId, warehouseId: input.warehouseId, ingredientId: input.itemId,
        direction: input.quantity >= 0 ? "IN" : "OUT", quantity: Math.abs(round(input.quantity, 6)),
        unitCost: 0, movementType: "MANUAL_ADJUSTMENT", referenceType: "STOCK_ADJUSTMENT",
        referenceId: adjustment.id, createdById: input.approvedById, note: input.reason,
      },
    });
  } else {
    await finishedBalance(tx, input, input.itemId, input.variantId ?? null, round(input.quantity, 6));
    await tx.finishedMovement.create({
      data: {
        tenantId: input.tenantId, warehouseId: input.warehouseId, productId: input.itemId,
        variantId: input.variantId ?? null,
        direction: input.quantity >= 0 ? "IN" : "OUT", quantity: Math.abs(round(input.quantity, 6)),
        unitCost: 0, movementType: "MANUAL_ADJUSTMENT", referenceType: "STOCK_ADJUSTMENT",
        referenceId: adjustment.id, createdById: input.approvedById, note: input.reason,
      },
    });
  }
  return adjustment;
}
