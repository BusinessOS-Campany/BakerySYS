-- Empty the raw-material stock batches displayed as cards on /inventory.
-- Forward-only migration. Finished-goods stock (used by POS), recipes,
-- pricing history and all master data are intentionally left untouched.

DELETE FROM "ingredient_movements";
DELETE FROM "ingredient_lots";
DELETE FROM "ingredient_stock";
