import { UsersPage } from "@/components/workflows/admin-ops";
import { requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["users.manage"]);
  return <UsersPage locale={auth.locale} canManage />;
}
