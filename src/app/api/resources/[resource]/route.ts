import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuth } from "@/lib/auth/session";
import { RESOURCES, type ResourceField } from "@/lib/resources/config";
import { AppError, errorPayload, toAppError } from "@/lib/errors";
import { audit, requestId } from "@/lib/audit";
import { logger } from "@/lib/logger";

type Delegate = {
  findMany(args: Record<string, unknown>): Promise<unknown[]>;
  count(args: Record<string, unknown>): Promise<number>;
  findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
};

function delegateFor(model: string): Delegate {
  const delegate = (db as unknown as Record<string, Delegate>)[model];
  if (!delegate) throw new AppError("NOT_FOUND", `Unknown resource: ${model}`);
  return delegate;
}

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? Number(item) : item))) as T;
}

function can(auth: Awaited<ReturnType<typeof getAuth>>, permission: string) {
  return Boolean(auth && (auth.permissions.has(permission) || auth.roles.includes("OWNER")));
}

function coerce(field: ResourceField, raw: unknown): unknown {
  if (raw === undefined) return field.type === "boolean" ? (field.defaultValue ?? false) : null;
  if (field.type === "boolean") return raw === true || raw === "true" || raw === "1";
  if (raw === "" || raw === null) return null;
  if (field.type === "number") {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) throw new AppError("VALIDATION", `Invalid number: ${field.name}`, `رقم غير صالح: ${field.name}`);
    return parsed;
  }
  if (field.type === "date") {
    const date = new Date(String(raw));
    if (Number.isNaN(date.getTime())) throw new AppError("VALIDATION", `Invalid date: ${field.name}`, `تاريخ غير صالح: ${field.name}`);
    return date;
  }
  return raw;
}

function buildData(config: (typeof RESOURCES)[string], body: Record<string, unknown>, tenantId: string) {
  const data: Record<string, unknown> = { tenantId };
  for (const field of config.fields) {
    let raw = body[field.name];
    if (field.hidden) {
      if (field.autoCode) raw = `${field.autoCode}-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
      else if (field.defaultFrom) raw = body[field.defaultFrom];
      else if (field.defaultValue !== undefined) raw = field.defaultValue;
      else continue;
    }
    const value = coerce(field, raw);
    if (field.required && (value === null || value === "")) {
      throw new AppError("VALIDATION", `Missing ${field.name}`, `الحقل ${field.label.ar} مطلوب`);
    }
    if (value !== null) data[field.name] = value;
  }
  return data;
}

function whereFor(config: (typeof RESOURCES)[string], tenantId: string, branchId: string | null, search: string) {
  return {
    tenantId,
    ...(config.branchScoped && branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
    ...(search ? {
      AND: [{
        OR: config.searchFields.map((field) => ({ [field]: { contains: search } })),
      }],
    } : {}),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  const rid = requestId();
  try {
    const { resource } = await params;
    const config = RESOURCES[resource];
    if (!config) throw new AppError("NOT_FOUND", "Resource not found");
    const auth = await getAuth();
    if (!can(auth, config.viewPermission)) throw new AppError("FORBIDDEN", "Missing permission");

    const url = new URL(req.url);
    const search = (url.searchParams.get("search") ?? "").trim();
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? 25), 1), 200);
    const delegate = delegateFor(config.model);
    const where = whereFor(config, auth!.user.tenantId, auth!.branchId, search);
    const [items, total] = await Promise.all([
      delegate.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      delegate.count({ where }),
    ]);
    return NextResponse.json(serialize({ items, total, page, pageSize }), { headers: { "X-Request-Id": rid } });
  } catch (error) {
    const appError = toAppError(error);
    if (appError.code === "INTERNAL") logger.error({ err: error, rid }, "resource list error");
    return NextResponse.json(errorPayload(appError), { status: appError.status });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  const rid = requestId();
  try {
    const { resource } = await params;
    const config = RESOURCES[resource];
    if (!config) throw new AppError("NOT_FOUND", "Resource not found");
    const auth = await getAuth();
    if (!can(auth, config.managePermission)) throw new AppError("FORBIDDEN", "Missing permission");

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const data = buildData(config, body, auth!.user.tenantId);
    if (config.branchScoped && auth!.branchId && !data.branchId) data.branchId = auth!.branchId;
    const delegate = delegateFor(config.model);
    const created = await delegate.create({ data });
    await audit(auth, { action: "CREATE", entity: config.entity, entityId: String(created.id), after: serialize(data), requestId: rid });
    return NextResponse.json(serialize(created), { status: 201, headers: { "X-Request-Id": rid } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(errorPayload(new AppError("CONFLICT", "Code already exists", "الرمز مستخدم بالفعل")), { status: 409 });
    }
    const appError = toAppError(error);
    if (appError.code === "INTERNAL") logger.error({ err: error, rid }, "resource create error");
    return NextResponse.json(errorPayload(appError), { status: appError.status });
  }
}
