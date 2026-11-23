import { InventoryPage } from "@/components/workflows/inventory-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ingredient?: string | string[] }>;
}) {
  const auth = await requireWorkflow(["inventory.view"]);
  const { ingredient } = await searchParams;
  const selectedIngredientId = Array.isArray(ingredient) ? ingredient[0] ?? "" : ingredient ?? "";
  return (
    <InventoryPage
      canManage={canAny(auth, ["inventory.manage"])}
      locale={auth.locale}
      selectedIngredientId={selectedIngredientId}
    />
  );
}
