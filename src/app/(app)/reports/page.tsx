import { ReportsPage } from "@/components/workflows/reports-view";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["reports.view"]);
  return (
    <ReportsPage
      locale={auth.locale}
      canExport={canAny(auth, ["reports.export"])}
      currency={auth.tenant.currencyCode}
      decimalPlaces={auth.tenant.decimalPlaces}
    />
  );
}
