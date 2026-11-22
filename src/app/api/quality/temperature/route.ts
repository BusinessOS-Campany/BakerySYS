import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  location: z.string().min(1),
  equipment: z.string().optional(),
  temperature: z.number(),
  minAllowed: z.number().optional(),
  maxAllowed: z.number().optional(),
  recordedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const POST = apiRoute({
  permission: "quality.manage",
  schema,
  handler: async (input, auth) => {
    const belowMin = input.minAllowed != null && input.temperature < input.minAllowed;
    const aboveMax = input.maxAllowed != null && input.temperature > input.maxAllowed;
    const log = await db.temperatureLog.create({
      data: {
        tenantId: auth.user.tenantId,
        location: input.location,
        equipment: input.equipment || null,
        temperature: input.temperature,
        minAllowed: input.minAllowed ?? null,
        maxAllowed: input.maxAllowed ?? null,
        ok: !belowMin && !aboveMax,
        recordedBy: auth.user.id,
        recordedAt: input.recordedAt ? new Date(input.recordedAt) : undefined,
        notes: input.notes || null,
      },
    });
    return serialize(log);
  },
});
