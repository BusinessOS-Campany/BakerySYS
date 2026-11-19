import { SettingsPage } from "@/components/workflows/admin-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["settings.view"]);
  return <SettingsPage locale={auth.locale} canManage={canAny(auth, ["settings.manage"])} />;
}
