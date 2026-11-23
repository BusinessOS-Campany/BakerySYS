-- Remove the production feature and its data.
-- Applied migrations above are left untouched; this is a forward-only migration.

-- Clear references held by surviving tables before dropping production records.
UPDATE "customer_orders" SET "batchId" = NULL;
UPDATE "finished_lots" SET "batchId" = NULL;
UPDATE "recall_records" SET "batchId" = NULL;

-- Production-specific quality checks, notifications and document sequences.
DELETE FROM "quality_inspections" WHERE "referenceType" = 'BATCH';
DELETE FROM "notifications" WHERE "kind" = 'PRODUCTION';
DELETE FROM "number_sequences" WHERE "docType" IN ('PP', 'BATCH');

-- Production permissions (role/user rows are kept to avoid breaking audit history).
DELETE FROM "role_permissions" WHERE "permission" LIKE 'production.%';
DELETE FROM "permissions" WHERE "code" LIKE 'production.%';

-- Drop production tables child-first.
DROP TABLE IF EXISTS "production_stage_logs";
DROP TABLE IF EXISTS "production_batch_employees";
DROP TABLE IF EXISTS "production_batch_ingredients";
DROP TABLE IF EXISTS "production_waste";
DROP TABLE IF EXISTS "production_plan_items";
DROP TABLE IF EXISTS "production_batches";
DROP TABLE IF EXISTS "production_plans";
DROP TABLE IF EXISTS "production_stages";
DROP TYPE IF EXISTS "BatchStatus";
