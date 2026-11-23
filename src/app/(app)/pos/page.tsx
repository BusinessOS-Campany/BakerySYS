import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { computeExpectedCash } from "@/lib/calculations";
import { sessionCashTotals } from "@/lib/sales/service";
import { PosScreen, type PosData } from "@/components/pos/pos-screen";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!auth.permissions.has("sales.create") && !auth.roles.includes("OWNER")) redirect("/");
  const canCloseSession = auth.permissions.has("pos.close") || auth.roles.includes("OWNER");

  const [products, warehouses, branches, customers, registers, openSession] = await Promise.all([
    db.product.findMany({
      where: { tenantId: auth.user.tenantId, active: true },
      select: {
        id: true, sku: true, nameAr: true, nameEn: true, sellingPrice: true,
        costPrice: true, taxRate: true, minStock: true, categoryId: true,
      },
      orderBy: { nameEn: "asc" },
    }),
    db.warehouse.findMany({
      where: { tenantId: auth.user.tenantId, active: true, kind: { in: ["FINISHED", "BOTH"] } },
      select: { id: true, branchId: true, code: true, nameAr: true, nameEn: true },
      orderBy: { code: "asc" },
    }),
    db.branch.findMany({
      where: {
        tenantId: auth.user.tenantId, active: true,
        ...(auth.branchIds.length ? { id: { in: auth.branchIds } } : {}),
      },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { code: "asc" },
    }),
    db.customer.findMany({
      where: { tenantId: auth.user.tenantId, active: true },
      select: { id: true, nameAr: true, nameEn: true, phone: true, code: true },
      orderBy: { nameEn: "asc" },
      take: 500,
    }),
    db.cashRegister.findMany({
      where: { tenantId: auth.user.tenantId, active: true },
      select: { id: true, branchId: true, code: true, nameAr: true, nameEn: true },
      orderBy: { code: "asc" },
    }),
    db.cashSession.findFirst({
      where: {
        tenantId: auth.user.tenantId, status: "OPEN",
        // Cashiers use their own session; supervisors/owners (pos.close) may
        // act on any open session in their branch, matching the API policy.
        ...(canCloseSession
          ? (auth.branchId ? { branchId: auth.branchId } : {})
          : { cashierId: auth.user.id }),
      },
      orderBy: { openedAt: "desc" },
    }),
  ]);

  let summary: {
    openingBalance: number;
    expectedCash: number;
    cashSales: number;
    cashIn: number;
    cashOut: number;
    saleCount: number;
    cashInCount: number;
    cashOutCount: number;
  } | null = null;
  if (openSession) {
    const totals = await sessionCashTotals(db, auth, openSession.id);
    summary = {
      openingBalance: Number(openSession.openingBalance),
      expectedCash: computeExpectedCash({ openingBalance: openSession.openingBalance, ...totals }),
      ...totals,
    };
  }

  return (
    <PosScreen
      locale={auth.locale}
      currency={auth.tenant.currencyCode}
      decimalPlaces={auth.tenant.decimalPlaces}
      taxRate={Number(auth.tenant.taxRate)}
      taxEnabled={auth.tenant.taxEnabled}
      defaultBranchId={auth.branchId ?? branches[0]?.id ?? null}
      canOpenSession={auth.permissions.has("pos.open") || auth.roles.includes("OWNER")}
      canCloseSession={canCloseSession}
      data={serialize({ products, warehouses, branches, customers, registers, openSession, summary }) as unknown as PosData}
    />
  );
}
