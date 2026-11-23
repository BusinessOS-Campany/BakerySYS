-- Remove the /sales page's data. Forward-only; earlier migrations stay untouched.
-- POS, sale APIs and the immutable accounting/inventory history are retained.

CREATE TEMP TABLE "tmp_removed_sale_invoices" AS SELECT "invoiceNumber" FROM "sales";

-- Cash movements and customer subledger entries that belonged to those invoices.
DELETE FROM "cash_movements"
  WHERE "reference" IN (SELECT "invoiceNumber" FROM "tmp_removed_sale_invoices");
DELETE FROM "customer_receivables" WHERE "sourceType" = 'SALE';
DELETE FROM "customer_transactions" WHERE "sourceType" = 'SALE';
DELETE FROM "idempotency_keys" WHERE "operation" IN ('sales.create', 'sales.refund');

-- Sales documents and their children.
DELETE FROM "sale_return_items";
DELETE FROM "sale_returns";
DELETE FROM "sale_payments";
DELETE FROM "sale_items";
DELETE FROM "sales";

DROP TABLE "tmp_removed_sale_invoices";
