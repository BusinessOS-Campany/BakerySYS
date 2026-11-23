import { InventoryPage } from "@/components/workflows/inventory-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["inventory.view"]);
  return <InventoryPage locale={auth.locale} canManage={canAny(auth, ["inventory.manage"])} />;
}
