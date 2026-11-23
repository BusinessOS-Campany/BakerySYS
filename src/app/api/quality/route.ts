import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { assertBranchAccess } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "quality.view",
  handler: async (_input, auth) => {
    const inspections = await db.qualityInspection.findMany({
      where: { tenantId: auth.user.tenantId },
      orderBy: { checkedAt: "desc" },
      take: 100,
    });
    const temperatureLogs = await db.temperatureLog.findMany({
      where: { tenantId: auth.user.tenantId },
      orderBy: { recordedAt: "desc" },
      take: 50,
    });
    return serialize({ inspections, temperatureLogs });
  },
});

const schema = z.object({
  referenceType: z.enum(["RECEIPT", "PRODUCT"]),
  referenceId: z.string().optional().nullable(),
  checkType: z.string().min(2),
  standard: z.string().optional(),
  actualResult: z.string().optional(),
  expectedValue: z.string().optional(),
  result: z.enum(["PASS", "FAIL", "PENDING"]).default("PASS"),
  temperature: z.number().optional(),
  employeeId: z.string().optional().nullable(),
  notes: z.string().optional(),
  correctiveAction: z.string().optional(),
});

export const POST = apiRoute({
  permission: "quality.manage",
  schema,
  handler: async (input, auth) => {
    assertBranchAccess(auth, null);
    const inspection = await db.qualityInspection.create({
      data: {
        tenantId: auth.user.tenantId,
        referenceType: input.referenceType,
        referenceId: input.referenceId ?? null,
        checkType: input.checkType,
        standard: input.standard ?? null,
        actualResult: input.actualResult ?? null,
        expectedValue: input.expectedValue ?? null,
        result: input.result,
        temperature: input.temperature ?? null,
        employeeId: input.employeeId ?? null,
        notes: input.notes ?? null,
        correctiveAction: input.correctiveAction ?? null,
      },
    });
    return serialize(inspection);
  },
});
