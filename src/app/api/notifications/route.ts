import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { apiRoute } from "@/lib/http";

export const GET = apiRoute({
  permission: "notifications.view",
  handler: async (_input, auth, req) => {
    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit") ?? 20), 1), 50);
    const where = {
      tenantId: auth.user.tenantId,
      OR: [{ userId: auth.user.id }, { userId: null }],
    };
    const [items, unread] = await Promise.all([
      db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
      db.notification.count({ where: { ...where, read: false } }),
    ]);
    return {
      items: items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
      unread,
    };
  },
});

const markSchema = z.object({ ids: z.array(z.string()).optional() });

export const PATCH = apiRoute({
  permission: "notifications.view",
  schema: markSchema,
  handler: async (input, auth) => {
    const where = {
      tenantId: auth.user.tenantId,
      OR: [{ userId: auth.user.id }, { userId: null }],
      read: false,
      ...(input.ids && input.ids.length > 0 ? { id: { in: input.ids } } : {}),
    };
    await db.notification.updateMany({ where, data: { read: true } });
    return { ok: true };
  },
});
