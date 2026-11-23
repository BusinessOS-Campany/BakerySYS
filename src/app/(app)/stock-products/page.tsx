import { StockProductsPage } from "@/components/workflows/stock-products";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["ingredients.view"]);
  return <StockProductsPage locale={auth.locale} canManage={canAny(auth, ["ingredients.manage"])} />;
}
