import { z } from "zod";
import { db } from "@/lib/db";
import { apiRoute } from "@/lib/http";
import { refundSale } from "@/lib/sales/service";
import { serialize } from "@/lib/serialize";
import { AppError } from "@/lib/errors";

const schema = z.object({
  saleId: z.string(),
  reason: z.string().min(2),
  items: z.array(z.object({ saleItemId: z.string(), quantity: z.number().positive() })).min(1),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "CREDIT"]).default("CASH"),
});

export const POST = apiRoute({
  permission: "sales.refund",
  schema,
  idempotent: false,
  handler: async (input, auth) => {
    const sale = await db.sale.findFirst({ where: { id: input.saleId, tenantId: auth.user.tenantId } });
    if (!sale) throw new AppError("NOT_FOUND", "Sale not found", "الفاتورة غير موجودة");
    const result = await db.$transaction((tx) => refundSale(tx, auth, input));
    return serialize(result);
  },
});
