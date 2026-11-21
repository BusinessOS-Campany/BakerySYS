import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth/session";
import { RESOURCES } from "@/lib/resources/config";
import { AppError, errorPayload, toAppError } from "@/lib/errors";
import { audit, requestId } from "@/lib/audit";
import { logger } from "@/lib/logger";

type Delegate = {
  findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
};

function delegateFor(model: string): Delegate {
  const delegate = (db as unknown as Record<string, Delegate>)[model];
  if (!delegate) throw new AppError("NOT_FOUND", "Resource not found");
  return delegate;
}

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? Number(item) : item))) as T;
}

function coerce(field: (typeof import("@/lib/resources/config").RESOURCES)[string]["fields"][number], raw: unknown): unknown {
  if (field.type === "boolean") return raw === true || raw === "true" || raw === "1";
  if (raw === "" || raw === null || raw === undefined) return null;
  if (field.type === "number") return Number(raw);
  if (field.type === "date") return new Date(String(raw));
  return raw;
}

async function context(resource: string, permission: "view" | "manage", id: string) {
  const config = RESOURCES[resource];
  if (!config) throw new AppError("NOT_FOUND", "Resource not found");
  const auth = await getAuth();
  if (!auth || (!auth.permissions.has(config[`${permission}Permission`]) && !auth.roles.includes("OWNER"))) {
    throw new AppError("FORBIDDEN", "Missing permission");
  }
  const delegate = delegateFor(config.model);
  const existing = await delegate.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!existing) throw new AppError("NOT_FOUND", "Record not found");
  if (config.branchScoped && auth.branchId && existing.branchId && existing.branchId !== auth.branchId) {
    throw new AppError("FORBIDDEN", "Branch access denied");
  }
  return { auth, config, delegate, existing };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ resource: string; id: string }> }) {
  const rid = requestId();
  try {
    const { resource, id } = await params;
    const { auth, config, delegate, existing } = await context(resource, "manage", id);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const field of config.fields) {
      if (field.hidden) {
        if (field.defaultFrom && field.defaultFrom in body) {
          data[field.name] = coerce(field, body[field.defaultFrom]);
        }
        continue;
      }
      if (!(field.name in body)) continue;
      const value = coerce(field, body[field.name]);
      if (field.required && (value === null || value === "")) {
        throw new AppError("VALIDATION", `Missing ${field.name}`, `الحقل ${field.label.ar} مطلوب`);
      }
      data[field.name] = value;
    }
    const updated = await delegate.update({ where: { id }, data });
    await audit(auth, {
      action: "UPDATE", entity: config.entity, entityId: id,
      before: serialize(existing), after: serialize(data), requestId: rid,
    });
    return NextResponse.json(serialize(updated), { headers: { "X-Request-Id": rid } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(errorPayload(new AppError("CONFLICT", "Code already exists", "الرمز مستخدم بالفعل")), { status: 409 });
    }
    const appError = toAppError(error);
    if (appError.code === "INTERNAL") logger.error({ err: error, rid }, "resource update error");
    return NextResponse.json(errorPayload(appError), { status: appError.status });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ resource: string; id: string }> }) {
  const rid = requestId();
  try {
    const { resource, id } = await params;
    const { auth, config, delegate, existing } = await context(resource, "manage", id);
    await delegate.delete({ where: { id } });
    await audit(auth, {
      action: "DELETE", entity: config.entity, entityId: id, before: serialize(existing), requestId: rid,
    });
    return NextResponse.json({ ok: true }, { headers: { "X-Request-Id": rid } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2003" || code === "P2014") {
      return NextResponse.json(errorPayload(new AppError("CONFLICT", "Record is referenced by other documents", "لا يمكن الحذف لارتباط السجل ببيانات أخرى")), { status: 409 });
    }
    const appError = toAppError(error);
    if (appError.code === "INTERNAL") logger.error({ err: error, rid }, "resource delete error");
    return NextResponse.json(errorPayload(appError), { status: appError.status });
  }
}
