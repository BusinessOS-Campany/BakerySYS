import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions/catalog";

export const SESSION_COOKIE = "bakery_session";
export const BRANCH_COOKIE = "bakery_branch";
export const LOCALE_COOKIE = "bakery_locale";
const SESSION_DAYS = 30;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type AuthUser = {
  id: string;
  tenantId: string;
  email: string;
  nameAr: string;
  nameEn: string;
  locale: string;
  avatarUrl: string | null;
};

export type AuthContext = {
  user: AuthUser;
  tenant: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string;
    currencyCode: string;
    decimalPlaces: number;
    locale: string;
    timezone: string;
    taxEnabled: boolean;
    taxRate: number;
    invoicePrefix: string;
    logoUrl: string | null;
  };
  roles: string[];
  permissions: Set<string>;
  branchIds: string[];
  branchId: string | null;
  locale: "ar" | "en";
};

export async function createSession(input: {
  userId: string;
  tenantId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
      ipAddress: input.ip?.slice(0, 100) ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
  store.delete(BRANCH_COOKIE);
}

/** Returns the authenticated context, or null. Never trusts client-supplied role/tenant data. */
export async function getAuth(): Promise<AuthContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { tenantId: true, userId: true, expiresAt: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const user = await db.user.findFirst({
    where: { id: session.userId, tenantId: session.tenantId, active: true },
    select: {
      id: true, tenantId: true, email: true, nameAr: true, nameEn: true,
      locale: true, avatarUrl: true,
    },
  });
  if (!user) return null;
  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant || !tenant.active) return null;

  const [rolesRaw, branchAccess] = await Promise.all([
    db.userRole.findMany({
      where: { userId: user.id, tenantId: user.tenantId },
      select: { roleId: true, branchId: true },
    }),
    db.userBranchAccess.findMany({
      where: { userId: user.id, tenantId: user.tenantId },
      select: { branchId: true },
    }),
  ]);

  const roleIds = [...new Set(rolesRaw.map((r) => r.roleId))];
  const perms = roleIds.length
    ? await db.rolePermission.findMany({
        where: { tenantId: user.tenantId, roleId: { in: roleIds } },
        select: { permission: true },
      })
    : [];

  const roleRows = roleIds.length
    ? await db.role.findMany({
        where: { id: { in: roleIds }, tenantId: user.tenantId },
        select: { code: true },
      })
    : [];
  const roles = roleRows.map((r) => r.code);

  const permissions = new Set<string>(perms.map((p) => p.permission));
  for (const code of roles) {
    for (const p of DEFAULT_ROLE_PERMISSIONS[code] ?? []) permissions.add(p);
  }

  const branchIds = [
    ...new Set([
      ...branchAccess.map((b) => b.branchId),
      ...rolesRaw.map((r) => r.branchId).filter((b): b is string => Boolean(b)),
    ]),
  ];
  const requestedBranch = store.get(BRANCH_COOKIE)?.value;
  const branchId = branchIds.length === 0
    ? null
    : requestedBranch && branchIds.includes(requestedBranch)
      ? requestedBranch
      : branchIds[0];

  const localeCookie = store.get(LOCALE_COOKIE)?.value;
  const locale = localeCookie === "en" || localeCookie === "ar"
    ? localeCookie
    : user.locale === "en" ? "en" : "ar";

  return {
    user: {
      id: user.id, tenantId: user.tenantId, email: user.email,
      nameAr: user.nameAr, nameEn: user.nameEn, locale: user.locale, avatarUrl: user.avatarUrl,
    },
    tenant: {
      id: tenant.id, slug: tenant.slug, nameAr: tenant.nameAr, nameEn: tenant.nameEn,
      currencyCode: tenant.currencyCode, decimalPlaces: tenant.decimalPlaces,
      locale: tenant.locale, timezone: tenant.timezone, taxEnabled: tenant.taxEnabled,
      taxRate: Number(tenant.taxRate), invoicePrefix: tenant.invoicePrefix, logoUrl: tenant.logoUrl,
    },
    roles,
    permissions,
    branchIds,
    branchId,
    locale,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new AppError("UNAUTHENTICATED", "Sign in required", "ظٹط¬ط¨ طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„");
  return auth;
}

export async function requirePermission(code: string): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!auth.permissions.has(code) && !auth.roles.includes("OWNER")) {
    throw new AppError("FORBIDDEN", `Missing permission: ${code}`, "ظ„ظٹط³ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط© ظ„طھظ†ظپظٹط° ظ‡ط°ط§ ط§ظ„ط¥ط¬ط±ط§ط،");
  }
  return auth;
}

/** Branch-scoped authorization: an empty allowed list means the user sees all branches. */
export function assertBranchAccess(auth: AuthContext, branchId: string | null | undefined): void {
  if (!branchId || auth.branchIds.length === 0) return;
  if (!auth.branchIds.includes(branchId)) {
    throw new AppError("FORBIDDEN", "Branch access denied", "ظ„ظٹط³ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط© ظ„ظ‡ط°ط§ ط§ظ„ظپط±ط¹");
  }
}
