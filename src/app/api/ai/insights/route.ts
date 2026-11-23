import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { getAIProvider } from "@/lib/ai/provider";
import { getReportData } from "@/lib/reports/service";
import { checkLowStock } from "@/lib/notifications/notify";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "reports.view",
  handler: async (_input, auth, req) => {
    const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days") ?? 30), 1), 365);
    const [report, lowStock] = await Promise.all([
      getReportData(db, auth.user.tenantId, days),
      checkLowStock(db, auth.user.tenantId),
    ]);
    const insights = await getAIProvider().insights({
      currency: auth.tenant.currencyCode,
      summary: report.summary,
      topProducts: report.salesByProduct.slice(0, 10).map((p) => ({
        name: auth.locale === "ar" ? p.nameAr : p.name,
        revenue: p.revenue,
        profit: p.profit,
      })),
      lowStock: lowStock.map((item) => ({
        name: auth.locale === "ar" ? item.nameAr : item.nameEn,
        current: item.current,
        minimum: item.minimum,
      })),
    });
    return serialize({ provider: getAIProvider().name, insights });
  },
});
