import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth/session";
import { AppShell } from "@/components/app/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  if (!auth) redirect("/login");

  const [branches, unread] = await Promise.all([
    db.branch.findMany({
      where: {
        tenantId: auth.user.tenantId,
        active: true,
        ...(auth.branchIds.length > 0 ? { id: { in: auth.branchIds } } : {}),
      },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { code: "asc" },
    }),
    db.notification.count({
      where: {
        tenantId: auth.user.tenantId,
        read: false,
        OR: [{ userId: auth.user.id }, { userId: null }],
      },
    }),
  ]);

  const tenantName = auth.locale === "ar" ? auth.tenant.nameAr : auth.tenant.nameEn;
  const userName = auth.locale === "ar" ? auth.user.nameAr : auth.user.nameEn;

  return (
    <AppShell
      locale={auth.locale}
      tenantName={tenantName}
      userName={userName}
      userEmail={auth.user.email}
      permissions={[...auth.permissions]}
      branches={branches}
      currentBranchId={auth.branchId}
      canSeeAllBranches={auth.branchIds.length === 0}
      initialUnread={unread}
    >
      {children}
    </AppShell>
  );
}
