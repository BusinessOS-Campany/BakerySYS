import { OrdersPage } from "@/components/workflows/order-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["orders.view"]);
  return <OrdersPage locale={auth.locale} canManage={canAny(auth, ["orders.manage"])} />;
}
