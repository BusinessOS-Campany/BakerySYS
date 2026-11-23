-- Add per-batch state and cleaning flags to raw material lots.
-- Forward-only; existing lots become whole grains and not cleaned.

ALTER TABLE "ingredient_lots"
  ADD COLUMN "itemState" TEXT NOT NULL DEFAULT 'GRAINS',
  ADD COLUMN "cleaned" BOOLEAN NOT NULL DEFAULT false;
