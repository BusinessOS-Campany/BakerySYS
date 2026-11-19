import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  key: z.string().min(2).max(80).regex(/^[A-Z0-9_.]+$/),
  value: z.unknown(),
});

export const PUT = apiRoute({
  permission: "settings.manage",
  schema,
  handler: async (input, auth) => {
    const setting = await db.systemSetting.upsert({
      where: { tenantId_key: { tenantId: auth.user.tenantId, key: input.key } },
      create: { tenantId: auth.user.tenantId, key: input.key, value: input.value as never },
      update: { value: input.value as never },
    });
    return serialize(setting);
  },
});
