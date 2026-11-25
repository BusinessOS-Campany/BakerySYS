import { StockExitPage } from "@/components/workflows/stock-exit-ops";
import { requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["inventory.view"]);
  return <StockExitPage locale={auth.locale} timezone={auth.tenant.timezone} />;
}
