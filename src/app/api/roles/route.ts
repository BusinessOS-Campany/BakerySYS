import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { ASSIGNABLE_PERMISSIONS, PERMISSIONS, isAssignablePermission } from "@/lib/permissions/catalog";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "users.manage",
  adminOnly: true,
  handler: async (_input, auth) => {
    const [roles, permissions] = await Promise.all([
      db.role.findMany({ where: { tenantId: auth.user.tenantId }, orderBy: { createdAt: "asc" } }),
      db.rolePermission.findMany({ where: { tenantId: auth.user.tenantId } }),
    ]);
    return serialize({
      items: roles.map((role) => ({
        ...role,
        permissionCodes: permissions.filter((p) => p.roleId === role.id).map((p) => p.permission),
      })),
      availablePermissions: ASSIGNABLE_PERMISSIONS,
    });
  },
});

const schema = z.object({
  code: z.string().min(2).regex(/^[A-Z_]+$/),
  nameAr: z.string().min(2),
  nameEn: z.string().min(2),
  description: z.string().optional(),
  permissionCodes: z.array(z.enum(PERMISSIONS)).default([]),
});

export const POST = apiRoute({
  permission: "users.manage",
  adminOnly: true,
  schema,
  handler: async (input, auth) => {
    const existing = await db.role.findFirst({ where: { tenantId: auth.user.tenantId, code: input.code } });
    if (existing) throw new AppError("CONFLICT", "Role already exists", "الدور موجود بالفعل");
    const permissionCodes = input.permissionCodes.filter(isAssignablePermission);
    const role = await db.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          tenantId: auth.user.tenantId,
          code: input.code,
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          description: input.description ?? null,
          isSystem: false,
        },
      });
      await tx.rolePermission.createMany({
        data: permissionCodes.map((permission) => ({
          tenantId: auth.user.tenantId, roleId: created.id, permission,
        })),
      });
      return created;
    });
    return serialize(role);
  },
});
