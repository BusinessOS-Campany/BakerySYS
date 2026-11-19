import { AccountingPage } from "@/components/workflows/accounting-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["accounting.view"]);
  return <AccountingPage locale={auth.locale} canManage={canAny(auth, ["accounting.manage"])} />;
}
