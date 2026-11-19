import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { receiveGoods } from "@/lib/purchasing/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "purchases.view",
  handler: async (_input, auth, req) => {
    const url = new URL(req.url);
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? 25), 1), 100);
    const where = { tenantId: auth.user.tenantId };
    const [receipts, total] = await Promise.all([
      db.goodsReceipt.findMany({
        where, orderBy: { receivedAt: "desc" },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      db.goodsReceipt.count({ where }),
    ]);
    const [lines, suppliers, payables] = await Promise.all([
      db.goodsReceiptItem.findMany({
        where: { tenantId: auth.user.tenantId, receiptId: { in: receipts.map((r) => r.id) } },
      }),
      db.supplier.findMany({
        where: { tenantId: auth.user.tenantId, id: { in: [...new Set(receipts.map((r) => r.supplierId))] } },
        select: { id: true, nameAr: true, nameEn: true },
      }),
      db.supplierPayable.findMany({
        where: { tenantId: auth.user.tenantId, sourceType: "GOODS_RECEIPT", sourceId: { in: receipts.map((r) => r.id) } },
      }),
    ]);
    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
    const items = receipts.map((receipt) => ({
      ...receipt,
      lines: lines.filter((l) => l.receiptId === receipt.id),
      payable: payables.find((p) => p.sourceId === receipt.id) ?? null,
      supplierName: auth.locale === "ar"
        ? supplierMap.get(receipt.supplierId)?.nameAr ?? receipt.supplierId
        : supplierMap.get(receipt.supplierId)?.nameEn ?? receipt.supplierId,
    }));
    return serialize({ items, total, page, pageSize });
  },
});

const schema = z.object({
  orderId: z.string().nullable().optional(),
  supplierId: z.string().min(1),
  warehouseId: z.string().min(1),
  receivedAt: z.string().datetime().optional(),
  inspectionNote: z.string().optional(),
  items: z.array(z.object({
    orderItemId: z.string().nullable().optional(),
    ingredientId: z.string().min(1),
    quantity: z.number().positive(),
    acceptedQuantity: z.number().min(0).optional(),
    rejectedQuantity: z.number().min(0).optional(),
    unitId: z.string().min(1),
    unitCost: z.number().min(0),
    lotNumber: z.string().optional(),
    expiryDate: z.string().datetime().optional(),
  })).min(1),
});

export const POST = apiRoute({
  permission: "purchases.manage",
  schema,
  idempotent: true,
  handler: async (input, auth) => {
    let branchId: string | null = null;
    if (input.orderId) {
      const order = await db.purchaseOrder.findFirst({
        where: { id: input.orderId, tenantId: auth.user.tenantId },
        select: { branchId: true },
      });
      if (!order) throw new AppError("NOT_FOUND", "Purchase order not found", "أمر الشراء غير موجود");
      branchId = order.branchId;
    }
    if (!branchId) {
      const warehouse = await db.warehouse.findFirst({
        where: { id: input.warehouseId, tenantId: auth.user.tenantId },
        select: { branchId: true },
      });
      branchId = warehouse?.branchId ?? null;
    }
    assertBranchAccess(auth, branchId);
    const result = await db.$transaction((tx) => receiveGoods(tx, {
      tenantId: auth.user.tenantId,
      orderId: input.orderId ?? null,
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : undefined,
      inspectionNote: input.inspectionNote,
      receivedById: auth.user.id,
      items: input.items.map((item) => ({
        ...item,
        orderItemId: item.orderItemId ?? null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      })),
    }));
    return serialize(result);
  },
});
