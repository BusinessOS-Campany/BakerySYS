export type NavItem = {
  href: string;
  labelKey: string;
  icon: string;
  permission: string;
  adminOnly?: boolean;
};

export type NavSection = {
  titleKey: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: "shell.section.overview",
    items: [{ href: "/", labelKey: "nav.dashboard", icon: "LayoutDashboard", permission: "dashboard.view" }],
  },
  {
    titleKey: "shell.section.sales",
    items: [
      { href: "/pos", labelKey: "nav.pos", icon: "ShoppingCart", permission: "sales.create" },
      { href: "/meals", labelKey: "nav.meals", icon: "UtensilsCrossed", permission: "sales.view" },
      { href: "/customers", labelKey: "nav.customers", icon: "UsersRound", permission: "customers.view" },
      { href: "/arap", labelKey: "nav.arap", icon: "Wallet", permission: "customers.view" },
    ],
  },
  {
    titleKey: "shell.section.operations",
    items: [
      { href: "/products", labelKey: "nav.products", icon: "Croissant", permission: "products.view" },
      { href: "/categories", labelKey: "nav.categories", icon: "Tags", permission: "products.view" },
      { href: "/inventory", labelKey: "nav.inventory", icon: "Boxes", permission: "inventory.view" },
      { href: "/inventory/exit", labelKey: "nav.stockExit", icon: "LogOut", permission: "inventory.view" },
      { href: "/stock-products", labelKey: "nav.stockProducts", icon: "PackagePlus", permission: "ingredients.view" },
      { href: "/warehouses", labelKey: "nav.warehouses", icon: "Warehouse", permission: "warehouses.view" },
    ],
  },
  {
    titleKey: "shell.section.finance",
    items: [
      { href: "/expenses", labelKey: "nav.expenses", icon: "Wallet", permission: "expenses.view" },
      { href: "/reports", labelKey: "nav.reports", icon: "BarChart3", permission: "reports.view" },
    ],
  },
  {
    titleKey: "shell.section.admin",
    items: [
      { href: "/employees", labelKey: "nav.employees", icon: "UsersRound", permission: "hr.view" },
      { href: "/users", labelKey: "nav.users", icon: "UserCog", permission: "users.manage", adminOnly: true },
      { href: "/settings", labelKey: "nav.settings", icon: "Settings", permission: "settings.view" },
    ],
  },
];

export function findNavItem(pathname: string): NavItem | null {
  const exact = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === pathname);
  if (exact) return exact;
  const match = NAV_SECTIONS.flatMap((s) => s.items)
    .filter((i) => i.href !== "/")
    .find((i) => pathname.startsWith(`${i.href}/`));
  return match ?? null;
}
