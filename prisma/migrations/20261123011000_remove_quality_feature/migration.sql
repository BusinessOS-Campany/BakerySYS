-- Remove the quality-control feature and its data.
-- Applied migrations above are left untouched; this is a forward-only migration.

-- 1) Break the inbound reference from the surviving purchasing table.
--    Constraint added in 20261119104500_add_integrity_constraints,
--    already dropped in 20261119110127_production_source_warehouse.
ALTER TABLE "goods_receipt_items" DROP CONSTRAINT IF EXISTS "goods_receipt_items_qualityCheckId_fk";
ALTER TABLE "goods_receipt_items" DROP COLUMN IF EXISTS "qualityCheckId";

-- 2) Defensive drops of remaining constraints on the tables being removed.
ALTER TABLE "corrective_actions" DROP CONSTRAINT IF EXISTS "corrective_actions_inspectionId_fk";
ALTER TABLE "corrective_actions" DROP CONSTRAINT IF EXISTS "corrective_actions_tenantId_fk";
ALTER TABLE "quality_inspections" DROP CONSTRAINT IF EXISTS "quality_inspections_employeeId_fk";
ALTER TABLE "quality_inspections" DROP CONSTRAINT IF EXISTS "quality_inspections_tenantId_fk";
ALTER TABLE "temperature_logs" DROP CONSTRAINT IF EXISTS "temperature_logs_tenantId_fk";
ALTER TABLE "recall_records" DROP CONSTRAINT IF EXISTS "recall_records_ingredientLotId_fk";
ALTER TABLE "recall_records" DROP CONSTRAINT IF EXISTS "recall_records_batchId_fk";
ALTER TABLE "recall_records" DROP CONSTRAINT IF EXISTS "recall_records_tenantId_fk";

-- 3) Drop child-first (indexes drop automatically with the tables).
DROP TABLE IF EXISTS "corrective_actions";
DROP TABLE IF EXISTS "recall_records";
DROP TABLE IF EXISTS "temperature_logs";
DROP TABLE IF EXISTS "quality_inspections";

-- 4) Enum created in 20261119104454_init.
DROP TYPE IF EXISTS "QualityResult";

-- 5) Stale permission rows (users/roles are kept to avoid breaking audit history).
DELETE FROM "role_permissions" WHERE "permission" LIKE 'quality.%';
DELETE FROM "permissions" WHERE "code" LIKE 'quality.%';
