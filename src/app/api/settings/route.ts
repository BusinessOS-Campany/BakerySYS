import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "settings.view",
  handler: async (_input, auth) => {
    const [tenant, settings, branches] = await Promise.all([
      db.tenant.findUnique({
        where: { id: auth.user.tenantId },
        select: {
          id: true, slug: true, nameAr: true, nameEn: true, currencyCode: true,
          decimalPlaces: true, locale: true, timezone: true, taxEnabled: true,
          taxRate: true, invoicePrefix: true, logoUrl: true, active: true,
        },
      }),
      db.systemSetting.findMany({ where: { tenantId: auth.user.tenantId }, orderBy: { key: "asc" } }),
      db.branch.findMany({
        where: { tenantId: auth.user.tenantId },
        select: { id: true, code: true, nameAr: true, nameEn: true, active: true },
      }),
    ]);
    return serialize({ tenant, settings, branches });
  },
});

const schema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().min(2).optional(),
  currencyCode: z.string().min(3).max(3).optional(),
  decimalPlaces: z.number().int().min(0).max(4).optional(),
  locale: z.enum(["ar", "en"]).optional(),
  timezone: z.string().min(2).optional(),
  taxEnabled: z.boolean().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  invoicePrefix: z.string().min(2).max(10).optional(),
});

export const PATCH = apiRoute({
  permission: "settings.manage",
  schema,
  handler: async (input, auth) => {
    const tenant = await db.tenant.update({
      where: { id: auth.user.tenantId },
      data: input,
      select: {
        id: true, slug: true, nameAr: true, nameEn: true, currencyCode: true,
        decimalPlaces: true, locale: true, timezone: true, taxEnabled: true,
        taxRate: true, invoicePrefix: true,
      },
    });
    return serialize(tenant);
  },
});
