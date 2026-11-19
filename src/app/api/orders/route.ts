import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { createOrder } from "@/lib/orders/service";
import { assertBranchAccess } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "orders.view",
  handler: async (_input, auth, req) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const where = {
      tenantId: auth.user.tenantId,
      ...(auth.branchId ? { branchId: auth.branchId } : {}),
      ...(status ? { status } : {}),
    };
    const orders = await db.customerOrder.findMany({
      where, orderBy: { createdAt: "desc" }, take: 200,
    });
    const [lines, customers] = await Promise.all([
      db.customerOrderItem.findMany({
        where: { tenantId: auth.user.tenantId, orderId: { in: orders.map((o) => o.id) } },
      }),
      db.customer.findMany({
        where: { tenantId: auth.user.tenantId, id: { in: orders.map((o) => o.customerId).filter((id): id is string => Boolean(id)) } },
        select: { id: true, nameAr: true, nameEn: true },
      }),
    ]);
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    return serialize({
      items: orders.map((order) => ({
        ...order,
        lines: lines.filter((l) => l.orderId === order.id),
        customer: order.customerId ? customerMap.get(order.customerId) ?? null : null,
      })),
    });
  },
});

const schema = z.object({
  branchId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  productId: z.string().nullable().optional(),
  cakeSize: z.string().optional(),
  weightKg: z.number().min(0).nullable().optional(),
  shape: z.string().optional(),
  flavor: z.string().optional(),
  filling: z.string().optional(),
  decoration: z.string().optional(),
  message: z.string().optional(),
  allergies: z.string().optional(),
  specialNotes: z.string().optional(),
  requestedPickup: z.string().datetime().nullable().optional(),
  requestedDelivery: z.string().datetime().nullable().optional(),
  deliveryAddress: z.string().optional(),
  assignedBakerId: z.string().nullable().optional(),
  lines: z.array(z.object({
    productId: z.string().nullable().optional(),
    name: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
  })).min(1),
});

export const POST = apiRoute({
  permission: "orders.manage",
  schema,
  handler: async (input, auth) => {
    const branchId = input.branchId ?? auth.branchId ?? null;
    assertBranchAccess(auth, branchId);
    const order = await db.$transaction((tx) => createOrder(tx, {
      tenantId: auth.user.tenantId,
      branchId,
      customerId: input.customerId ?? null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      productId: input.productId ?? null,
      cakeSize: input.cakeSize,
      weightKg: input.weightKg ?? null,
      shape: input.shape,
      flavor: input.flavor,
      filling: input.filling,
      decoration: input.decoration,
      message: input.message,
      allergies: input.allergies,
      specialNotes: input.specialNotes,
      requestedPickup: input.requestedPickup ? new Date(input.requestedPickup) : null,
      requestedDelivery: input.requestedDelivery ? new Date(input.requestedDelivery) : null,
      deliveryAddress: input.deliveryAddress,
      assignedBakerId: input.assignedBakerId ?? null,
      createdById: auth.user.id,
      lines: input.lines,
    }));
    return serialize(order);
  },
});
