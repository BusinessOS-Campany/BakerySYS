"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell, ChevronDown, CircleUserRound, Globe2, LogOut, Menu, Moon, Sun,
} from "lucide-react";
import { findNavItem } from "./nav";
import { cn } from "@/lib/utils";
import { formatDate, translate, type Locale } from "@/lib/i18n/dictionary";

export type BranchOption = { id: string; nameAr: string; nameEn: string };
export type NotificationItem = {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string | null;
  bodyEn: string | null;
  kind: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function Topbar({
  locale,
  userName,
  userEmail,
  branches,
  currentBranchId,
  canSeeAllBranches,
  initialUnread,
  onOpenMobile,
}: {
  locale: Locale;
  userName: string;
  userEmail: string;
  branches: BranchOption[];
  currentBranchId: string | null;
  canSeeAllBranches: boolean;
  initialUnread: number;
  onOpenMobile: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = (key: string) => translate(locale, key);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const [openPanel, setOpenPanel] = useState<"notifications" | "user" | null>(null);
  const [updating, setUpdating] = useState(false);
  const currentNav = findNavItem(pathname);

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as "light" | "dark") ?? "light");
  }, []);

  async function loadNotifications() {
    try {
      const response = await fetch("/api/notifications?limit=8", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      setNotifications(payload.items ?? []);
      setUnread(Number(payload.unread ?? 0));
    } catch {
      // Notification center is non-critical; keep the last known state.
    }
  }

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(loadNotifications, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("bakery_theme", next); } catch { /* ignore */ }
  }

  async function setPreference(patch: { branchId?: string | null; locale?: Locale }) {
    setUpdating(true);
    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      router.refresh();
    } finally {
      setUpdating(false);
    }
  }

  async function markRead(id?: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: id ? [id] : undefined }),
    });
    await loadNotifications();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 md:px-5">
      <button
        aria-label={t("shell.toggleSidebar")}
        className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] lg:hidden"
        onClick={onOpenMobile}
        type="button"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{currentNav ? t(currentNav.labelKey) : t("app.name")}</div>
        <div className="muted hidden truncate text-xs md:block">
          {t("app.name")} / {currentNav ? t(currentNav.labelKey) : pathname}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {(canSeeAllBranches || branches.length > 1) ? (
          <select
            aria-label={t("common.branch")}
            className="input h-9 w-auto max-w-[9rem] text-xs"
            disabled={updating}
            value={currentBranchId ?? ""}
            onChange={(e) => void setPreference({ branchId: e.target.value || null })}
          >
            {canSeeAllBranches ? <option value="">{t("shell.allBranches")}</option> : null}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{locale === "ar" ? branch.nameAr : branch.nameEn}</option>
            ))}
          </select>
        ) : null}

        <button
          aria-label={t("shell.language")}
          className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
          disabled={updating}
          onClick={() => void setPreference({ locale: locale === "ar" ? "en" : "ar" })}
          title={t("shell.language")}
          type="button"
        >
          <Globe2 className="h-4 w-4" /> {locale.toUpperCase()}
        </button>

        <button
          aria-label={t("shell.theme")}
          className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
          onClick={toggleTheme}
          title={t("shell.theme")}
          type="button"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="relative">
          <button
            aria-label={t("nav.notifications")}
            className="relative rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
            onClick={() => { setOpenPanel(openPanel === "notifications" ? null : "notifications"); void loadNotifications(); }}
            type="button"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </button>
          {openPanel === "notifications" ? (
            <div className="absolute end-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <strong className="text-sm">{t("nav.notifications")}</strong>
                {unread > 0 ? (
                  <button className="text-xs text-[var(--primary)] hover:underline" onClick={() => void markRead()} type="button">
                    {t("shell.markAllRead")}
                  </button>
                ) : null}
              </div>
              <div className="scroll-thin max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="muted p-6 text-center text-sm">{t("shell.noNotifications")}</p>
                ) : notifications.map((item) => (
                  <div
                    key={item.id}
                    className={cn("border-b border-[var(--border)] px-4 py-3", !item.read && "bg-[var(--surface-muted)]")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{locale === "ar" ? item.titleAr : item.titleEn}</div>
                      {!item.read ? (
                        <button
                          className="shrink-0 text-xs text-[var(--primary)]"
                          onClick={() => void markRead(item.id)}
                          type="button"
                        >{locale === "ar" ? "تعليم كمقروء" : "Mark read"}</button>
                      ) : null}
                    </div>
                    {(locale === "ar" ? item.bodyAr : item.bodyEn) ? (
                      <p className="muted mt-1 text-xs">{(locale === "ar" ? item.bodyAr : item.bodyEn) ?? ""}</p>
                    ) : null}
                    <div className="muted mt-1 flex items-center justify-between text-[11px]">
                      <span>{formatDate(item.createdAt, locale, true)}</span>
                      {item.link ? (
                        <Link className="text-[var(--primary)] hover:underline" href={item.link} onClick={() => setOpenPanel(null)}>
                          {t("action.view")}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-[var(--surface-muted)]"
            onClick={() => setOpenPanel(openPanel === "user" ? null : "user")}
            type="button"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--primary)]">
              <CircleUserRound className="h-5 w-5" />
            </span>
            <span className="hidden text-start md:block">
              <span className="block max-w-[8rem] truncate text-xs font-semibold">{userName}</span>
              <span className="muted block max-w-[8rem] truncate text-[10px]">{userEmail}</span>
            </span>
            <ChevronDown className="hidden h-3 w-3 text-[var(--text-muted)] md:block" />
          </button>
          {openPanel === "user" ? (
            <div className="absolute end-0 top-11 z-50 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl">
              <div className="border-b border-[var(--border)] px-3 py-2">
                <div className="truncate text-sm font-semibold">{userName}</div>
                <div className="muted truncate text-xs">{userEmail}</div>
              </div>
              <Link
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                href="/settings"
                onClick={() => setOpenPanel(null)}
              >
                <CircleUserRound className="h-4 w-4" /> {t("shell.profile")}
              </Link>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-[var(--danger)] hover:bg-[var(--surface-muted)]"
                onClick={() => void logout()}
                type="button"
              >
                <LogOut className="h-4 w-4" /> {t("action.logout")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
