/** Permission codes are checked ONLY on the server. UI uses them as UX hints. */
export const PERMISSIONS = [
  "dashboard.view",
  "products.view", "products.manage",
  "ingredients.view", "ingredients.manage",
  "recipes.view", "recipes.manage",
  "production.view", "production.manage", "production.complete",
  "inventory.view", "inventory.manage", "inventory.adjust", "warehouses.view", "warehouses.manage",
  "purchases.view", "purchases.manage", "purchases.approve",
  "sales.view", "sales.create", "sales.refund",
  "pos.open", "pos.close",
  "customers.view", "customers.manage",
  "orders.view", "orders.manage",
  "finance.view", "finance.manage", "accounting.view", "accounting.manage",
  "expenses.view", "expenses.manage",
  "hr.view", "hr.manage", "hr.salary",
  "quality.view", "quality.manage",
  "reports.view", "reports.export",
  "settings.view", "settings.manage",
  "users.manage", "notifications.view",
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  OWNER: PERMISSIONS,
  GENERAL_MANAGER: PERMISSIONS.filter((p) => p !== "hr.salary" && p !== "settings.manage"),
  ACCOUNTANT: [
    "dashboard.view", "finance.view", "finance.manage", "accounting.view", "accounting.manage",
    "expenses.view", "expenses.manage", "reports.view", "reports.export", "sales.view",
    "purchases.view", "customers.view", "notifications.view",
  ],
  PRODUCTION_MANAGER: [
    "dashboard.view", "products.view", "ingredients.view", "recipes.view", "recipes.manage",
    "production.view", "production.manage", "production.complete", "inventory.view",
    "quality.view", "quality.manage", "reports.view", "notifications.view",
  ],
  BAKER: [
    "dashboard.view", "products.view", "recipes.view", "production.view", "production.complete",
    "inventory.view", "quality.view", "quality.manage", "notifications.view",
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
    "dashboard.view", "products.view", "ingredients.view", "production.view", "production.manage",
    "inventory.view", "inventory.manage", "sales.view", "orders.view", "orders.manage",
    "quality.view", "hr.view", "reports.view", "notifications.view",
  ],
};
