import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { cookies } from "next/headers";
import { translate, type Locale } from "@/lib/i18n/dictionary";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  const store = await cookies();
  const locale: Locale = store.get("bakery_locale")?.value === "en" ? "en" : "ar";
  const t = (key: string) => translate(locale, key);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--primary)]">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">{t("auth.forgotTitle")}</h1>
        <p className="muted mt-3 text-sm leading-relaxed">{t("auth.forgotHint")}</p>
        <Link className="btn btn-secondary mt-6 inline-flex" href="/login">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("auth.login")}
        </Link>
      </div>
    </main>
  );
}
