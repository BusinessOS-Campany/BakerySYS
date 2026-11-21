"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Boxes, CakeSlice, ClipboardList, Croissant, Factory, Landmark,
  LayoutDashboard, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings,
  ShieldCheck, ShoppingCart, Tags, Truck, UserCog, UsersRound, Wallet,
  Warehouse, X, type LucideIcon,
} from "lucide-react";
import { NAV_SECTIONS } from "./nav";
import { cn } from "@/lib/utils";
import { translate, type Locale } from "@/lib/i18n/dictionary";

const ICONS: Record<string, LucideIcon> = {
  BarChart3, Boxes, CakeSlice, ClipboardList, Croissant, Factory, Landmark,
  LayoutDashboard, ReceiptText, Settings, ShieldCheck, ShoppingCart, Tags,
  Truck, UserCog, UsersRound, Wallet, Warehouse,
};

export function Sidebar({
  locale,
  permissions,
  collapsed,
  mobileOpen,
  onCollapse,
  onCloseMobile,
  tenantName,
}: {
  locale: Locale;
  permissions: string[];
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: () => void;
  onCloseMobile: () => void;
  tenantName: string;
}) {
  const pathname = usePathname();
  const t = (key: string) => translate(locale, key);
  const can = (permission: string) => permissions.includes(permission) || permissions.includes("*");

  const side = locale === "ar" ? "right-0" : "left-0";
  const hiddenTransform = locale === "ar" ? "translate-x-full" : "-translate-x-full";

  return (
    <>
      {mobileOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 z-40 flex flex-col bg-[var(--sidebar)] text-[var(--sidebar-text)] transition-[width,transform] duration-200",
          side,
          collapsed ? "w-[4.5rem]" : "w-64",
          mobileOpen ? "translate-x-0" : hiddenTransform,
          "lg:translate-x-0",
        )}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
            <Croissant className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{t("app.name")}</div>
              <div className="truncate text-[11px] text-white/50">{tenantName}</div>
            </div>
          ) : null}
          <button
            aria-label={t("shell.toggleSidebar")}
            className="hidden rounded p-1 text-white/70 hover:bg-white/10 lg:block"
            onClick={onCollapse}
            type="button"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4 rtl:rotate-180" /> : <PanelLeftClose className="h-4 w-4 rtl:rotate-180" />}
          </button>
          <button
            aria-label="Close navigation"
            className="rounded p-1 text-white/70 hover:bg-white/10 lg:hidden"
            onClick={onCloseMobile}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="scroll-thin flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => can(item.permission));
            if (items.length === 0) return null;
            return (
              <div key={section.titleKey}>
                {!collapsed ? (
                  <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {t(section.titleKey)}
                  </div>
                ) : null}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = ICONS[item.icon] ?? LayoutDashboard;
                    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? t(item.labelKey) : undefined}
                        onClick={onCloseMobile}
                        className={cn("sidebar-link", active && "active", collapsed && "justify-center")}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed ? <span className="truncate">{t(item.labelKey)}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3 text-[10px] text-white/40">
          {collapsed ? "v1.0" : "Bakery ERP · v1.0"}
        </div>
      </aside>
    </>
  );
}
