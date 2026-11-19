ALTER TABLE "production_batches"
  ADD CONSTRAINT "production_batches_sourceWarehouseId_fk"
  FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT;
