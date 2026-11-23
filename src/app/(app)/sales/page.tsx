import { SalesPage } from "@/components/workflows/sales-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["sales.view"]);
  return (
    <SalesPage
      locale={auth.locale}
      canRefund={canAny(auth, ["sales.refund"])}
      canEdit={canAny(auth, ["sales.create"])}
      currency={auth.tenant.currencyCode}
      decimalPlaces={auth.tenant.decimalPlaces}
    />
  );
}
