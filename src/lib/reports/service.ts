import type { Db } from "@/lib/db";
import { round } from "@/lib/calculations";

export type ReportPeriod = "day" | "week" | "month";
export type ReportRange = { from: Date; to: Date };
export type ReportMeta = { period: ReportPeriod | "custom"; days?: number };

const DAY_MS = 86_400_000;

const sum = (rows: { amount?: unknown; total?: unknown; profit?: unknown; costAmount?: unknown; quantity?: unknown; unitCost?: unknown }[], key: "amount" | "total" | "profit" | "costAmount") =>
  round(rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0), 6);

function dateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function parseDateKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

function zoneOffset(date: Date, timeZone: string) {
  const value = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(value);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === "-" ? -minutes : minutes) * 60_000;
}

/** Midnight of a calendar date in the tenant timezone, as an absolute instant. */
function midnight(key: string, timeZone: string) {
  const utc = new Date(`${key}T00:00:00.000Z`);
  const estimate = new Date(utc.getTime() - zoneOffset(utc, timeZone));
  return new Date(utc.getTime() - zoneOffset(estimate, timeZone));
}

function addDays(key: string, amount: number) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

/** Selected day/week/month (or today when no anchor is given), aligned to the tenant calendar. */
export function getReportRange(period: ReportPeriod, timeZone: string, now = new Date(), anchor?: string): ReportRange {
  const today = parseDateKey(anchor) ?? dateKey(now, timeZone);
  if (period === "day") {
    return { from: midnight(today, timeZone), to: midnight(addDays(today, 1), timeZone) };
  }
  if (period === "week") {
    const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    const monday = addDays(today, -((weekday + 6) % 7));
    return { from: midnight(monday, timeZone), to: midnight(addDays(monday, 7), timeZone) };
  }
  const [year, month] = today.split("-").map(Number);
  return {
    from: midnight(new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10), timeZone),
    to: midnight(new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10), timeZone),
  };
}

/** `period` takes precedence; `days` is kept for older clients. */
export function resolveReportRange(input: { period?: unknown; days?: unknown; date?: unknown; anchor?: unknown }, timeZone: string): { range: ReportRange; meta: ReportMeta } {
  const anchor = parseDateKey(input.date ?? input.anchor) ?? undefined;
  if (typeof input.period === "string" && ["day", "week", "month"].includes(input.period)) {
    const period = input.period as ReportPeriod;
    return { range: getReportRange(period, timeZone, new Date(), anchor), meta: { period } };
  }
  const parsed = Math.round(Number(input.days ?? 30));
  const days = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 30, 1), 365);
  return { range: { from: new Date(Date.now() - days * DAY_MS), to: new Date() }, meta: { period: "custom", days } };
}

