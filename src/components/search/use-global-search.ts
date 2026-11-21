"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/components/workflows/shared";
import type { Locale } from "@/lib/i18n/dictionary";
import type { SearchPayload } from "@/lib/search/types";

export function useGlobalSearch(locale: Locale, initialQuery = "") {
  const [query, setQuery] = useState(initialQuery);
  const [payload, setPayload] = useState<SearchPayload>({ query: initialQuery, groups: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setPayload({ query: trimmed, groups: [] });
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      apiFetch<SearchPayload>(`/api/search?q=${encodeURIComponent(trimmed)}`, locale, { signal: controller.signal })
        .then(setPayload)
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setPayload({ query: trimmed, groups: [] });
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);

    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, locale]);

  return { query, setQuery, payload, loading };
}
