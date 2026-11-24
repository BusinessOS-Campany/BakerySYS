import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { getAIProvider } from "@/lib/ai/provider";
import { getReportData, resolveReportRange } from "@/lib/reports/service";
import { checkLowStock } from "@/lib/notifications/notify";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "reports.view",
  handler: async (_input, auth, req) => {
    const url = new URL(req.url);
    const { range, meta } = resolveReportRange({
      period: url.searchParams.get("period") ?? undefined,
      days: url.searchParams.get("days") ?? undefined,
    }, auth.tenant.timezone);
    const [report, lowStock] = await Promise.all([
      getReportData(db, auth.user.tenantId, range, meta),
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
