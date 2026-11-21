import { apiRoute } from "@/lib/http";
import { listTransactions, createTransaction, createTransactionSchema } from "@/lib/customers/transactions-service";

export const GET = apiRoute({
  permission: "customers.view",
  handler: async (_input, auth, req) => {
    const customerId = new URL(req.url).searchParams.get("customerId") || undefined;
    return { items: await listTransactions(auth.user.tenantId, customerId) };
  },
});

export const POST = apiRoute({
  permission: "customers.manage",
  schema: createTransactionSchema,
  handler: async (input, auth) => createTransaction(input, auth),
});
