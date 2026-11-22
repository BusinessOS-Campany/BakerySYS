import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertBranchAccess, requirePermission, type AuthContext } from "@/lib/auth/session";
import { AppError, errorPayload, toAppError } from "@/lib/errors";
import { requestId } from "@/lib/audit";
import { serialize } from "@/lib/serialize";

type FieldType = "string" | "nullableString" | "number" | "nullableNumber" | "date" | "nullableDate" | "boolean";

type ResourceConfig = {
  model: string;
  permission: string;
  fields: Record<string, FieldType>;
  /** Allowed values for enum-like string fields. */
  allowed?: Record<string, string[]>;
  /** Returns derived field values to persist alongside the supplied fields. */
  derive?: (row: Record<string, unknown>, data: Record<string, unknown>) => Record<string, unknown>;
  /** Returns true when the record is in a state that must not be edited/deleted. */
  blocked?: (row: Record<string, unknown>) => boolean;
  blockedMessage?: string;
  blockedMessageAr?: string;
};

/** Safe, field-level editing for simple workflow documents. Financial posting
 *  documents (sales, journals, receipts with stock impact) are intentionally
 *  absent — they need dedicated, atomic workflows. */
const CONFIG: Record<string, ResourceConfig> = {
  "quality-inspections": {
    model: "qualityInspection",
    permission: "quality.manage",
    fields: {
      checkType: "string", standard: "nullableString", actualResult: "nullableString",
      expectedValue: "nullableString", result: "string", temperature: "number",
      notes: "nullableString", correctiveAction: "nullableString",
    },
    allowed: { result: ["PASS", "FAIL", "PENDING"] },
  },
  "temperature-logs": {
    model: "temperatureLog",
    permission: "quality.manage",
    fields: {
      location: "string", equipment: "nullableString", temperature: "number",
      minAllowed: "nullableNumber", maxAllowed: "nullableNumber", notes: "nullableString",
    },
    derive: (row, data) => {
      const temperature = Number(data.temperature ?? row.temperature);
      const min = data.minAllowed === undefined ? row.minAllowed : data.minAllowed;
      const max = data.maxAllowed === undefined ? row.maxAllowed : data.maxAllowed;
      const belowMin = min != null && temperature < Number(min);
      const aboveMax = max != null && temperature > Number(max);
      return { ok: !belowMin && !aboveMax };
    },
  },
  "inventory-counts": {
    model: "stockCount",
    permission: "inventory.manage",
    fields: { countDate: "date", notes: "nullableString" },
    blocked: (row) => row.status !== "DRAFT",
    blockedMessage: "Only draft counts can be changed",
    blockedMessageAr: "يمكن تعديل الجرد في حالة المسودة فقط",
  },
  "inventory-transfers": {
    model: "warehouseTransfer",
    permission: "inventory.manage",
    fields: { fromWarehouse: "string", toWarehouse: "string", quantity: "number", notes: "nullableString" },
    blocked: (row) => row.status !== "DRAFT",
    blockedMessage: "Only draft transfers can be changed",
    blockedMessageAr: "يمكن تعديل التحويل في حالة المسودة فقط",
  },
  "production-plans": {
    model: "productionPlan",
    permission: "production.manage",
    fields: {
      tableQuantity: "number", pieceQuantity: "number", kilogramQuantity: "number",
      notes: "nullableString",
    },
    derive: (row, data) => data.pieceQuantity === undefined
      ? {}
      : { plannedQuantity: Number(data.pieceQuantity) },
    blocked: (row) => row.status !== "PLANNED",
    blockedMessage: "Only planned production plans can be changed",
    blockedMessageAr: "يمكن تعديل الخطة في حالة التخطيط فقط",
  },
  "production-batches": {
    model: "productionBatch",
    permission: "production.manage",
    fields: { plannedQuantity: "number", expiryDate: "nullableDate", notes: "nullableString" },
    blocked: (row) => row.status !== "PLANNED",
    blockedMessage: "Only planned batches can be changed",
    blockedMessageAr: "يمكن تغيير الدفعة في حالة التخطيط فقط",
  },
  "purchasing-orders": {
    model: "purchaseOrder",
    permission: "purchases.manage",
    fields: { expectedDate: "nullableDate", notes: "nullableString" },
    blocked: (row) => row.status !== "DRAFT",
    blockedMessage: "Only draft purchase orders can be changed",
    blockedMessageAr: "يمكن تعديل أمر الشراء في حالة المسودة فقط",
  },
};

