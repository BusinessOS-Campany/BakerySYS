-- CreateTable
CREATE TABLE "customer_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_transactions_tenantId_customerId_entryDate_idx" ON "customer_transactions"("tenantId", "customerId", "entryDate");

-- CreateIndex
CREATE INDEX "customer_transactions_tenantId_entryDate_idx" ON "customer_transactions"("tenantId", "entryDate");
