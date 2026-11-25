import { redirect } from "next/navigation";
import { isAdmin, requireAuth, type AuthContext } from "@/lib/auth/session";

/** Server-side page gate. Owners bypass the permission catalogue. */
export async function requireWorkflow(permissions: string[]): Promise<AuthContext> {
  const auth = await requireAuth();
  const allowed = isAdmin(auth) || permissions.some((permission) => auth.permissions.has(permission));
  if (!allowed) redirect("/");
  return auth;
}

/** Owner/admin-only page gate. */
export async function requireAdmin(): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!isAdmin(auth)) redirect("/");
  return auth;
}

export function canAny(auth: AuthContext, permissions: string[]): boolean {
  return isAdmin(auth) || permissions.some((permission) => auth.permissions.has(permission));
}
