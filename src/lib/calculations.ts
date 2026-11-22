/**
 * Pure business calculations. No database or framework imports so the same
 * definitions are used by services, UI and unit tests.
 * All monetary values are rounded to the tenant's configured precision only
 * at presentation/persistence boundaries — intermediate math stays exact.
 */

export function round(value: number, dp = 2): number {
  const factor = 10 ** dp;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Expected cash held in a register session: opening + cash sales + cash in - cash out. */
export function computeExpectedCash(input: {
  openingBalance: unknown;
  cashSales: unknown;
  cashIn: unknown;
  cashOut: unknown;
}): number {
  return round(
    safeNumber(input.openingBalance) + safeNumber(input.cashSales)
      + safeNumber(input.cashIn) - safeNumber(input.cashOut),
    6,
  );
}

export function safeNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export type LineTotals = { net: number; tax: number; total: number };

export function calcLineTotals(input: {
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  taxEnabled?: boolean;
}): LineTotals {
  const gross = safeNumber(input.quantity) * safeNumber(input.unitPrice);
  const net = Math.max(0, gross - safeNumber(input.discount));
  const tax = input.taxEnabled ? round(net * safeNumber(input.taxRate), 6) : 0;
  return { net: round(net, 6), tax: round(tax, 6), total: round(net + tax, 6) };
}

export type ConversionEdge = { from: string; to: string; factor: number };

/** Converts along a unit-conversion graph (e.g. g → kg → bag). */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  edges: ConversionEdge[],
): number {
  if (fromUnit === toUnit) return quantity;
  const graph = new Map<string, { to: string; factor: number }[]>();
  for (const e of edges) {
    if (!graph.has(e.from)) graph.set(e.from, []);
    graph.get(e.from)!.push({ to: e.to, factor: e.factor });
    if (!graph.has(e.to)) graph.set(e.to, []);
    graph.get(e.to)!.push({ to: e.from, factor: 1 / e.factor });
  }
  const queue: { unit: string; factor: number }[] = [{ unit: fromUnit, factor: 1 }];
  const seen = new Set<string>([fromUnit]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of graph.get(current.unit) ?? []) {
      if (edge.to === toUnit) return quantity * current.factor * edge.factor;
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push({ unit: edge.to, factor: current.factor * edge.factor });
      }
    }
  }
  throw new Error(`No unit conversion from ${fromUnit} to ${toUnit}`);
}

export type FefoLot = {
  id: string;
  quantity: number;
  unitCost?: number;
  expiryDate?: Date | string | null;
  receivedAt?: Date | string | null;
};

export type FefoAllocation = { lotId: string; quantity: number; unitCost: number };

/** First-Expired-First-Out allocation. Never allocates more than available. */
export function selectFefoLots(lots: FefoLot[], required: number): FefoAllocation[] {
  if (required < 0) throw new Error("Required quantity must be non-negative");
  const sorted = [...lots]
    .filter((l) => l.quantity > 0)
    .sort((a, b) => {
      const ae = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      const be = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (ae !== be) return ae - be;
      const ar = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
      const br = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
      return ar - br;
    });
  let remaining = required;
  const allocations: FefoAllocation[] = [];
  for (const lot of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    allocations.push({ lotId: lot.id, quantity: round(take, 6), unitCost: lot.unitCost ?? 0 });
    remaining = round(remaining - take, 6);
  }
  if (remaining > 0.000001) {
    const err = new Error("Insufficient stock in FEFO lots") as Error & { code?: string };
    err.code = "INSUFFICIENT_STOCK";
    throw err;
  }
  return allocations;
}

export type RecipeCostInput = {
  ingredients: { quantity: number; unitCostPerBase: number; quantityInBase: number }[];
  laborCost: number;
  packagingCost: number;
  overheadCost: number;
  yieldQuantity: number;
  sellingPrice: number;
  flourBaseQuantity?: number;
};

export type RecipeCostResult = {
  ingredientCost: number;
  laborCost: number;
  packagingCost: number;
  overheadCost: number;
  totalCost: number;
  costPerUnit: number;
  sellingPrice: number;
  grossProfit: number;
  profitPercent: number;
  bakersPercentages: number[];
};

export function calcRecipeCost(input: RecipeCostInput): RecipeCostResult {
  const ingredientCost = input.ingredients.reduce(
    (sum, i) => sum + i.quantityInBase * i.unitCostPerBase, 0,
  );
  const laborCost = safeNumber(input.laborCost);
  const packagingCost = safeNumber(input.packagingCost);
  const overheadCost = safeNumber(input.overheadCost);
  const totalCost = ingredientCost + laborCost + packagingCost + overheadCost;
  const yieldQuantity = safeNumber(input.yieldQuantity) || 1;
  const costPerUnit = totalCost / yieldQuantity;
  const sellingPrice = safeNumber(input.sellingPrice);
  const grossProfit = sellingPrice - costPerUnit;
  const flourBase = input.flourBaseQuantity || input.ingredients[0]?.quantityInBase || 1;
  return {
    ingredientCost: round(ingredientCost, 6),
    laborCost: round(laborCost, 6),
    packagingCost: round(packagingCost, 6),
    overheadCost: round(overheadCost, 6),
    totalCost: round(totalCost, 6),
    costPerUnit: round(costPerUnit, 6),
    sellingPrice,
    grossProfit: round(grossProfit, 6),
    profitPercent: sellingPrice > 0 ? round((grossProfit / sellingPrice) * 100, 4) : 0,
    bakersPercentages: input.ingredients.map((i) => round((i.quantityInBase / flourBase) * 100, 4)),
  };
}

export type JournalLineInput = { accountId: string; debit: number; credit: number };

export function journalTotals(lines: JournalLineInput[]) {
  return {
    debit: round(lines.reduce((s, l) => s + safeNumber(l.debit), 0), 6),
    credit: round(lines.reduce((s, l) => s + safeNumber(l.credit), 0), 6),
  };
}

export function journalBalanced(lines: JournalLineInput[]): boolean {
  const { debit, credit } = journalTotals(lines);
  return Math.abs(debit - credit) < 0.000001;
}

export function productionYield(input: {
  planned: number;
  actual: number;
  rejected?: number;
  waste?: number;
}) {
  const planned = safeNumber(input.planned) || 1;
  const actual = safeNumber(input.actual);
  const rejected = safeNumber(input.rejected);
  const waste = safeNumber(input.waste);
  return {
    yieldPercent: round((actual / planned) * 100, 2),
    rejectPercent: round((rejected / planned) * 100, 2),
    wastePercent: round((waste / planned) * 100, 2),
    goodQuantity: round(actual - rejected - waste, 6),
  };
}

export function paymentBalance(total: number, payments: number[]): number {
  return round(total - payments.reduce((s, p) => s + safeNumber(p), 0), 6);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}
