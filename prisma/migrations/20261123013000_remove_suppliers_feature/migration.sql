-- Remove the supplier master feature and its data.
-- Applied migrations above are left untouched; this is a forward-only migration.
-- Purchasing and financial records are kept: their supplier reference becomes a plain vendor name.

-- 1) Preserve readable vendor names on surviving records before dropping the master.
UPDATE "purchase_orders" AS po SET "supplierId" = s."nameEn"
  FROM "suppliers" AS s WHERE po."supplierId" = s."id";
UPDATE "goods_receipts" AS gr SET "supplierId" = s."nameEn"
  FROM "suppliers" AS s WHERE gr."supplierId" = s."id";
UPDATE "supplier_invoices" AS si SET "supplierId" = s."nameEn"
  FROM "suppliers" AS s WHERE si."supplierId" = s."id";
UPDATE "supplier_payments" AS sp SET "supplierId" = s."nameEn"
  FROM "suppliers" AS s WHERE sp."supplierId" = s."id";
UPDATE "supplier_payables" AS sp SET "supplierId" = s."nameEn"
  FROM "suppliers" AS s WHERE sp."supplierId" = s."id";
UPDATE "purchase_returns" AS pr SET "supplierId" = s."nameEn"
  FROM "suppliers" AS s WHERE pr."supplierId" = s."id";
UPDATE "ingredient_lots" AS il SET "supplierId" = s."nameEn"
  FROM "suppliers" AS s WHERE il."supplierId" = s."id";
UPDATE "price_history" AS ph SET "supplierId" = s."nameEn"
  FROM "suppliers" AS s WHERE ph."supplierId" = s."id";

-- 2) Defensive drops of constraints that older databases may still have.
ALTER TABLE "ingredients" DROP CONSTRAINT IF EXISTS "ingredients_preferredSupplierId_fk";
ALTER TABLE "ingredient_suppliers" DROP CONSTRAINT IF EXISTS "ingredient_suppliers_ingredientId_fk";
ALTER TABLE "ingredient_suppliers" DROP CONSTRAINT IF EXISTS "ingredient_suppliers_supplierId_fk";
ALTER TABLE "ingredient_suppliers" DROP CONSTRAINT IF EXISTS "ingredient_suppliers_tenantId_fk";
ALTER TABLE "price_history" DROP CONSTRAINT IF EXISTS "price_history_supplierId_fk";
ALTER TABLE "ingredient_lots" DROP CONSTRAINT IF EXISTS "ingredient_lots_supplierId_fk";
ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_supplierId_fk";
ALTER TABLE "goods_receipts" DROP CONSTRAINT IF EXISTS "goods_receipts_supplierId_fk";
ALTER TABLE "supplier_invoices" DROP CONSTRAINT IF EXISTS "supplier_invoices_receiptId_fk";
ALTER TABLE "supplier_invoices" DROP CONSTRAINT IF EXISTS "supplier_invoices_supplierId_fk";
ALTER TABLE "supplier_invoices" DROP CONSTRAINT IF EXISTS "supplier_invoices_tenantId_fk";
ALTER TABLE "supplier_payments" DROP CONSTRAINT IF EXISTS "supplier_payments_invoiceId_fk";
ALTER TABLE "supplier_payments" DROP CONSTRAINT IF EXISTS "supplier_payments_supplierId_fk";
ALTER TABLE "supplier_payments" DROP CONSTRAINT IF EXISTS "supplier_payments_tenantId_fk";
ALTER TABLE "purchase_returns" DROP CONSTRAINT IF EXISTS "purchase_returns_supplierId_fk";
ALTER TABLE "supplier_payables" DROP CONSTRAINT IF EXISTS "supplier_payables_supplierId_fk";
ALTER TABLE "supplier_payables" DROP CONSTRAINT IF EXISTS "supplier_payables_tenantId_fk";
ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "suppliers_tenantId_fk";

-- 3) Remove the master-only structures.
ALTER TABLE "ingredients" DROP COLUMN IF EXISTS "preferredSupplierId";
DROP TABLE IF EXISTS "ingredient_suppliers";
DROP TABLE IF EXISTS "suppliers";

-- 4) No supplier-specific permission codes exist; this is a harmless cleanup for legacy rows.
DELETE FROM "role_permissions" WHERE "permission" LIKE 'supplier.%';
DELETE FROM "permissions" WHERE "code" LIKE 'supplier.%';
