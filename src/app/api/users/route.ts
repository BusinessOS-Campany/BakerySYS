import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { hashPassword } from "@/lib/auth/password";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

export const GET = apiRoute({
  permission: "users.manage",
  adminOnly: true,
  handler: async (_input, auth) => {
    const [users, userRoles, branches, roles] = await Promise.all([
      db.user.findMany({
        where: { tenantId: auth.user.tenantId },
        select: { id: true, email: true, phone: true, nameAr: true, nameEn: true, locale: true, active: true, mustReset: true, lastLoginAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      db.userRole.findMany({ where: { tenantId: auth.user.tenantId } }),
      db.branch.findMany({ where: { tenantId: auth.user.tenantId }, select: { id: true, nameAr: true, nameEn: true } }),
      db.role.findMany({ where: { tenantId: auth.user.tenantId }, select: { id: true, code: true, nameAr: true, nameEn: true } }),
    ]);
    return serialize({ users, userRoles, branches, roles, permissions: PERMISSIONS });
  },
});

const schema = z.object({
  email: z.email(),
  phone: z.string().optional(),
  nameAr: z.string().min(2),
  nameEn: z.string().min(2),
  password: z.string().min(8),
  locale: z.enum(["ar", "en"]).default("ar"),
  roleIds: z.array(z.string()).default([]),
  branchIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export const POST = apiRoute({
  permission: "users.manage",
  adminOnly: true,
  schema,
  handler: async (input, auth) => {
    const existing = await db.user.findUnique({ where: { email: input.email.toLowerCase() }, select: { id: true } });
    if (existing) throw new AppError("CONFLICT", "Email already in use", "البريد الإلكتروني مستخدم بالفعل");
    if (input.roleIds.length) {
      const count = await db.role.count({
        where: { tenantId: auth.user.tenantId, id: { in: input.roleIds } },
      });
      if (count !== input.roleIds.length) throw new AppError("NOT_FOUND", "Role not found", "الدور غير موجود");
    }
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId: auth.user.tenantId,
          email: input.email.toLowerCase(),
          phone: input.phone ?? null,
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          passwordHash: hashPassword(input.password),
          locale: input.locale,
          active: input.active,
        },
      });
      await tx.userRole.createMany({
        data: input.roleIds.map((roleId) => ({
          tenantId: auth.user.tenantId, userId: created.id, roleId,
        })),
      });
      await tx.userBranchAccess.createMany({
        data: input.branchIds.map((branchId) => ({
          tenantId: auth.user.tenantId, userId: created.id, branchId,
        })),
      });
      return created;
    });
    return serialize({ id: user.id, email: user.email });
  },
});
