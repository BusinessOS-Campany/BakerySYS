"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar, type BranchOption } from "./topbar";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/dictionary";

export function AppShell({
  children,
  locale,
  tenantName,
  userName,
  userEmail,
  permissions,
  isAdmin,
  branches,
  currentBranchId,
  canSeeAllBranches,
  initialUnread,
}: {
  children: React.ReactNode;
  locale: Locale;
  tenantName: string;
  userName: string;
  userEmail: string;
  permissions: string[];
  isAdmin: boolean;
  branches: BranchOption[];
  currentBranchId: string | null;
  canSeeAllBranches: boolean;
  initialUnread: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("bakery_sidebar");
    if (saved === "collapsed") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    setCollapsed((value) => {
      const next = !value;
      try { localStorage.setItem("bakery_sidebar", next ? "collapsed" : "expanded"); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        locale={locale}
        permissions={permissions}
        isAdmin={isAdmin}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapse={toggleCollapse}
        onCloseMobile={() => setMobileOpen(false)}
        tenantName={tenantName}
      />
      <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "lg:ps-[4.5rem]" : "lg:ps-64")}>
        <Topbar
          locale={locale}
          userName={userName}
          userEmail={userEmail}
          branches={branches}
          currentBranchId={currentBranchId}
          canSeeAllBranches={canSeeAllBranches}
          initialUnread={initialUnread}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="animate-in p-3 md:p-5">{children}</main>
      </div>
    </div>
  );
}
