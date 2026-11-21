"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { translate, type Locale } from "@/lib/i18n/dictionary";
import { useGlobalSearch } from "./use-global-search";

export function GlobalSearchPage({ locale, initialQuery = "" }: { locale: Locale; initialQuery?: string }) {
  const t = (key: string) => translate(locale, key);
  const { query, setQuery, payload, loading } = useGlobalSearch(locale, initialQuery);
  const trimmed = query.trim();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("globalSearch.title")}</h1>
        <p className="muted mt-1 text-sm">{t("globalSearch.subtitle")}</p>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[var(--text-muted)]" />
        <input
          aria-label={t("globalSearch.placeholder")}
          autoFocus
          className="input h-11 w-full ps-10 pe-10"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("globalSearch.placeholder")}
          value={query}
        />
        {query ? (
          <button
            aria-label={t("action.clear")}
            className="absolute inset-y-0 end-2 my-auto rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
            onClick={() => setQuery("")}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {trimmed.length < 2 ? (
        <p className="muted rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm">
          {t("globalSearch.minChars")}
        </p>
      ) : loading ? (
        <p className="muted rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm">...</p>
      ) : payload.groups.length === 0 ? (
        <p className="muted rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm">
          {t("globalSearch.empty")}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {payload.groups.map((group) => (
            <section key={group.groupKey} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <h2 className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold">
                {t(group.groupKey)}
              </h2>
              <div className="divide-y divide-[var(--border)]">
                {group.results.map((result) => (
                  <Link
                    key={`${group.groupKey}:${result.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-[var(--surface-muted)]"
                    href={result.href}
                  >
                    <span className="min-w-0 truncate font-medium">{result.label}</span>
                    {result.subtitle ? <span className="muted min-w-0 truncate text-xs">{result.subtitle}</span> : null}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
