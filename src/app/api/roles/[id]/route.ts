import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  permissionCodes: z.array(z.enum(PERMISSIONS)).optional(),
});

export const PATCH = apiRoute({
  permission: "users.manage",
  schema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const role = await db.role.findFirst({ where: { id, tenantId: auth.user.tenantId } });
    if (!role) throw new AppError("NOT_FOUND", "Role not found", "الدور غير موجود");
    if (role.code === "OWNER") throw new AppError("FORBIDDEN", "Owner role cannot be edited", "لا يمكن تعديل دور المالك");
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.role.update({
        where: { id },
        data: {
          ...(input.nameAr ? { nameAr: input.nameAr } : {}),
          ...(input.nameEn ? { nameEn: input.nameEn } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });
      if (input.permissionCodes) {
        await tx.rolePermission.deleteMany({ where: { tenantId: auth.user.tenantId, roleId: id } });
        if (input.permissionCodes.length) {
          await tx.rolePermission.createMany({
            data: input.permissionCodes.map((permission) => ({ tenantId: auth.user.tenantId, roleId: id, permission })),
          });
        }
      }
      return result;
    });
    return serialize(updated);
  },
});
