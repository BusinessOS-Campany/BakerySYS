import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Bakery ERP", template: "%s · Bakery ERP" },
  description: "Bakery ERP & POS — purchasing, production, inventory, sales and accounting",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const locale = store.get("bakery_locale")?.value === "en" ? "en" : "ar";
  const themeCookie = store.get("bakery_theme")?.value;
  const theme = themeCookie === "dark" || themeCookie === "light" ? themeCookie : "light";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} data-theme={theme} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
