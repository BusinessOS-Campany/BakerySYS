import { PurchasesPage } from "@/components/workflows/purchasing-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["purchases.view"]);
  return (
    <PurchasesPage
      locale={auth.locale}
      canManage={canAny(auth, ["purchases.manage"])}
      canApprove={canAny(auth, ["purchases.approve"])}
    />
  );
}
