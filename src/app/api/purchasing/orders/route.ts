import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { createPurchaseOrder } from "@/lib/purchasing/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "purchases.view",
  handler: async (_input, auth, req) => {
    const url = new URL(req.url);
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? 25), 1), 100);
    const where = {
      tenantId: auth.user.tenantId,
      ...(auth.branchId ? { branchId: auth.branchId } : {}),
    };
    const [orders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where, orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      db.purchaseOrder.count({ where }),
    ]);
    const [lines, suppliers] = await Promise.all([
      db.purchaseOrderItem.findMany({
        where: { tenantId: auth.user.tenantId, orderId: { in: orders.map((o) => o.id) } },
      }),
      db.supplier.findMany({
        where: { tenantId: auth.user.tenantId, id: { in: [...new Set(orders.map((o) => o.supplierId))] } },
        select: { id: true, nameAr: true, nameEn: true },
      }),
    ]);
    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
    const items = orders.map((order) => ({
      ...order,
      lines: lines.filter((l) => l.orderId === order.id),
      supplierName: auth.locale === "ar"
        ? supplierMap.get(order.supplierId)?.nameAr ?? order.supplierId
        : supplierMap.get(order.supplierId)?.nameEn ?? order.supplierId,
    }));
    return serialize({ items, total, page, pageSize });
  },
});

const schema = z.object({
  supplierId: z.string().min(1),
  warehouseId: z.string().min(1),
  branchId: z.string().nullable().optional(),
  expectedDate: z.string().datetime().nullable().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    ingredientId: z.string().min(1),
    quantity: z.number().positive(),
    unitId: z.string().min(1),
    unitPrice: z.number().min(0),
  })).min(1),
});

export const POST = apiRoute({
  permission: "purchases.manage",
  schema,
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
    const order = await db.$transaction((tx) => createPurchaseOrder(tx, {
      tenantId: auth.user.tenantId,
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      branchId: input.branchId ?? auth.branchId ?? null,
      expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
      notes: input.notes,
      createdById: auth.user.id,
      items: input.items,
    }));
    return serialize(order);
  },
});
