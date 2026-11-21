import { apiRoute } from "@/lib/http";
import {
  deleteTransaction,
  updateTransaction,
  updateTransactionSchema,
  type UpdateTransactionInput,
} from "@/lib/customers/transactions-service";

type Params = { id: string };

export const PATCH = apiRoute<UpdateTransactionInput, unknown, Params>({
  permission: "customers.manage",
  schema: updateTransactionSchema,
  handler: async (input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    return updateTransaction(id, input, auth);
  },
});

export const DELETE = apiRoute<unknown, unknown, Params>({
  permission: "customers.manage",
  handler: async (_input, auth, _req, ctx) => {
    const { id } = await ctx.params;
    return deleteTransaction(id, auth);
  },
});
