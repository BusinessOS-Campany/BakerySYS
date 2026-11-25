/** Permission codes are checked ONLY on the server. UI uses them as UX hints. */
export const PERMISSIONS = [
  "dashboard.view",
  "products.view", "products.manage",
  "ingredients.view", "ingredients.manage",
  "recipes.view", "recipes.manage",
  "inventory.view", "inventory.manage", "inventory.adjust", "warehouses.view", "warehouses.manage",
  "purchases.view", "purchases.manage", "purchases.approve",
  "sales.view", "sales.create", "sales.refund",
  "pos.open", "pos.close",
  "customers.view", "customers.manage",
  "orders.view", "orders.manage",
  "finance.view", "finance.manage", "accounting.view", "accounting.manage",
  "expenses.view", "expenses.manage",
  "hr.view", "hr.manage", "hr.salary",
  "reports.view", "reports.export",
  "settings.view", "settings.manage",
  "users.manage", "notifications.view",
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

/** Only the tenant OWNER/admin account can manage users and permissions. */
export const ADMIN_ONLY_PERMISSIONS = ["users.manage"] as const;
type AdminOnlyPermission = (typeof ADMIN_ONLY_PERMISSIONS)[number];

/** Permissions that can be assigned to non-owner roles. */
export const ASSIGNABLE_PERMISSIONS = PERMISSIONS.filter(
  (permission): permission is Exclude<PermissionCode, AdminOnlyPermission> =>
    !(ADMIN_ONLY_PERMISSIONS as readonly string[]).includes(permission),
);

export function isAssignablePermission(code: string): boolean {
  return (ASSIGNABLE_PERMISSIONS as readonly string[]).includes(code);
}

export const DEFAULT_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  OWNER: PERMISSIONS,
  GENERAL_MANAGER: PERMISSIONS.filter((p) => p !== "hr.salary" && p !== "settings.manage" && p !== "users.manage"),
  ACCOUNTANT: [
    "dashboard.view", "finance.view", "finance.manage", "accounting.view", "accounting.manage",
    "expenses.view", "expenses.manage", "reports.view", "reports.export", "sales.view",
    "purchases.view", "customers.view", "notifications.view",
  ],
  BAKER: [
    "dashboard.view", "products.view", "recipes.view",
    "inventory.view", "notifications.view",
  ],
  CASHIER: [
    "dashboard.view", "products.view", "sales.view", "sales.create", "pos.open", "pos.close",
    "customers.view", "inventory.view", "notifications.view",
  ],
  STOREKEEPER: [
    "dashboard.view", "products.view", "ingredients.view", "ingredients.manage", "inventory.view",
    "inventory.manage", "inventory.adjust", "purchases.view", "purchases.manage",
    "warehouses.view", "notifications.view",
  ],
  SALES_EMPLOYEE: [
    "dashboard.view", "products.view", "sales.view", "sales.create", "customers.view",
    "customers.manage", "orders.view", "orders.manage", "notifications.view",
  ],
  SUPERVISOR: [
    "dashboard.view", "products.view", "ingredients.view",
    "inventory.view", "inventory.manage", "sales.view", "orders.view", "orders.manage",
    "hr.view", "reports.view", "notifications.view",
  ],
};
