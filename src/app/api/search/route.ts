import { z } from "zod";
import { apiRoute } from "@/lib/http";
import { db } from "@/lib/db";
import type { SearchGroup, SearchPayload, SearchResult } from "@/lib/search/types";
import { numericLocale } from "@/lib/i18n/dictionary";

const contains = (value: string) => ({ contains: value });
const href = (path: string, query: string) => `${path}?search=${encodeURIComponent(query)}`;

export const GET = apiRoute<unknown, SearchPayload>({
  permission: "dashboard.view",
  handler: async (_input, auth, req) => {
    const raw = new URL(req.url).searchParams.get("q") ?? "";
    const parsed = z.string().trim().min(2).max(80).safeParse(raw);
    if (!parsed.success) return { query: raw.trim(), groups: [] };

    const q = parsed.data;
    const tenantId = auth.user.tenantId;
    const ar = auth.locale === "ar";
    const can = (permission: string) => auth.permissions.has(permission) || auth.roles.includes("OWNER");
    const tasks: Promise<SearchGroup>[] = [];

    if (can("customers.view")) {
      tasks.push(db.customer.findMany({
        where: {
          tenantId,
          OR: [{ code: contains(q) }, { nameAr: contains(q) }, { nameEn: contains(q) }, { phone: contains(q) }],
        },
        select: { id: true, code: true, nameAr: true, nameEn: true, phone: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).then((rows): SearchGroup => ({
        groupKey: "nav.customers",
        results: rows.map((row): SearchResult => ({
          id: row.id,
          label: ar ? row.nameAr : row.nameEn,
          subtitle: row.phone || row.code,
          href: href("/customers", q),
        })),
      })));
    }

    if (can("products.view")) {
      tasks.push(db.product.findMany({
        where: {
          tenantId,
          OR: [
            { sku: contains(q) }, { barcode: contains(q) },
            { nameAr: contains(q) }, { nameEn: contains(q) },
          ],
        },
        select: { id: true, sku: true, nameAr: true, nameEn: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).then((rows): SearchGroup => ({
        groupKey: "nav.products",
        results: rows.map((row): SearchResult => ({
          id: row.id,
          label: ar ? row.nameAr : row.nameEn,
          subtitle: row.sku,
          href: href("/products", q),
        })),
      })));

      tasks.push(db.category.findMany({
        where: {
          tenantId,
          OR: [{ code: contains(q) }, { nameAr: contains(q) }, { nameEn: contains(q) }],
        },
        select: { id: true, code: true, nameAr: true, nameEn: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).then((rows): SearchGroup => ({
        groupKey: "nav.categories",
        results: rows.map((row): SearchResult => ({
          id: row.id,
          label: ar ? row.nameAr : row.nameEn,
          subtitle: row.code,
          href: href("/categories", q),
        })),
      })));
    }

    if (can("purchases.view")) {
      tasks.push(db.supplier.findMany({
        where: {
          tenantId,
          OR: [
            { code: contains(q) }, { nameAr: contains(q) }, { nameEn: contains(q) },
            { contactName: contains(q) }, { phone: contains(q) }, { email: contains(q) },
          ],
        },
        select: { id: true, code: true, nameAr: true, nameEn: true, contactName: true, phone: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).then((rows): SearchGroup => ({
        groupKey: "nav.suppliers",
        results: rows.map((row): SearchResult => ({
          id: row.id,
          label: ar ? row.nameAr : row.nameEn,
          subtitle: row.phone || row.contactName || row.code,
          href: href("/suppliers", q),
        })),
      })));
    }

    if (can("sales.view")) {
      tasks.push(db.sale.findMany({
        where: {
          tenantId,
          ...(auth.branchId ? { branchId: auth.branchId } : {}),
          OR: [{ invoiceNumber: contains(q) }, { notes: contains(q) }, { idempotencyKey: contains(q) }],
        },
        select: { id: true, invoiceNumber: true, invoiceDate: true, notes: true },
        orderBy: { invoiceDate: "desc" },
        take: 5,
      }).then((rows): SearchGroup => ({
        groupKey: "nav.sales",
        results: rows.map((row): SearchResult => ({
          id: row.id,
          label: row.invoiceNumber,
          subtitle: row.notes || row.invoiceDate.toLocaleDateString(numericLocale(auth.locale)),
          href: href("/sales", q),
        })),
      })));
    }

    if (can("users.manage")) {
      tasks.push(db.user.findMany({
        where: {
          tenantId,
          OR: [{ email: contains(q) }, { phone: contains(q) }, { nameAr: contains(q) }, { nameEn: contains(q) }],
        },
        select: { id: true, email: true, phone: true, nameAr: true, nameEn: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).then((rows): SearchGroup => ({
        groupKey: "nav.users",
        results: rows.map((row): SearchResult => ({
          id: row.id,
          label: ar ? row.nameAr : row.nameEn,
          subtitle: row.email || row.phone || "",
          href: href("/users", q),
        })),
      })));
    }

    const groups = (await Promise.all(tasks)).filter((group) => group.results.length > 0);
    return { query: q, groups };
  },
});
