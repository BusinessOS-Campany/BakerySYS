import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, BRANCH_COOKIE, LOCALE_COOKIE } from "@/lib/auth/session";
import { AppError, errorPayload, toAppError } from "@/lib/errors";

const schema = z.object({
  branchId: z.string().nullable().optional(),
  locale: z.enum(["ar", "en"]).optional(),
}).refine((value) => value.branchId !== undefined || value.locale !== undefined, {
  message: "Nothing to update",
});

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    const input = schema.parse(await req.json().catch(() => ({})));
    const response = NextResponse.json({ ok: true });

    if (input.branchId !== undefined) {
      if (input.branchId && auth.branchIds.length > 0 && !auth.branchIds.includes(input.branchId)) {
        throw new AppError("FORBIDDEN", "Branch access denied", "ليس لديك صلاحية لهذا الفرع");
      }
      if (input.branchId) {
        const branch = await db.branch.findFirst({
          where: { id: input.branchId, tenantId: auth.user.tenantId, active: true },
          select: { id: true },
        });
        if (!branch) throw new AppError("NOT_FOUND", "Branch not found", "الفرع غير موجود");
      }
      response.cookies.set(BRANCH_COOKIE, input.branchId ?? "", {
        path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30,
      });
    }

    if (input.locale) {
      response.cookies.set(LOCALE_COOKIE, input.locale, {
        path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(errorPayload(new AppError("VALIDATION", "Invalid input", "بيانات الإدخال غير صحيحة", error.issues)), { status: 422 });
    }
    const appError = toAppError(error);
    return NextResponse.json(errorPayload(appError), { status: appError.status });
  }
}
