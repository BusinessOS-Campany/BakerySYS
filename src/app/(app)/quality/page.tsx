import { QualityPage } from "@/components/workflows/quality-ops";
import { canAny, requireWorkflow } from "@/lib/workflows/gate";

export const dynamic = "force-dynamic";

export default async function Page() {
  const auth = await requireWorkflow(["quality.view"]);
  return <QualityPage locale={auth.locale} canManage={canAny(auth, ["quality.manage"])} />;
}
