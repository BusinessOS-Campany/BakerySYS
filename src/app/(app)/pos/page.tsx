import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { PosScreen, type PosData } from "@/components/pos/pos-screen";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!auth.permissions.has("sales.create") && !auth.roles.includes("OWNER")) redirect("/");

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
        ...(auth.user.id ? { cashierId: auth.user.id } : {}),
      },
      orderBy: { openedAt: "desc" },
    }),
  ]);

  const stocks = await db.finishedStock.findMany({
    where: { tenantId: auth.user.tenantId, warehouseId: { in: warehouses.map((w) => w.id) } },
    select: { warehouseId: true, productId: true, quantity: true },
  });

  return (
    <PosScreen
      locale={auth.locale}
      currency={auth.tenant.currencyCode}
      decimalPlaces={auth.tenant.decimalPlaces}
      taxRate={Number(auth.tenant.taxRate)}
      taxEnabled={auth.tenant.taxEnabled}
      defaultBranchId={auth.branchId ?? branches[0]?.id ?? null}
      canOpenSession={auth.permissions.has("pos.open") || auth.roles.includes("OWNER")}
      canCloseSession={auth.permissions.has("pos.close") || auth.roles.includes("OWNER")}
      data={serialize({ products, warehouses, branches, customers, registers, stocks, openSession }) as unknown as PosData}
    />
  );
}
