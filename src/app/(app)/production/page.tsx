import { ProductionPage } from "@/components/workflows/production-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["production.view"]);
  return (
    <ProductionPage
      locale={auth.locale}
      canManage={canAny(auth, ["production.manage"])}
      canComplete={canAny(auth, ["production.complete"])}
    />
  );
}
