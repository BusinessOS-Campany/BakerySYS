import { UsersPage } from "@/components/workflows/admin-ops";
import { requireAdmin } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireAdmin();
  return <UsersPage locale={auth.locale} canManage />;
}
