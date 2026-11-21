DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_transactions_tenantId_fkey') THEN
    ALTER TABLE "customer_transactions" ADD CONSTRAINT "customer_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_transactions_customerId_fkey') THEN
    ALTER TABLE "customer_transactions" ADD CONSTRAINT "customer_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_transactions_amount_positive') THEN
    ALTER TABLE "customer_transactions" ADD CONSTRAINT "customer_transactions_amount_positive" CHECK ("amount" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_transactions_kind_check') THEN
    ALTER TABLE "customer_transactions" ADD CONSTRAINT "customer_transactions_kind_check" CHECK ("kind" IN ('DEBT', 'PAYMENT'));
  END IF;
END $$;
