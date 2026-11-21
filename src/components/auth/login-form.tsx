"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { translate, type Locale } from "@/lib/i18n/dictionary";

export function LoginForm({ next, locale }: { next: string; locale: Locale }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const t = (key: string) => translate(locale, key);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.[locale === "ar" ? "messageAr" : "message"] ?? t("auth.invalid"));
      router.replace(next || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.invalid"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}
      <label className="block text-sm font-medium">
        {t("auth.email")}
        <span className="relative mt-1 block">
          <Mail className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[var(--text-muted)]" />
          <input
            className="input ps-10"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin"
          />
        </span>
      </label>
      <label className="block text-sm font-medium">
        {t("auth.password")}
        <span className="relative mt-1 block">
          <LockKeyhole className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[var(--text-muted)]" />
          <input
            className="input ps-10"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Bakery@2026"
          />
        </span>
      </label>
      <div className="flex items-center justify-between text-sm">
        <span className="muted text-xs">Bakery ERP v1.0</span>
        <Link className="text-[var(--primary)] hover:underline" href="/forgot-password">{t("auth.forgot")}</Link>
      </div>
      <button className="btn btn-primary w-full" type="submit" disabled={loading}>
        {loading ? t("common.loading") : t("auth.login")}
        {!loading ? <ArrowRight className="h-4 w-4 rtl:rotate-180" /> : null}
      </button>
    </form>
  );
}
