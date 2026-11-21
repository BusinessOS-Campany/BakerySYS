import { z } from "zod";
import { apiRoute } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import { round } from "@/lib/calculations";
import type { StatementPayload, StatementTransaction } from "@/lib/customers/types";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const GET = apiRoute<unknown, StatementPayload, { id: string }>({
  permission: "customers.view",
  handler: async (_input, auth, req, ctx) => {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const fromRaw = url.searchParams.get("from") || "";
    const toRaw = url.searchParams.get("to") || "";
    if (fromRaw && !dateSchema.safeParse(fromRaw).success) throw new AppError("VALIDATION", "Invalid from date", "تاريخ البداية غير صالح");
    if (toRaw && !dateSchema.safeParse(toRaw).success) throw new AppError("VALIDATION", "Invalid to date", "تاريخ النهاية غير صالح");
    const fromDate = fromRaw ? new Date(`${fromRaw}T00:00:00.000Z`) : undefined;
    const toDate = toRaw ? new Date(`${toRaw}T23:59:59.999Z`) : undefined;
    if (fromDate && toDate && fromDate > toDate) throw new AppError("VALIDATION", "Invalid period", "الفترة غير صالحة");
    const range = fromDate || toDate
      ? { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) }
      : undefined;

    const tenantId = auth.user.tenantId;
    const customer = await db.customer.findFirst({
      where: { id, tenantId },
      select: { id: true, code: true, nameAr: true, nameEn: true, phone: true, balance: true, creditLimit: true },
    });
    if (!customer) throw new AppError("NOT_FOUND", "Customer not found", "العميل غير موجود");
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { nameAr: true, nameEn: true },
    });

    const sales = await db.sale.findMany({
      where: { tenantId, customerId: id, ...(range ? { invoiceDate: range } : {}) },
      select: { id: true, invoiceNumber: true, invoiceDate: true, total: true },
      orderBy: { invoiceDate: "asc" },
    });
    const saleNumbers = new Map(sales.map((sale) => [sale.id, sale.invoiceNumber]));
    const salePayments = await db.salePayment.findMany({
      where: {
        tenantId,
        saleId: { in: sales.map((sale) => sale.id) },
        method: { not: "CREDIT" },
        ...(range ? { paidAt: range } : {}),
      },
      select: { id: true, saleId: true, reference: true, method: true, amount: true, paidAt: true },
    });

    const orders = await db.customerOrder.findMany({
      where: { tenantId, customerId: id },
      select: { id: true, number: true },
    });
    const orderNumbers = new Map(orders.map((order) => [order.id, order.number]));
    const orderPayments = await db.customerOrderPayment.findMany({
      where: {
        tenantId,
        orderId: { in: orders.map((order) => order.id) },
        ...(range ? { paidAt: range } : {}),
      },
      select: { id: true, orderId: true, kind: true, method: true, reference: true, amount: true, paidAt: true },
    });

    const manualEntries = await db.customerTransaction.findMany({
      where: {
        tenantId,
        customerId: id,
        ...(range ? { entryDate: range } : {}),
        NOT: { sourceType: "SALE" },
      },
      select: { id: true, kind: true, amount: true, sourceType: true, entryDate: true },
      orderBy: { entryDate: "asc" },
    });

    const rows: Omit<StatementTransaction, "balance">[] = [
      ...sales.map((sale) => ({
        id: `sale:${sale.id}`,
        date: sale.invoiceDate.toISOString(),
        reference: sale.invoiceNumber,
        descriptionAr: "فاتورة مبيعات",
        descriptionEn: "Sales invoice",
        debit: round(Number(sale.total), 4),
        credit: 0,
      })),
      ...salePayments.map((payment) => ({
        id: `payment:${payment.id}`,
        date: payment.paidAt.toISOString(),
        reference: payment.reference || saleNumbers.get(payment.saleId) || "",
        descriptionAr: "دفعة فاتورة",
        descriptionEn: "Invoice payment",
        debit: 0,
        credit: round(Number(payment.amount), 4),
      })),
      ...orderPayments.map((payment) => ({
        id: `order-payment:${payment.id}`,
        date: payment.paidAt.toISOString(),
        reference: payment.reference || orderNumbers.get(payment.orderId) || "",
        descriptionAr: payment.kind === "DEPOSIT" ? "عربون طلب" : "دفعة طلب",
        descriptionEn: payment.kind === "DEPOSIT" ? "Order deposit" : "Order payment",
        debit: 0,
        credit: round(Number(payment.amount), 4),
      })),
      ...manualEntries.map((entry) => ({
        id: `manual:${entry.id}`,
        date: entry.entryDate.toISOString(),
        reference: "",
        descriptionAr: entry.sourceType === "SALE_RETURN"
          ? "مرتجع مبيعات"
          : entry.kind === "DEBT" ? "دين يدوي" : "سداد يدوي",
        descriptionEn: entry.sourceType === "SALE_RETURN"
          ? "Sales return"
          : entry.kind === "DEBT" ? "Manual debt" : "Manual payment",
        debit: entry.kind === "DEBT" ? round(Number(entry.amount), 4) : 0,
        credit: entry.kind === "PAYMENT" ? round(Number(entry.amount), 4) : 0,
      })),
    ].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

    const totalDebit = round(rows.reduce((sum, row) => sum + row.debit, 0), 4);
    const totalCredit = round(rows.reduce((sum, row) => sum + row.credit, 0), 4);
    const openingBalance = round(Number(customer.balance) - (totalDebit - totalCredit), 4);
    let running = openingBalance;
    const transactions = rows.map((row) => {
      running = round(running + row.debit - row.credit, 4);
      return { ...row, balance: running };
    });

    return {
      customer: {
        id: customer.id,
        code: customer.code,
        nameAr: customer.nameAr,
        nameEn: customer.nameEn,
        phone: customer.phone,
        balance: round(Number(customer.balance), 4),
        creditLimit: round(Number(customer.creditLimit), 4),
      },
      tenant: {
        nameAr: tenant?.nameAr || "Golden Crust",
        nameEn: tenant?.nameEn || "Golden Crust",
      },
      from: fromRaw || null,
      to: toRaw || null,
      generatedAt: new Date().toISOString(),
      openingBalance,
      closingBalance: running,
      totalDebit,
      totalCredit,
      transactions,
    };
  },
});
