import { ReportsPage } from "@/components/workflows/reports-view";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["reports.view"]);
  return (
    <ReportsPage
      canExport={canAny(auth, ["reports.export"])}
      currency={auth.tenant.currencyCode}
      decimalPlaces={auth.tenant.decimalPlaces}
      locale={auth.locale}
      period="month"
      tenantName={auth.locale === "ar" ? auth.tenant.nameAr : auth.tenant.nameEn}
      timezone={auth.tenant.timezone}
    />
  );
}
