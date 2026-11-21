/** Local development shortcut login. Kept separate from real user emails. */
export const ADMIN_USERNAME = "admin";
export const ADMIN_EMAIL = "admin@bakery.local";
export const ADMIN_PASSWORD = "admin";

/** Maps the shortcut username to the stored user email; other values pass through. */
export function normalizeLoginIdentifier(identifier: string): string {
  return identifier === ADMIN_USERNAME ? ADMIN_EMAIL : identifier;
}
