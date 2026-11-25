import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdmin, requirePermission, type AuthContext } from "@/lib/auth/session";
import { AppError, errorPayload, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requestId } from "@/lib/audit";

type RouteCtx<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>;
};
type Handler<I, O, P extends Record<string, string>> = (
  input: I, auth: AuthContext, req: Request, ctx: RouteCtx<P>,
) => Promise<O>;

/**
 * Server-side request boundary: authentication, permission, schema validation,
 * idempotency, audit-friendly request ids and consistent error envelopes.
 */
export function apiRoute<I, O, P extends Record<string, string> = Record<string, string>>(options: {
  permission: string;
  /** Require the tenant OWNER/admin role, even if the caller has the permission code. */
  adminOnly?: boolean;
  schema?: z.ZodType<I>;
  idempotent?: boolean;
  handler: Handler<I, O, P>;
}) {
  return async (req: Request, ctx: RouteCtx<P>): Promise<Response> => {
    const rid = requestId();
    try {
      const auth = await requirePermission(options.permission);
      if (options.adminOnly && !isAdmin(auth)) {
        throw new AppError("FORBIDDEN", "Admin access required", "هذا الإجراء متاح للمسؤول فقط");
      }
      let body: unknown = {};
      if (req.method !== "GET" && req.method !== "DELETE") {
        body = await req.json().catch(() => ({}));
      }
      const input = options.schema ? options.schema.parse(body) : (body as I);
      const key = req.headers.get("idempotency-key");

      if (options.idempotent && key) {
        const existing = await db.idempotencyKey.findUnique({
          where: {
            tenantId_operation_key: { tenantId: auth.user.tenantId, operation: options.permission, key },
          },
        });
        if (existing?.status === "COMPLETED") {
          return NextResponse.json(existing.result ?? { ok: true }, { headers: { "X-Request-Id": rid } });
        }
      }

      const result = await options.handler(input, auth, req, ctx);
      if (result instanceof Response) return result;

      if (options.idempotent && key) {
        await db.idempotencyKey.upsert({
          where: {
            tenantId_operation_key: { tenantId: auth.user.tenantId, operation: options.permission, key },
          },
          create: {
            tenantId: auth.user.tenantId, operation: options.permission, key,
            status: "COMPLETED", result: result as never,
          },
          update: { status: "COMPLETED", result: result as never },
        });
      }
      return NextResponse.json(result, { headers: { "X-Request-Id": rid } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          errorPayload(new AppError("VALIDATION", "Invalid input", "بيانات الإدخال غير صحيحة", error.issues)),
          { status: 422, headers: { "X-Request-Id": rid } },
        );
      }
      const appError = toAppError(error);
      if (appError.code === "INTERNAL") logger.error({ err: error, rid }, "api error");
      return NextResponse.json(errorPayload(appError), {
        status: appError.status,
        headers: { "X-Request-Id": rid },
      });
    }
  };
}
