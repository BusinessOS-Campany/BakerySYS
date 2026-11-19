import type { Db } from "@/lib/db";

export async function notify(tx: Db, input: {
  tenantId: string;
  userId?: string | null;
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  kind?: string;
  link?: string;
}) {
  return tx.notification.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      bodyAr: input.bodyAr ?? null,
      bodyEn: input.bodyEn ?? null,
      kind: input.kind ?? "INFO",
      link: input.link ?? null,
    },
  });
}

export async function checkLowStock(tx: Db, tenantId: string) {
  const [ingredients, stocks, products, finished] = await Promise.all([
    tx.ingredient.findMany({ where: { tenantId, active: true }, select: { id: true, nameAr: true, nameEn: true, minStock: true } }),
    tx.ingredientStock.findMany({ where: { tenantId }, select: { ingredientId: true, quantity: true } }),
    tx.product.findMany({ where: { tenantId, active: true }, select: { id: true, nameAr: true, nameEn: true, minStock: true } }),
    tx.finishedStock.findMany({ where: { tenantId }, select: { productId: true, quantity: true } }),
  ]);
  const alerts: { type: string; id: string; nameAr: string; nameEn: string; current: number; minimum: number }[] = [];
  for (const i of ingredients) {
    const current = stocks.filter((s) => s.ingredientId === i.id).reduce((s, x) => s + Number(x.quantity), 0);
    if (current < Number(i.minStock)) {
      alerts.push({ type: "RAW", id: i.id, nameAr: i.nameAr, nameEn: i.nameEn, current, minimum: Number(i.minStock) });
    }
  }
  for (const p of products) {
    const current = finished.filter((s) => s.productId === p.id).reduce((s, x) => s + Number(x.quantity), 0);
    if (current < Number(p.minStock)) {
      alerts.push({ type: "FINISHED", id: p.id, nameAr: p.nameAr, nameEn: p.nameEn, current, minimum: Number(p.minStock) });
    }
  }
  return alerts;
}
