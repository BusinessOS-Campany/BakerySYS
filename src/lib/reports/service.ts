import type { Db } from "@/lib/db";
import { round } from "@/lib/calculations";

const sum = (rows: { amount?: unknown; total?: unknown; profit?: unknown; costAmount?: unknown; quantity?: unknown; unitCost?: unknown }[], key: "amount" | "total" | "profit" | "costAmount") =>
  round(rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0), 6);

export async function getReportData(db: Db, tenantId: string, days: number) {
  const since = new Date(Date.now() - Math.max(days, 1) * 86_400_000);
  const [sales, expenses, batches, ingredientLots, finishedLots, receivableBalances, payableBalances, journalEntries] = await Promise.all([
    db.sale.findMany({
      where: { tenantId, status: "COMPLETED", invoiceDate: { gte: since } },
      select: { id: true, total: true, profit: true, costAmount: true, taxAmount: true, invoiceDate: true },
    }),
    db.expense.findMany({
      where: { tenantId, status: "POSTED", expenseDate: { gte: since } },
      select: { amount: true, categoryId: true },
    }),
    db.productionBatch.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { status: true, productId: true, actualQuantity: true, rejectedQuantity: true },
    }),
    db.ingredientLot.findMany({ where: { tenantId, quantity: { gt: 0 } }, select: { quantity: true, unitCost: true } }),
    db.finishedLot.findMany({ where: { tenantId, quantity: { gt: 0 } }, select: { quantity: true, unitCost: true } }),
    db.customerReceivable.findMany({ where: { tenantId, status: { in: ["OPEN", "PARTIAL"] } }, select: { amount: true, settled: true } }),
    db.supplierPayable.findMany({ where: { tenantId, status: { in: ["OPEN", "PARTIAL"] } }, select: { amount: true, settled: true } }),
    db.journalEntry.findMany({
      where: { tenantId, status: "POSTED", date: { gte: since } },
      select: { id: true, entryNumber: true, date: true, description: true },
    }),
  ]);

  const revenue = sum(sales, "total");
  const cogs = sum(sales, "costAmount");
  const grossProfit = sum(sales, "profit");
  const tax = round(sales.reduce((acc, sale) => acc + Number(sale.taxAmount), 0), 6);
  const expenseTotal = sum(expenses, "amount");
  const netProfit = round(grossProfit - expenseTotal, 6);
  const completed = batches.filter((batch) => batch.status === "COMPLETED");
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
    period: { days, since: since.toISOString(), generatedAt: new Date().toISOString() },
    summary: { revenue, cogs, grossProfit, tax, expenses: expenseTotal, netProfit, rawStockValue, finishedStockValue, receivables, payables },
    production: {
      batches: batches.length,
      completed: completed.length,
      completedQuantity: round(completed.reduce((acc, b) => acc + Number(b.actualQuantity ?? 0), 0), 6),
      rejectedQuantity: round(batches.reduce((acc, b) => acc + Number(b.rejectedQuantity ?? 0), 0), 6),
    },
    salesByProduct,
    trialBalance,
    journalEntries: journalEntries.slice(0, 50),
  };
}
