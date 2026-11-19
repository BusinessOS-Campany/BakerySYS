import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { createSale } from "@/lib/sales/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";
import { saleSchema } from "@/lib/schemas/sale";

export const POST = apiRoute({
  permission: "sales.create",
  schema: saleSchema,
  idempotent: true,
  handler: async (input, auth) => {
    assertBranchAccess(auth, input.branchId);
    const warehouse = await db.warehouse.findFirst({
      where: {
        id: input.warehouseId, tenantId: auth.user.tenantId, active: true,
        ...(auth.branchId ? { OR: [{ branchId: auth.branchId }, { branchId: null }] } : {}),
      },
      select: { id: true },
    });
    if (!warehouse) throw new AppError("NOT_FOUND", "Warehouse not found", "المخزن غير موجود");
    const result = await db.$transaction((tx) => createSale(tx, auth, input));
    return serialize(result);
  },
});

export const GET = apiRoute({
  permission: "sales.view",
  handler: async (_input, auth, req) => {
    const url = new URL(req.url);
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? 25), 1), 100);
    const search = (url.searchParams.get("search") ?? "").trim();
    const where = {
      tenantId: auth.user.tenantId,
      ...(auth.branchId ? { branchId: auth.branchId } : {}),
      ...(search ? { invoiceNumber: { contains: search, mode: "insensitive" as const } } : {}),
    };
    const [items, total] = await Promise.all([
      db.sale.findMany({ where, orderBy: { invoiceDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      db.sale.count({ where }),
    ]);
    return serialize({ items, total, page, pageSize });
  },
});
