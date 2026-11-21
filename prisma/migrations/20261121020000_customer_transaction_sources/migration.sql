-- AlterTable
ALTER TABLE "customer_transactions" ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceId" TEXT;

-- CreateIndex
CREATE INDEX "customer_transactions_tenantId_sourceType_sourceId_idx" ON "customer_transactions"("tenantId", "sourceType", "sourceId");
