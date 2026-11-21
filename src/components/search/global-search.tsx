"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { translate, type Locale } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import { useGlobalSearch } from "./use-global-search";

type FlatResult = {
  id: string;
  label: string;
  subtitle: string;
  href: string;
  groupKey: string;
};

export function GlobalSearch({ locale }: { locale: Locale }) {
  const t = (key: string) => translate(locale, key);
  const { query, setQuery, payload, loading } = useGlobalSearch(locale);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapper = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const flat = useMemo<FlatResult[]>(
    () => payload.groups.flatMap((group) => group.results.map((result) => ({ ...result, groupKey: group.groupKey }))),
    [payload],
  );
  const indexByResult = useMemo(
    () => new Map(flat.map((result, index) => [`${result.groupKey}:${result.id}`, index])),
    [flat],
  );

  useEffect(() => { setActive(-1); }, [payload]);
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const goToAll = () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.min(current + 1, flat.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, -1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const chosen = active >= 0 ? flat[active] : undefined;
      if (chosen) {
        router.push(chosen.href);
        setOpen(false);
        return;
      }
      goToAll();
    }
  };

  const trimmed = query.trim();

  return (
    <div ref={wrapper} className="relative w-32 sm:w-48 lg:w-64">
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[var(--text-muted)]" />
      <input
        aria-label={t("globalSearch.placeholder")}
        className="input h-9 w-full ps-9 pe-8 text-xs"
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t("globalSearch.placeholder")}
        value={query}
      />
      {query ? (
        <button
          aria-label={t("action.clear")}
          className="absolute inset-y-0 end-2 my-auto rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
          onClick={() => { setQuery(""); setActive(-1); setOpen(false); }}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {open ? (
        <div className="absolute end-0 top-11 z-50 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold">{t("globalSearch.results")}</div>
          <div className="scroll-thin max-h-[min(26rem,60vh)] overflow-y-auto">
            {trimmed.length < 2 ? (
              <p className="muted p-5 text-center text-xs">{t("globalSearch.minChars")}</p>
            ) : loading ? (
              <p className="muted p-5 text-center text-xs">...</p>
            ) : flat.length === 0 ? (
              <p className="muted p-5 text-center text-xs">{t("globalSearch.empty")}</p>
            ) : (
              payload.groups.map((group) => (
                <div key={group.groupKey} className="border-b border-[var(--border)] last:border-b-0">
                  <div className="muted bg-[var(--surface-muted)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide">
                    {t(group.groupKey)}
                  </div>
                  {group.results.map((result) => {
                    const index = indexByResult.get(`${group.groupKey}:${result.id}`) ?? -1;
                    return (
                      <Link
                        key={`${group.groupKey}:${result.id}`}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-[var(--surface-muted)]",
                          active === index && "bg-[var(--surface-muted)]",
                        )}
                        href={result.href}
                        onClick={() => setOpen(false)}
                      >
                        <span className="min-w-0 truncate font-medium">{result.label}</span>
                        {result.subtitle ? <span className="muted min-w-0 truncate text-xs">{result.subtitle}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          {trimmed.length >= 2 ? (
            <button
              className="w-full border-t border-[var(--border)] px-3 py-2 text-start text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-muted)]"
              onClick={goToAll}
              type="button"
            >
              {t("globalSearch.viewAll")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
