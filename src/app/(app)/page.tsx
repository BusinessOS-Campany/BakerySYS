import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDownRight, ArrowUpRight, Boxes, CircleAlert, ClipboardList, Croissant,
  Factory, ReceiptText, TrendingUp, Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { checkLowStock } from "@/lib/notifications/notify";
import { formatDate, formatMoney, formatNumber, translate } from "@/lib/i18n/dictionary";
import { SalesChart, type SalesPoint } from "@/components/dashboard/sales-chart";

export const dynamic = "force-dynamic";

function startOfUtcDay(date: Date, daysBack = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysBack));
}

const sum = (value: unknown) => Number(value ?? 0);

export default async function DashboardPage() {
  const auth = await requireAuth();
  if (!auth.permissions.has("dashboard.view") && !auth.roles.includes("OWNER")) redirect("/pos");

  const t = (key: string) => translate(auth.locale, key);
  const locale = auth.locale;
  const currency = auth.tenant.currencyCode;
  const dp = auth.tenant.decimalPlaces;
  const money = (value: number) => formatMoney(value, locale, currency, dp);
  const branchFilter = auth.branchId ? { branchId: auth.branchId } : {};

  const now = new Date();
  const startToday = startOfUtcDay(now);
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dow = (now.getUTCDay() + 6) % 7;
  const startWeek = startOfUtcDay(now, dow);
  const chartStart = startOfUtcDay(now, 13);

  const [warehouses, selectedBranch] = await Promise.all([
    db.warehouse.findMany({
      where: { tenantId: auth.user.tenantId, ...(auth.branchId ? { branchId: auth.branchId } : {}) },
      select: { id: true },
    }),
    db.branch.findFirst({
      where: { id: auth.branchId ?? "__none__", tenantId: auth.user.tenantId },
      select: { nameAr: true, nameEn: true },
    }),
  ]);
  const warehouseIds = warehouses.map((w) => w.id);

  const [todaySales, weekSales, monthExpenses, pendingOrders, monthBatches, recentSales, lowStock, receivables, ingredientLots, finishedLots] = await Promise.all([
    db.sale.aggregate({
      where: { tenantId: auth.user.tenantId, ...branchFilter, status: "COMPLETED", invoiceDate: { gte: startToday } },
      _sum: { total: true, profit: true, costAmount: true },
      _count: { _all: true },
    }),
    db.sale.aggregate({
      where: { tenantId: auth.user.tenantId, ...branchFilter, status: "COMPLETED", invoiceDate: { gte: startWeek } },
      _sum: { total: true, profit: true },
    }),
    db.expense.aggregate({
      where: { tenantId: auth.user.tenantId, ...branchFilter, status: "POSTED", expenseDate: { gte: startMonth } },
      _sum: { amount: true },
    }),
    db.customerOrder.count({
      where: {
        tenantId: auth.user.tenantId,
        ...branchFilter,
        status: { in: ["NEW", "CONFIRMED", "IN_PRODUCTION", "READY"] },
      },
    }),
    db.productionBatch.findMany({
      where: { tenantId: auth.user.tenantId, ...branchFilter, createdAt: { gte: startMonth } },
      select: { status: true },
    }),
    db.sale.findMany({
      where: { tenantId: auth.user.tenantId, ...branchFilter, status: "COMPLETED", invoiceDate: { gte: chartStart } },
      select: { invoiceDate: true, total: true, profit: true },
      orderBy: { invoiceDate: "asc" },
    }),
    checkLowStock(db, auth.user.tenantId),
    db.customerReceivable.findMany({
      where: { tenantId: auth.user.tenantId, status: "OPEN" },
      select: { amount: true, settled: true },
    }),
    db.ingredientLot.findMany({
      where: { tenantId: auth.user.tenantId, warehouseId: { in: warehouseIds } },
      select: { quantity: true, unitCost: true },
    }),
    db.finishedLot.findMany({
      where: { tenantId: auth.user.tenantId, warehouseId: { in: warehouseIds } },
      select: { quantity: true, unitCost: true },
    }),
  ]);

  const chartMap = new Map<string, { revenue: number; profit: number }>();
  for (let i = 13; i >= 0; i -= 1) {
    const day = startOfUtcDay(now, i);
    chartMap.set(day.toISOString().slice(0, 10), { revenue: 0, profit: 0 });
  }
  for (const sale of recentSales) {
    const key = sale.invoiceDate.toISOString().slice(0, 10);
    const point = chartMap.get(key);
    if (point) {
      point.revenue += Number(sale.total);
      point.profit += Number(sale.profit);
    }
  }
  const chartData: SalesPoint[] = [...chartMap.entries()].map(([date, value]) => ({
    date,
    label: formatDate(date, locale),
    revenue: Math.round(value.revenue * 100) / 100,
    profit: Math.round(value.profit * 100) / 100,
  }));

  const todayRevenue = sum(todaySales._sum.total);
  const weekRevenue = sum(weekSales._sum.total);
  const yesterdayDelta = todayRevenue > 0 && weekRevenue > todayRevenue
    ? Math.round(((todayRevenue / Math.max(weekRevenue - todayRevenue, 1)) - 1) * 100)
    : 0;
  const expenses = sum(monthExpenses._sum.amount);
  const completedBatches = monthBatches.filter((b) => b.status === "COMPLETED").length;
  const completionRate = monthBatches.length === 0 ? 0 : Math.round((completedBatches / monthBatches.length) * 100);
  const rawValue = ingredientLots.reduce((sum, lot) => sum + Number(lot.quantity) * Number(lot.unitCost), 0);
  const finishedValue = finishedLots.reduce((sum, lot) => sum + Number(lot.quantity) * Number(lot.unitCost), 0);
  const receivablesValue = receivables.reduce((sum, r) => sum + Number(r.amount) - Number(r.settled), 0);

  const kpis = [
    { key: "dashboard.revenue", value: money(todayRevenue), sub: `${t("common.week")}: ${money(weekRevenue)}`, href: "/sales", icon: ReceiptText, tone: "text-[var(--primary)]" },
    { key: "dashboard.transactions", value: formatNumber(todaySales._count._all, locale, 0), sub: t("common.today"), href: "/sales", icon: TrendingUp, tone: "text-emerald-500" },
    { key: "dashboard.grossProfit", value: money(sum(todaySales._sum.profit)), sub: `${yesterdayDelta >= 0 ? "+" : ""}${yesterdayDelta}%`, href: "/reports", icon: Croissant, tone: "text-emerald-500" },
    { key: "dashboard.expenses", value: money(expenses), sub: t("common.month"), href: "/expenses", icon: Wallet, tone: "text-[var(--danger)]" },
    { key: "dashboard.pendingOrders", value: formatNumber(pendingOrders, locale, 0), sub: t("nav.orders"), href: "/orders", icon: ClipboardList, tone: "text-amber-500" },
    { key: "dashboard.production", value: `${completionRate}%`, sub: `${completedBatches}/${monthBatches.length}`, href: "/production", icon: Factory, tone: "text-blue-500" },
    { key: "dashboard.rawStock", value: money(rawValue), sub: t("nav.ingredients"), href: "/inventory", icon: Boxes, tone: "text-violet-500" },
    { key: "dashboard.finishedStock", value: money(finishedValue), sub: t("nav.products"), href: "/inventory", icon: Croissant, tone: "text-cyan-500" },
    { key: "dashboard.receivables", value: money(receivablesValue), sub: t("nav.customers"), href: "/reports", icon: ArrowDownRight, tone: "text-[var(--danger)]" },
  ];

  const quickActions = [
    { key: "sales.new", href: "/pos", icon: ReceiptText, show: auth.permissions.has("sales.create") },
    { key: "production.newBatch", href: "/production?new=1", icon: Factory, show: auth.permissions.has("production.manage") },
    { key: "nav.purchases", href: "/purchases?new=1", icon: ClipboardList, show: auth.permissions.has("purchases.manage") },
    { key: "orders.new", href: "/orders?new=1", icon: Croissant, show: auth.permissions.has("orders.manage") },
  ].filter((action) => action.show);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
          <p className="muted mt-1 text-sm">
            {formatDate(now, locale, true)} · {locale === "ar" ? auth.tenant.nameAr : auth.tenant.nameEn}
            {selectedBranch ? ` · ${locale === "ar" ? selectedBranch.nameAr : selectedBranch.nameEn}` : ""}
          </p>
        </div>
        {quickActions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link key={action.href} className="btn btn-secondary" href={action.href}>
                <action.icon className="h-4 w-4" /> {t(action.key)}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {kpis.map((kpi) => (
          <Link key={kpi.key} href={kpi.href} className="card group p-4 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <span className="muted text-xs">{t(kpi.key)}</span>
              <kpi.icon className={`h-4 w-4 ${kpi.tone}`} />
            </div>
            <div className="mt-2 text-xl font-bold tabular-nums">{kpi.value}</div>
            <div className="muted mt-1 flex items-center gap-1 text-[11px]">
              {kpi.key === "dashboard.revenue" || kpi.key === "dashboard.grossProfit" ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              ) : null}
              {kpi.sub}
            </div>
          </Link>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="card p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("dashboard.salesChart")}</h2>
            <span className="muted text-xs">{formatDate(chartStart, locale)} — {formatDate(now, locale)}</span>
          </div>
          <SalesChart data={chartData} locale={locale} currency={currency} dp={dp} />
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("dashboard.alerts")}</h2>
            <Link className="text-xs text-[var(--primary)] hover:underline" href="/inventory">{t("action.view")}</Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <CircleAlert className="h-7 w-7 text-emerald-500" />
              <p className="muted text-sm">{t("shell.noNotifications")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 6).map((alert) => (
                <Link
                  key={`${alert.type}-${alert.id}`}
                  href="/inventory"
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{locale === "ar" ? alert.nameAr : alert.nameEn}</div>
                    <div className="muted text-[11px]">{alert.type === "RAW" ? t("nav.ingredients") : t("nav.products")}</div>
                  </div>
                  <div className="shrink-0 text-end text-xs">
                    <div className="font-semibold text-[var(--danger)]">{formatNumber(alert.current, locale, 1)}</div>
                    <div className="muted">/ {formatNumber(alert.minimum, locale, 1)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
