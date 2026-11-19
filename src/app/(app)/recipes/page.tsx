import { RecipesPage } from "@/components/workflows/recipe-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["recipes.view"]);
  return <RecipesPage locale={auth.locale} canManage={canAny(auth, ["recipes.manage"])} />;
}