export async function getReportData(db: Db, tenantId: string, range: ReportRange, meta: ReportMeta = { period: "custom" }) {
  const [sales, expenses, ingredientLots, finishedLots, receivableBalances, payableBalances, journalEntries, meals] = await Promise.all([
    db.sale.findMany({
      where: { tenantId, status: "COMPLETED", isCredit: false, invoiceDate: { gte: range.from, lt: range.to } },
      select: { id: true, total: true, profit: true, costAmount: true, taxAmount: true, invoiceDate: true },
    }),
    db.expense.findMany({
      where: { tenantId, status: "POSTED", expenseDate: { gte: range.from, lt: range.to } },
      select: { amount: true, categoryId: true },
    }),
    db.ingredientLot.findMany({ where: { tenantId, quantity: { gt: 0 } }, select: { quantity: true, unitCost: true } }),
    db.finishedLot.findMany({ where: { tenantId, quantity: { gt: 0 } }, select: { quantity: true, unitCost: true } }),
    db.customerReceivable.findMany({ where: { tenantId, status: { in: ["OPEN", "PARTIAL"] } }, select: { amount: true, settled: true } }),
    db.supplierPayable.findMany({ where: { tenantId, status: { in: ["OPEN", "PARTIAL"] } }, select: { amount: true, settled: true } }),
    db.journalEntry.findMany({
      where: { tenantId, status: "POSTED", date: { gte: range.from, lt: range.to } },
      select: { id: true, entryNumber: true, date: true, description: true },
    }),
    db.mealServing.findMany({
      where: { tenantId, servedAt: { gte: range.from, lt: range.to } },
      select: { id: true, name: true, servedAt: true, quantityKg: true, note: true },
      orderBy: { servedAt: "desc" },
    }),
  ]);

  const revenue = sum(sales, "total");
  const cogs = sum(sales, "costAmount");
  const grossProfit = sum(sales, "profit");
  const tax = round(sales.reduce((acc, sale) => acc + Number(sale.taxAmount), 0), 6);
  const expenseTotal = sum(expenses, "amount");
  const netProfit = round(grossProfit - expenseTotal, 6);
  const rawStockValue = round(ingredientLots.reduce((acc, lot) => acc + Number(lot.quantity) * Number(lot.unitCost), 0), 6);
  const finishedStockValue = round(finishedLots.reduce((acc, lot) => acc + Number(lot.quantity) * Number(lot.unitCost), 0), 6);
  const receivables = round(receivableBalances.reduce((acc, r) => acc + Number(r.amount) - Number(r.settled), 0), 6);
  const payables = round(payableBalances.reduce((acc, p) => acc + Number(p.amount) - Number(p.settled), 0), 6);

  const saleIds = sales.map((sale) => sale.id);
  const saleItems = saleIds.length
    ? await db.saleItem.findMany({
        where: { tenantId, saleId: { in: saleIds } },
        select: { productId: true, quantity: true, lineTotal: true, unitCost: true },
      })
    : [];
  const productIds = [...new Set(saleItems.map((item) => item.productId))];
  const products = productIds.length
    ? await db.product.findMany({ where: { tenantId, id: { in: productIds } }, select: { id: true, nameAr: true, nameEn: true, sku: true } })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const salesByProductMap = new Map<string, { revenue: number; cogs: number; profit: number; quantity: number }>();
  for (const item of saleItems) {
    const quantity = Number(item.quantity);
    const revenue = Number(item.lineTotal);
    const cost = round(quantity * Number(item.unitCost), 6);
    const entry = salesByProductMap.get(item.productId) ?? { revenue: 0, cogs: 0, profit: 0, quantity: 0 };
    entry.revenue += revenue;
    entry.cogs += cost;
    entry.profit += revenue - cost;
    entry.quantity += quantity;
    salesByProductMap.set(item.productId, entry);
  }
  const salesByProduct = [...salesByProductMap.entries()].map(([productId, value]) => ({
    productId,
    name: productMap.get(productId)?.nameEn ?? productId,
    nameAr: productMap.get(productId)?.nameAr ?? productId,
    sku: productMap.get(productId)?.sku ?? "",
    revenue: round(value.revenue, 6),
    cogs: round(value.cogs, 6),
    profit: round(value.profit, 6),
    quantity: round(value.quantity, 6),
    transactions: round(value.quantity, 6),
  })).sort((a, b) => b.revenue - a.revenue);

  const journalIds = journalEntries.map((entry) => entry.id);
  const lines = journalIds.length
    ? await db.journalLine.findMany({ where: { tenantId, entryId: { in: journalIds } }, select: { accountId: true, debit: true, credit: true } })
    : [];
  const accounts = await db.account.findMany({ where: { tenantId }, select: { id: true, code: true, nameAr: true, nameEn: true, type: true } });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const trialMap = new Map<string, { code: string; name: string; debit: number; credit: number }>();
  for (const line of lines) {
    const account = accountMap.get(line.accountId);
    if (!account) continue;
    const row = trialMap.get(account.id) ?? { code: account.code, name: account.nameEn, debit: 0, credit: 0 };
    row.debit += Number(line.debit);
    row.credit += Number(line.credit);
    trialMap.set(account.id, row);
  }
  const trialBalance = [...trialMap.values()]
    .map((row) => ({ ...row, debit: round(row.debit, 6), credit: round(row.credit, 6) }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    period: { ...meta, from: range.from.toISOString(), to: range.to.toISOString(), generatedAt: new Date().toISOString() },
    summary: {
      revenue, cogs, grossProfit, tax, expenses: expenseTotal, netProfit, rawStockValue, finishedStockValue, receivables, payables,
      mealsTotalKg: round(meals.reduce((acc, meal) => acc + Number(meal.quantityKg), 0), 3),
      mealsCount: meals.length,
    },
    salesByProduct,
    trialBalance,
    journalEntries: journalEntries.slice(0, 50),
    meals,
  };
}
