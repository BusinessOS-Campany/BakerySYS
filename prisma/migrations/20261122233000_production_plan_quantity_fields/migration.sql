-- AlterTable
ALTER TABLE "production_plans"
  ADD COLUMN     "tableQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN     "pieceQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN     "kilogramQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- Backfill existing plans from the legacy single quantity.
-- The three new fields are independent; no unit conversion is assumed.
UPDATE "production_plans" SET "pieceQuantity" = "plannedQuantity";
