import { redirect } from "next/navigation";
import { requireAuth, type AuthContext } from "@/lib/auth/session";

/** Server-side page gate. Owners bypass the permission catalogue. */
export async function requireWorkflow(permissions: string[]): Promise<AuthContext> {
  const auth = await requireAuth();
  const allowed = auth.roles.includes("OWNER") || permissions.some((permission) => auth.permissions.has(permission));
  if (!allowed) redirect("/");
  return auth;
}

export function canAny(auth: AuthContext, permissions: string[]): boolean {
  return auth.roles.includes("OWNER") || permissions.some((permission) => auth.permissions.has(permission));
}
