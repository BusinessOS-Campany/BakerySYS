import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/forgot-password", "/api/auth/login", "/api/health"];

/** Optimistic edge check only — all authorization is re-enforced server-side. */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));
  const hasSession = Boolean(request.cookies.get("bakery_session")?.value);
  const locale = request.cookies.get("bakery_locale")?.value;

  if (!isPublic && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (isPublic && path === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  const response = NextResponse.next();
  if (!locale) response.cookies.set("bakery_locale", "ar", { path: "/", sameSite: "lax" });
  response.headers.set("x-request-id", crypto.randomUUID());
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
