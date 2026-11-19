import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { hashPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  locale: z.enum(["ar", "en"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
  roleIds: z.array(z.string()).optional(),
  branchIds: z.array(z.string()).optional(),
});

export const PATCH = apiRoute({
  permission: "users.manage",
  schema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    const user = await db.user.findFirst({
      where: { id, tenantId: auth.user.tenantId },
      select: { id: true },
    });
    if (!user) throw new AppError("NOT_FOUND", "User not found", "المستخدم غير موجود");
    if (id === auth.user.id && input.active === false) {
      throw new AppError("VALIDATION", "You cannot deactivate your own account", "لا يمكنك تعطيل حسابك");
    }
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: {
          ...(input.nameAr ? { nameAr: input.nameAr } : {}),
          ...(input.nameEn ? { nameEn: input.nameEn } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.locale ? { locale: input.locale } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.password ? { passwordHash: hashPassword(input.password), mustReset: true } : {}),
        },
        select: { id: true, email: true, nameAr: true, nameEn: true, active: true },
      });
      if (input.roleIds) {
        await tx.userRole.deleteMany({ where: { tenantId: auth.user.tenantId, userId: id } });
        if (input.roleIds.length) {
          await tx.userRole.createMany({
            data: input.roleIds.map((roleId) => ({ tenantId: auth.user.tenantId, userId: id, roleId })),
          });
        }
      }
      if (input.branchIds) {
        await tx.userBranchAccess.deleteMany({ where: { tenantId: auth.user.tenantId, userId: id } });
        if (input.branchIds.length) {
          await tx.userBranchAccess.createMany({
            data: input.branchIds.map((branchId) => ({ tenantId: auth.user.tenantId, userId: id, branchId })),
          });
        }
      }
      return result;
    });
    return serialize(updated);
  },
});
