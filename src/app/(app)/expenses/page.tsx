import { ExpensesPage } from "@/components/workflows/expense-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["expenses.view"]);
  return <ExpensesPage locale={auth.locale} canManage={canAny(auth, ["expenses.manage"])} />;
}
