import { ArapPage } from "@/components/workflows/arap-page";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["customers.view"]);
  return (
    <ArapPage
      canManage={canAny(auth, ["customers.manage"])}
      currency={auth.tenant.currencyCode}
      decimalPlaces={auth.tenant.decimalPlaces}
      locale={auth.locale}
    />
  );
}
