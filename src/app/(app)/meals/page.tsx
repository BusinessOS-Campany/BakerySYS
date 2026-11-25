import { MealsPage } from "@/components/workflows/meals-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["sales.view"]);
  return <MealsPage canManage={canAny(auth, ["sales.create"])} locale={auth.locale} />;
}
