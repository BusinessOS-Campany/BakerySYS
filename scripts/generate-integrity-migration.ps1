# Generates the referential-integrity migration from prisma/schema.prisma.
# Business tables keep scalar IDs in Prisma; the database enforces the graph.
$txt = Get-Content 'prisma\schema.prisma' -Raw
$models = [regex]::Matches($txt, '(?s)model\s+(\w+)\s*\{(.*?)\n\}')
$lines = @()
$lines += '-- Integrity migration: foreign keys, check constraints and immutability guards.'
$lines += 'CREATE OR REPLACE FUNCTION add_bakery_fk(p_table text, p_column text, p_parent text, p_parent_column text DEFAULT ''id'', p_on_delete text DEFAULT ''RESTRICT'') RETURNS void LANGUAGE plpgsql AS $$'
$lines += 'BEGIN'
$lines += '  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = p_table || ''_'' || p_column || ''_fk'') THEN'
$lines += '    EXECUTE format(''ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE %s'', p_table, p_table || ''_'' || p_column || ''_fk'', p_column, p_parent, p_parent_column, p_on_delete);'
$lines += '  END IF;'
$lines += 'END $$;'
$lines += ''
foreach ($m in $models) {
  $body = $m.Groups[2].Value
  if ($body -match '\btenantId\s+String') {
    $t = [regex]::Match($body, '@@map\("([^"]+)"\)').Groups[1].Value
    $lines += "SELECT add_bakery_fk('$t', 'tenantId', 'tenants');"
  }
}
$lines += ''
$lines += '-- Ownership / lifecycle foreign keys'
$fks = @(
'warehouses|branchId|branches','role_permissions|roleId|roles','role_permissions|permission|permissions|code','user_roles|userId|users','user_roles|roleId|roles','user_roles|branchId|branches',
'user_branch_access|userId|users','user_branch_access|branchId|branches','sessions|userId|users','password_reset_tokens|userId|users','audit_logs|userId|users',
'unit_conversions|fromUnitId|units_of_measure','unit_conversions|toUnitId|units_of_measure','categories|parentId|categories',
'ingredients|categoryId|categories','ingredients|baseUnitId|units_of_measure','ingredients|purchaseUnitId|units_of_measure',
'price_history|ingredientId|ingredients',
'products|categoryId|categories','products|recipeId|recipes','products|baseUnitId|units_of_measure','product_variants|productId|products',
'product_prices|productId|products','product_prices|variantId|product_variants','product_prices|branchId|branches',
'product_barcodes|productId|products','product_barcodes|variantId|product_variants','product_barcodes|unitId|units_of_measure',
'ingredient_stock|warehouseId|warehouses','ingredient_stock|ingredientId|ingredients','ingredient_lots|warehouseId|warehouses','ingredient_lots|ingredientId|ingredients',
'ingredient_movements|warehouseId|warehouses','ingredient_movements|ingredientId|ingredients','ingredient_movements|lotId|ingredient_lots',
'finished_stock|warehouseId|warehouses','finished_stock|productId|products','finished_stock|variantId|product_variants',
'finished_lots|warehouseId|warehouses','finished_lots|productId|products','finished_lots|variantId|product_variants',
'finished_movements|warehouseId|warehouses','finished_movements|productId|products','finished_movements|variantId|product_variants','finished_movements|lotId|finished_lots',
'stock_adjustments|warehouseId|warehouses','stock_counts|warehouseId|warehouses','stock_count_lines|countId|stock_counts','warehouse_transfers|fromWarehouse|warehouses','warehouse_transfers|toWarehouse|warehouses',
'recipes|productId|products','recipe_versions|recipeId|recipes','recipe_ingredients|versionId|recipe_versions','recipe_ingredients|ingredientId|ingredients','recipe_ingredients|unitId|units_of_measure',
'recipe_instructions|versionId|recipe_versions','recipe_cost_snapshots|recipeId|recipes','recipe_cost_snapshots|versionId|recipe_versions',
'purchase_requests|branchId|branches','purchase_requests|warehouseId|warehouses','purchase_request_items|requestId|purchase_requests','purchase_request_items|ingredientId|ingredients','purchase_request_items|unitId|units_of_measure',
'purchase_orders|branchId|branches','purchase_orders|warehouseId|warehouses',
'purchase_order_items|orderId|purchase_orders','purchase_order_items|ingredientId|ingredients','purchase_order_items|unitId|units_of_measure',
'goods_receipts|orderId|purchase_orders','goods_receipts|warehouseId|warehouses',
'goods_receipt_items|receiptId|goods_receipts','goods_receipt_items|orderItemId|purchase_order_items','goods_receipt_items|ingredientId|ingredients','goods_receipt_items|unitId|units_of_measure',
'supplier_invoices|receiptId|goods_receipts','supplier_payments|invoiceId|supplier_invoices',
'purchase_returns|receiptId|goods_receipts','purchase_return_items|returnId|purchase_returns','purchase_return_items|ingredientId|ingredients',
'customer_addresses|customerId|customers','sales|customerId|customers','sales|branchId|branches','sales|warehouseId|warehouses','sales|cashierId|users','sales|cashSessionId|cash_sessions','sales|journalId|journal_entries',
'sale_items|saleId|sales','sale_items|productId|products','sale_items|variantId|product_variants','sale_items|lotId|finished_lots',
'sale_payments|saleId|sales','sale_returns|saleId|sales','sale_returns|journalId|journal_entries','sale_return_items|returnId|sale_returns','sale_return_items|saleItemId|sale_items','sale_return_items|productId|products',
'cash_registers|branchId|branches','cash_sessions|registerId|cash_registers','cash_sessions|cashierId|users','cash_sessions|branchId|branches','cash_movements|sessionId|cash_sessions',
'customer_orders|customerId|customers','customer_orders|branchId|branches','customer_orders|productId|products','customer_orders|assignedBakerId|employees','customer_orders|journalId|journal_entries',
'customer_order_items|orderId|customer_orders','customer_order_items|productId|products','customer_order_payments|orderId|customer_orders','customer_order_payments|journalId|journal_entries','customer_order_attachments|orderId|customer_orders',
'deliveries|orderId|customer_orders','deliveries|saleId|sales','accounts|parentId|accounts','journal_entries|branchId|branches','journal_entries|reversalOfId|journal_entries',
'journal_lines|entryId|journal_entries','journal_lines|accountId|accounts','journal_lines|branchId|branches','expense_categories|accountId|accounts',
'expenses|branchId|branches','expenses|categoryId|expense_categories','expenses|accountId|accounts','expenses|journalId|journal_entries','cash_accounts|accountId|accounts','bank_accounts|accountId|accounts',
'customer_receivables|customerId|customers',
'employees|userId|users','employees|branchId|branches','employees|departmentId|departments','employees|positionId|job_positions','job_positions|departmentId|departments',
'employee_attendance|employeeId|employees','employee_shifts|employeeId|employees','employee_shifts|branchId|branches','employee_leaves|employeeId|employees','salary_advances|employeeId|employees',
'payroll_runs|journalId|journal_entries','payroll_items|runId|payroll_runs','payroll_items|employeeId|employees',
'ingredient_allergens|ingredientId|ingredients','ingredient_allergens|allergenId|allergens','product_allergens|productId|products','product_allergens|allergenId|allergens',
'notifications|userId|users','notification_preferences|userId|users'
)
foreach ($fk in $fks) {
  $parts = $fk.Split('|')
  if ($parts.Count -eq 4) {
    $lines += "SELECT add_bakery_fk('$($parts[0])', '$($parts[1])', '$($parts[2])', '$($parts[3])');"
  } else {
    $lines += "SELECT add_bakery_fk('$($parts[0])', '$($parts[1])', '$($parts[2])');"
  }
}
$lines += ''
$lines += 'DROP FUNCTION add_bakery_fk(text, text, text, text, text);'
$lines += ''
$lines += '-- Domain checks'
$lines += 'ALTER TABLE "ingredient_stock" ADD CONSTRAINT "ingredient_stock_nonnegative" CHECK ("quantity" >= 0 AND "reserved" >= 0);'
$lines += 'ALTER TABLE "finished_stock" ADD CONSTRAINT "finished_stock_nonnegative" CHECK ("quantity" >= 0 AND "reserved" >= 0);'
$lines += 'ALTER TABLE "ingredient_lots" ADD CONSTRAINT "ingredient_lots_nonnegative" CHECK ("quantity" >= 0 AND "initialQty" >= 0);'
$lines += 'ALTER TABLE "finished_lots" ADD CONSTRAINT "finished_lots_nonnegative" CHECK ("quantity" >= 0 AND "initialQty" >= 0);'
$lines += 'ALTER TABLE "ingredient_movements" ADD CONSTRAINT "ingredient_movements_positive" CHECK ("quantity" > 0);'
$lines += 'ALTER TABLE "finished_movements" ADD CONSTRAINT "finished_movements_positive" CHECK ("quantity" > 0);'
$lines += 'ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_nonnegative" CHECK ("debit" >= 0 AND "credit" >= 0 AND NOT ("debit" > 0 AND "credit" > 0));'
$lines += 'ALTER TABLE "sales" ADD CONSTRAINT "sales_nonnegative" CHECK ("subtotal" >= 0 AND "total" >= 0 AND "paidAmount" >= 0);'
$lines += 'ALTER TABLE "products" ADD CONSTRAINT "products_nonnegative" CHECK ("sellingPrice" >= 0 AND "costPrice" >= 0);'
$lines += 'ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_nonnegative" CHECK ("currentCost" >= 0);'
$lines += 'CREATE UNIQUE INDEX "cash_sessions_one_open" ON "cash_sessions"("registerId") WHERE "status" = ''OPEN'';'
$lines += ''
$lines += '-- Posted journals are immutable; corrections are reversals only.'
$lines += 'CREATE OR REPLACE FUNCTION bakery_guard_journal() RETURNS trigger LANGUAGE plpgsql AS $$'
$lines += 'BEGIN'
$lines += '  IF TG_OP = ''DELETE'' THEN RAISE EXCEPTION ''Journal records cannot be deleted''; END IF;'
$lines += '  IF TG_OP = ''UPDATE'' AND TG_TABLE_NAME = ''journal_lines'' THEN RAISE EXCEPTION ''Journal lines cannot be edited; post a reversal''; END IF;'
$lines += '  IF TG_OP = ''UPDATE'' AND TG_TABLE_NAME = ''journal_entries'' THEN'
$lines += '    IF OLD."entryNumber" IS DISTINCT FROM NEW."entryNumber" OR OLD."date" IS DISTINCT FROM NEW."date" OR OLD."description" IS DISTINCT FROM NEW."description" OR OLD."referenceType" IS DISTINCT FROM NEW."referenceType" OR OLD."referenceId" IS DISTINCT FROM NEW."referenceId" OR OLD."branchId" IS DISTINCT FROM NEW."branchId" OR OLD."createdById" IS DISTINCT FROM NEW."createdById" THEN'
$lines += '      RAISE EXCEPTION ''Posted journal headers cannot be edited''; END IF;'
$lines += '  END IF;'
$lines += '  RETURN NEW;'
$lines += 'END $$;'
$lines += 'CREATE TRIGGER "journal_entries_immutable" BEFORE UPDATE OR DELETE ON "journal_entries" FOR EACH ROW EXECUTE FUNCTION bakery_guard_journal();'
$lines += 'CREATE TRIGGER "journal_lines_immutable" BEFORE UPDATE OR DELETE ON "journal_lines" FOR EACH ROW EXECUTE FUNCTION bakery_guard_journal();'
$dir = 'prisma\migrations\20261119104500_add_integrity_constraints'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$sql = ($lines -join "`n") + "`n"
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "$dir\migration.sql"), $sql, (New-Object System.Text.UTF8Encoding($false)))
"generated $($lines.Count) SQL statements"