type RouteCtx = { params: Promise<{ resource: string; id: string }> };

function delegate(model: string) {
  return (db as unknown as Record<string, {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  }>)[model];
}

async function context(resource: string, id: string, auth: AuthContext) {
  const config = CONFIG[resource];
  if (!config) throw new AppError("NOT_FOUND", "Resource not found", "المورد غير موجود");
  const client = delegate(config.model);
  if (!client) throw new AppError("NOT_FOUND", "Resource not found", "المورد غير موجود");
  const row = await client.findFirst({ where: { id, tenantId: auth.user.tenantId } });
  if (!row) throw new AppError("NOT_FOUND", "Record not found", "السجل غير موجود");
  assertBranchAccess(auth, row.branchId as string | null | undefined);
  return { config, row, client };
}

function coerce(type: FieldType, value: unknown) {
  if (type === "boolean") return Boolean(value);
  if (type === "number" || type === "nullableNumber") {
    if (type === "nullableNumber" && (value === null || value === "")) return null;
    const number = Number(value);
    if (!Number.isFinite(number)) throw new AppError("VALIDATION", "Invalid number", "رقم غير صالح");
    return number;
  }
  if (type === "date" || type === "nullableDate") {
    if (value === null || value === "") return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new AppError("VALIDATION", "Invalid date", "تاريخ غير صالح");
    return date;
  }
  if (type === "nullableString") return value ? String(value) : null;
  const text = String(value ?? "").trim();
  if (!text) throw new AppError("VALIDATION", "Value is required", "القيمة مطلوبة");
  return text;
}

function respond(error: unknown) {
  const appError = toAppError(error);
  return NextResponse.json(errorPayload(appError), { status: appError.status, headers: { "x-request-id": requestId() } });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const { resource, id } = await ctx.params;
    const config = CONFIG[resource];
    if (!config) throw new AppError("NOT_FOUND", "Resource not found", "المورد غير موجود");
    const auth = await requirePermission(config.permission);
    const { row, client } = await context(resource, id, auth);
    if (config.blocked?.(row)) {
      throw new AppError("INVALID_STATE", config.blockedMessage ?? "Record cannot be edited", config.blockedMessageAr ?? config.blockedMessage ?? "لا يمكن تعديل السجل");
    }
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const [key, type] of Object.entries(config.fields)) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      const value = coerce(type, body[key]);
      const allowed = config.allowed?.[key];
      if (allowed && !allowed.includes(String(value))) {
        throw new AppError("VALIDATION", `Invalid value for ${key}`, `قيمة غير صالحة لحقل ${key}`);
      }
      data[key] = value;
    }
    if (!Object.keys(data).length) throw new AppError("VALIDATION", "No fields to update", "لا توجد حقول للتعديل");
    Object.assign(data, config.derive?.(row, data) ?? {});
    const updated = await client.update({ where: { id }, data });
    return NextResponse.json(serialize(updated));
  } catch (error) {
    return respond(error);
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  try {
    const { resource, id } = await ctx.params;
    const config = CONFIG[resource];
    if (!config) throw new AppError("NOT_FOUND", "Resource not found", "المورد غير موجود");
    const auth = await requirePermission(config.permission);
    const { row, client } = await context(resource, id, auth);
    if (config.blocked?.(row)) {
      throw new AppError("INVALID_STATE", config.blockedMessage ?? "Record cannot be deleted", config.blockedMessageAr ?? config.blockedMessage ?? "لا يمكن حذف السجل");
    }
    await client.delete({ where: { id } });
    return NextResponse.json(serialize({ id }));
  } catch (error) {
    const appError = toAppError(error);
    const code = (error as { code?: string })?.code;
    if (code === "P2003" || code === "P2014") {
      return NextResponse.json(errorPayload(new AppError(
        "CONFLICT", "Record is referenced by other documents", "السجل مُشار إليه في مستندات أخرى",
      )), { status: 409, headers: { "x-request-id": requestId() } });
    }
    return respond(appError);
  }
}
