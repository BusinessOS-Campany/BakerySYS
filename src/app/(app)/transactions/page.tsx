import { ArapPage } from "@/components/workflows/arap-page";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string | string[] }>;
}) {
  const auth = await requireWorkflow(["customers.view"]);
  const { customerId } = await searchParams;
  const initialCustomerId = Array.isArray(customerId) ? customerId[0] ?? "" : customerId ?? "";

  return (
    <ArapPage
      canManage={canAny(auth, ["customers.manage"])}
      currency={auth.tenant.currencyCode}
      decimalPlaces={auth.tenant.decimalPlaces}
      initialCustomerId={initialCustomerId}
      locale={auth.locale}
      standalone
    />
  );
}
