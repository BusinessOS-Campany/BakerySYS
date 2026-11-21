import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";
import { GlobalSearchPage } from "@/components/search/global-search-page";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  const { q } = await searchParams;
  const initialQuery = Array.isArray(q) ? q[0] ?? "" : q ?? "";
  return <GlobalSearchPage locale={auth.locale} initialQuery={initialQuery} />;
}
