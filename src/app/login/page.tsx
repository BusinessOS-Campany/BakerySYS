import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Croissant } from "lucide-react";
import { getAuth } from "@/lib/auth/session";
import { translate, type Locale } from "@/lib/i18n/dictionary";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const auth = await getAuth();
  const { next } = await searchParams;
  if (auth) redirect(next && next.startsWith("/") ? next : "/");
  const store = await cookies();
  const locale: Locale = store.get("bakery_locale")?.value === "en" ? "en" : "ar";
  const t = (key: string) => translate(locale, key);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-[#2a1b10] via-[#5b3213] to-[var(--primary)] p-10 text-white md:flex">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Croissant className="h-6 w-6" /> {t("app.name")}
          </div>
          <div>
            <h2 className="text-3xl font-bold leading-snug">
              {locale === "ar" ? "إدارة مخبزك من مكان واحد" : "Your whole bakery, in one place."}
            </h2>
            <p className="mt-3 max-w-sm text-sm text-white/80">
              {locale === "ar"
                ? "المشتريات، المخزون، الوصفات، الإنتاج، نقطة البيع والمحاسبة في نظام واحد متكامل."
                : "Purchasing, inventory, recipes, production, POS and accounting — connected end to end."}
            </p>
          </div>
          <p className="text-xs text-white/60">© 2026 Bakery ERP</p>
        </section>
        <section className="p-8 md:p-10">
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-[var(--primary)] md:hidden">
              <Croissant className="h-5 w-5" /> <strong>{t("app.name")}</strong>
            </div>
            <h1 className="text-2xl font-bold">{t("auth.welcome")}</h1>
            <p className="muted mt-1 text-sm">{t("auth.subtitle")}</p>
          </div>
          <LoginForm next={next ?? "/"} locale={locale} />
        </section>
      </div>
    </main>
  );
}
