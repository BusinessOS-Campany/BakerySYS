import { db, type Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { round, productionYield } from "@/lib/calculations";
import { nextNumber } from "@/lib/sequence";
import { postJournal, ACCOUNT_CODES } from "@/lib/accounting/ledger";
import { addFinishedStock, consumeIngredient } from "@/lib/inventory/stock";
import { latestSnapshot, recalculateRecipeCost, recipeRequirements, toBaseQuantity } from "@/lib/recipes/costing";
import { notify } from "@/lib/notifications/notify";

export async function createProductionPlan(tx: Db, input: {
  tenantId: string;
  branchId?: string | null;
  productId: string;
  recipeVersionId?: string | null;
  plannedQuantity: number;
  plannedDate: Date;
  deadline?: Date | null;
  priority?: string;
  notes?: string;
  createdById: string;
}) {
  const product = await tx.product.findFirst({ where: { id: input.productId, tenantId: input.tenantId } });
  if (!product) throw new AppError("NOT_FOUND", "Product not found", "ط§ظ„ظ…ظ†طھط¬ ط؛ظٹط± ظ…ظˆط¬ظˆط¯");
  const recipe = await tx.recipe.findFirst({ where: { productId: input.productId, tenantId: input.tenantId, active: true } });
  if (!recipe) throw new AppError("INVALID_STATE", "Product has no active recipe", "ظ„ط§ طھظˆط¬ط¯ ظˆطµظپط© ظ†ط´ط·ط© ظ„ظ‡ط°ط§ ط§ظ„ظ…ظ†طھط¬");
  const versionId = input.recipeVersionId
    ?? (await tx.recipeVersion.findFirst({
        where: { recipeId: recipe.id, version: recipe.currentVersion },
        select: { id: true },
      }))?.id;
  if (!versionId) throw new AppError("NOT_FOUND", "Recipe version not found", "ظ†ط³ط®ط© ط§ظ„ظˆطµظپط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©");

  const multiplier = round(Number(input.plannedQuantity) / (Number(recipe.yieldQuantity) || 1), 8);
  const requirements = await recipeRequirements(tx, input.tenantId, versionId, multiplier);
  const shortage = requirements.filter((r) => r.shortage > 0);
  const estimatedCost = requirements.reduce((sum, r) => sum + r.lineCost, 0);
  const code = await nextNumber(tx, input.tenantId, "PP", "PP-");
  const plan = await tx.productionPlan.create({
    data: {
      tenantId: input.tenantId, branchId: input.branchId ?? null, code,
      productId: input.productId, recipeVersionId: versionId,
      plannedQuantity: round(input.plannedQuantity, 6),
      priority: input.priority ?? "NORMAL", status: "PLANNED",
      plannedDate: input.plannedDate, deadline: input.deadline ?? null,
      requirements: JSON.parse(JSON.stringify(requirements)) as never,
      estimatedCost: round(estimatedCost, 6),
      shortage: JSON.parse(JSON.stringify(shortage)) as never,
      notes: input.notes ?? null, createdById: input.createdById,
    },
  });
  await tx.productionPlanItem.create({
    data: {
      tenantId: input.tenantId, planId: plan.id, productId: input.productId,
      recipeVersionId: versionId, plannedQuantity: round(input.plannedQuantity, 6),
    },
  });
  return plan;
}

export async function approveProductionPlan(tx: Db, input: {
  tenantId: string;
  planId: string;
  approvedById: string;
}) {
  const plan = await tx.productionPlan.findFirst({ where: { id: input.planId, tenantId: input.tenantId } });
  if (!plan) throw new AppError("NOT_FOUND", "Plan not found", "ط®ط·ط© ط§ظ„ط¥ظ†طھط§ط¬ ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©");
  if (plan.status !== "PLANNED") throw new AppError("INVALID_STATE", "Only planned orders can be approved", "ظٹظ…ظƒظ† ط§ط¹طھظ…ط§ط¯ ط§ظ„ط®ط·ط· ط§ظ„ظ…ط®ط·ط·ط© ظپظ‚ط·");
  return tx.productionPlan.update({
    where: { id: plan.id },
    data: { status: "APPROVED", approvedById: input.approvedById },
  });
}

export async function createBatch(tx: Db, input: {
  tenantId: string;
  planId?: string | null;
  branchId?: string | null;
  warehouseId: string;
  sourceWarehouseId?: string | null;
  productId: string;
  plannedQuantity: number;
  notes?: string;
  createdById: string;
  employeeIds?: string[];
}) {
  const recipe = await tx.recipe.findFirst({
    where: { tenantId: input.tenantId, productId: input.productId, active: true },
  });
  if (!recipe) throw new AppError("INVALID_STATE", "No active recipe", "ظ„ط§ طھظˆط¬ط¯ ظˆطµظپط© ظ†ط´ط·ط©");
  const plan = input.planId
    ? await tx.productionPlan.findFirst({ where: { id: input.planId, tenantId: input.tenantId } })
    : null;
  const version = await tx.recipeVersion.findFirst({
    where: { recipeId: recipe.id, version: recipe.currentVersion },
  });
  if (!version) throw new AppError("NOT_FOUND", "Recipe version not found", "ظ†ط³ط®ط© ط§ظ„ظˆطµظپط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©");
  let snapshot = await latestSnapshot(tx, input.tenantId, recipe.id);
  if (!snapshot) {
    const recalculated = await recalculateRecipeCost(tx, input.tenantId, recipe.id);
    snapshot = await tx.recipeCostSnapshot.findUnique({ where: { id: recalculated.snapshotId } });
  }
  const batchNumber = await nextNumber(tx, input.tenantId, "BATCH", "B-");
  const [productRow, rawWarehouse] = await Promise.all([
    tx.product.findFirst({ where: { id: input.productId } }),
    input.sourceWarehouseId
      ? Promise.resolve(null)
      : tx.warehouse.findFirst({ where: { tenantId: input.tenantId, kind: "RAW", active: true } }),
  ]);
  const shelfDays = productRow?.shelfLifeDays;
  const batch = await tx.productionBatch.create({
    data: {
      tenantId: input.tenantId, planId: plan?.id ?? null,
      branchId: input.branchId ?? plan?.branchId ?? null,
      warehouseId: input.warehouseId,
      sourceWarehouseId: input.sourceWarehouseId ?? rawWarehouse?.id ?? null,
      batchNumber, productId: input.productId,
      recipeVersionId: version.id, costSnapshotId: snapshot?.id ?? null,
      plannedQuantity: round(input.plannedQuantity, 6),
      status: "APPROVED", notes: input.notes ?? null, createdById: input.createdById,
      expiryDate: shelfDays ? new Date(Date.now() + shelfDays * 86_400_000) : null,
    },
  });
  for (const employeeId of input.employeeIds ?? []) {
    await tx.productionBatchEmployee.create({
      data: { tenantId: input.tenantId, batchId: batch.id, employeeId },
    });
  }
  return batch;
}

/**
 * Completes a batch atomically: consumes real ingredients, records the
 * immutable cost basis, adds ONLY approved output to finished stock and posts
 * the corresponding journal entry.
 */
export async function completeBatch(tx: Db, input: {
  tenantId: string;
  batchId: string;
  actualQuantity: number;
  rejectedQuantity?: number;
  wasteQuantity?: number;
  completedById: string;
  actuals?: Record<string, number>; // ingredientId -> consumed base quantity
}) {
  const batch = await tx.productionBatch.findFirst({ where: { id: input.batchId, tenantId: input.tenantId } });
  if (!batch) throw new AppError("NOT_FOUND", "Batch not found", "ط¯ظپط¹ط© ط§ظ„ط¥ظ†طھط§ط¬ ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©");
  if (batch.status === "COMPLETED") throw new AppError("INVALID_STATE", "Batch already completed", "طھظ… ط¥ظ†ظ‡ط§ط، ط§ظ„ط¯ظپط¹ط© ظ…ط³ط¨ظ‚ط§ظ‹");
  if (["CANCELLED", "REJECTED"].includes(batch.status)) {
    throw new AppError("INVALID_STATE", "Batch is not active", "ط§ظ„ط¯ظپط¹ط© ط؛ظٹط± ظ†ط´ط·ط©");
  }
  const inspection = await tx.qualityInspection.findFirst({
    where: { tenantId: input.tenantId, referenceType: "BATCH", referenceId: batch.id },
    orderBy: { checkedAt: "desc" },
  });
  if (!inspection || inspection.result !== "PASS") {
    throw new AppError(
      "INVALID_STATE",
      "Quality approval is required before completion",
      "ظٹط¬ط¨ ط§ط¹طھظ…ط§ط¯ ط§ظ„ط¬ظˆط¯ط© ظ‚ط¨ظ„ ط¥ظ†ظ‡ط§ط، ط§ظ„ط¯ظپط¹ط©",
    );
  }
  if (!batch.recipeVersionId) throw new AppError("INVALID_STATE", "Batch has no recipe version", "ط§ظ„ط¯ظپط¹ط© ط؛ظٹط± ظ…ط±طھط¨ط·ط© ط¨ظˆطµظپط©");
  const recipeVersion = await tx.recipeVersion.findFirst({
    where: { id: batch.recipeVersionId, tenantId: input.tenantId },
  });
  const snapshot = recipeVersion
    ? await tx.recipeCostSnapshot.findFirst({
        where: { tenantId: input.tenantId, recipeId: recipeVersion.recipeId },
        orderBy: { calculatedAt: "desc" },
      })
    : null;

  const lines = await tx.recipeIngredient.findMany({
    where: { tenantId: input.tenantId, versionId: batch.recipeVersionId, isAlternative: false },
  });
  const ingredientIds = [...new Set(lines.map((l) => l.ingredientId))];
  const ingredients = await tx.ingredient.findMany({ where: { id: { in: ingredientIds }, tenantId: input.tenantId } });
  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

  const scale = round(Number(input.actualQuantity) / Number(batch.plannedQuantity || 1), 8);
  let totalConsumedCost = 0;
  for (const line of lines) {
    const ingredient = ingredientMap.get(line.ingredientId);
    if (!ingredient) throw new AppError("NOT_FOUND", "Ingredient missing", "ط£ط­ط¯ ط§ظ„ظ…ظƒظˆظ†ط§طھ ط؛ظٹط± ظ…ظˆط¬ظˆط¯");
    const scaled = round(Number(line.quantity) * scale, 6);
    const baseQty = await toBaseQuantity(tx, input.tenantId, ingredient, line.unitId, scaled);
    const finalQty = round(input.actuals?.[ingredient.id] ?? baseQty, 6);
    const consumption = await consumeIngredient(tx, {
      tenantId: input.tenantId,
      warehouseId: batch.sourceWarehouseId ?? batch.warehouseId,
      ingredientId: ingredient.id, quantity: finalQty,
      movementType: "PRODUCTION_CONSUMPTION", referenceType: "PRODUCTION_BATCH",
      referenceId: batch.id, createdById: input.completedById,
    });
    totalConsumedCost += consumption.cost;
    await tx.productionBatchIngredient.create({
      data: {
        tenantId: input.tenantId, batchId: batch.id, ingredientId: ingredient.id,
        plannedQty: baseQty, actualQty: finalQty, unitId: line.unitId,
        unitCost: Number(ingredient.currentCost),
      },
    });
  }

  const rejected = round(input.rejectedQuantity ?? 0, 6);
  const waste = round(input.wasteQuantity ?? 0, 6);
  const goodQty = round(Number(input.actualQuantity) - rejected - waste, 6);
  if (goodQty <= 0) throw new AppError("VALIDATION", "No approved output to stock", "ظ„ط§ ظٹظˆط¬ط¯ ظ†ط§طھط¬ ظ…ط¹طھظ…ط¯ ظ„ط¥ط¶ط§ظپطھظ‡ ظ„ظ„ظ…ط®ط²ظˆظ†");
  const yieldInfo = productionYield({
    planned: Number(batch.plannedQuantity), actual: Number(input.actualQuantity), rejected, waste,
  });
  const producedQty = round(Number(input.actualQuantity), 6) || goodQty;
  const finishedCost = round((totalConsumedCost * goodQty) / producedQty, 6);
  const unitCost = round(finishedCost / goodQty, 6);
  const lossCost = round(totalConsumedCost - finishedCost, 6);
  const output = await addFinishedStock(tx, {
    tenantId: input.tenantId, warehouseId: batch.warehouseId,
    productId: batch.productId, quantity: goodQty, unitCost,
    batchId: batch.id, lotNumber: batch.batchNumber, expiryDate: batch.expiryDate,
    qualityApproved: true, movementType: "PRODUCTION_OUTPUT",
    referenceType: "PRODUCTION_BATCH", referenceId: batch.id,
    createdById: input.completedById,
  });

  if (waste > 0) {
    await tx.productionWaste.create({
      data: {
        tenantId: input.tenantId, batchId: batch.id, productId: batch.productId,
        quantity: waste, reason: "PRODUCTION_WASTE", cost: round(waste * unitCost, 6),
        recordedBy: input.completedById,
      },
    });
  }
  if (rejected > 0) {
    await tx.productionWaste.create({
      data: {
        tenantId: input.tenantId, batchId: batch.id, productId: batch.productId,
        quantity: rejected, reason: "QUALITY_REJECTION", cost: round(rejected * unitCost, 6),
        recordedBy: input.completedById,
      },
    });
  }
  await postJournal(tx, {
    tenantId: input.tenantId, branchId: batch.branchId, date: new Date(),
    description: `Production completion ${batch.batchNumber}`,
    referenceType: "PRODUCTION_BATCH", referenceId: batch.id,
    createdById: input.completedById,
    lines: [
      { code: ACCOUNT_CODES.FINISHED_INVENTORY, debit: finishedCost, credit: 0 },
      ...(lossCost > 0 ? [{ code: ACCOUNT_CODES.OPERATING_EXPENSE, debit: lossCost, credit: 0 }] : []),
      { code: ACCOUNT_CODES.RAW_INVENTORY, debit: 0, credit: round(totalConsumedCost, 6) },
    ],
  });

  const updated = await tx.productionBatch.update({
    where: { id: batch.id },
    data: {
      status: "COMPLETED", stage: "COMPLETED",
      actualQuantity: round(input.actualQuantity, 6),
      rejectedQuantity: rejected, wasteQuantity: waste,
      completedAt: new Date(), costSnapshotId: snapshot?.id ?? batch.costSnapshotId,
      approvedById: input.completedById,
      notes: `${batch.notes ?? ""} | Yield ${yieldInfo.yieldPercent}%`.trim(),
    },
  });
  if (batch.planId) {
    await tx.productionPlan.update({ where: { id: batch.planId }, data: { status: "COMPLETED" } }).catch(() => undefined);
  }
  await notify(tx, {
    tenantId: input.tenantId,
    titleAr: "ط§ظƒطھظ…ظ„طھ ط¯ظپط¹ط© ط§ظ„ط¥ظ†طھط§ط¬",
    titleEn: "Production batch completed",
    bodyEn: `${batch.batchNumber}: ${goodQty} units`,
    bodyAr: `${batch.batchNumber}: ${goodQty} ظˆط­ط¯ط©`,
    kind: "PRODUCTION", link: `/production/${batch.id}`,
  });
  return { batch: updated, goodQuantity: goodQty, unitCost, cost: totalConsumedCost, lotId: output.lotId };
}

export async function getBatchDetails(tx: Db, tenantId: string, batchId: string) {
  const batch = await tx.productionBatch.findFirst({ where: { id: batchId, tenantId } });
  if (!batch) throw new AppError("NOT_FOUND", "Batch not found", "ط¯ظپط¹ط© ط§ظ„ط¥ظ†طھط§ط¬ ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©");
  const [lines, employees, inspections, stages] = await Promise.all([
    tx.productionBatchIngredient.findMany({ where: { batchId } }),
    tx.productionBatchEmployee.findMany({ where: { batchId } }),
    tx.qualityInspection.findMany({ where: { referenceType: "BATCH", referenceId: batchId } }),
    tx.productionStageLog.findMany({ where: { batchId } }),
  ]);
  return { batch, lines, employees, inspections, stages };
}

export async function completeBatchById(batchId: string, input: Parameters<typeof completeBatch>[1]) {
  return db.$transaction((tx) => completeBatch(tx, { ...input, batchId }));
}
