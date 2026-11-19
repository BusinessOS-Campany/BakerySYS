import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, LOCALE_COOKIE } from "@/lib/auth/session";
import { AppError, errorPayload, toAppError } from "@/lib/errors";
import { requestId, audit } from "@/lib/audit";
import { logger } from "@/lib/logger";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const rid = requestId();
  try {
    const { email, password } = schema.parse(await req.json().catch(() => ({})));
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      throw new AppError("UNAUTHENTICATED", "Invalid email or password", "البريد الإلكتروني أو كلمة المرور غير صحيحة");
    }
    await db.tenant.findFirstOrThrow({ where: { id: user.tenantId, active: true } });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await createSession({
      userId: user.id,
      tenantId: user.tenantId,
      ip,
      userAgent: req.headers.get("user-agent") ?? null,
    });
    await audit(null, {
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      tenantId: user.tenantId,
      requestId: rid,
      ipAddress: ip,
    });

    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, nameAr: user.nameAr, nameEn: user.nameEn },
    });
    response.cookies.set(LOCALE_COOKIE, user.locale === "en" ? "en" : "ar", {
      path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(errorPayload(new AppError("VALIDATION", "Invalid input", "بيانات الإدخال غير صحيحة", error.issues)), { status: 422 });
    }
    const appError = toAppError(error);
    if (appError.code === "INTERNAL") logger.error({ err: error, rid }, "login error");
    return NextResponse.json(errorPayload(appError), { status: appError.status });
  }
}
