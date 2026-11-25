import { notFound } from "next/navigation";
import { ReportsPage, type Period } from "@/components/workflows/reports-view";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, Period> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

export default async function Page({ params }: { params: Promise<{ period: string }> }) {
  const { period: slug } = await params;
  const period = PERIODS[slug];
  if (!period) notFound();

  const auth = await requireWorkflow(["reports.view"]);
  return (
    <ReportsPage
      canExport={canAny(auth, ["reports.export"])}
      currency={auth.tenant.currencyCode}
      decimalPlaces={auth.tenant.decimalPlaces}
      locale={auth.locale}
      period={period}
      tenantName={auth.locale === "ar" ? auth.tenant.nameAr : auth.tenant.nameEn}
      timezone={auth.tenant.timezone}
    />
  );
}
