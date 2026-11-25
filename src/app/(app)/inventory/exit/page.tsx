import { StockExitPage } from "@/components/workflows/stock-exit-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lot?: string | string[] }>;
}) {
  const auth = await requireWorkflow(["inventory.view"]);
  const { lot } = await searchParams;
  const selectedLotId = Array.isArray(lot) ? lot[0] ?? "" : lot ?? "";
  return (
    <StockExitPage
      canManage={canAny(auth, ["inventory.manage"])}
      locale={auth.locale}
      selectedLotId={selectedLotId}
    />
  );
}
