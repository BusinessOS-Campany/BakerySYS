-- Mark credit sales so revenue KPIs can exclude them.
-- Applied migrations above are left untouched; this is a forward-only migration.

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "isCredit" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing invoices that were fully or partly paid on account.
UPDATE "sales" SET "isCredit" = true
  WHERE "id" IN (SELECT "saleId" FROM "sale_payments" WHERE "method" = 'CREDIT');

CREATE INDEX IF NOT EXISTS "sales_tenantId_isCredit_invoiceDate_idx"
  ON "sales"("tenantId", "isCredit", "invoiceDate");
