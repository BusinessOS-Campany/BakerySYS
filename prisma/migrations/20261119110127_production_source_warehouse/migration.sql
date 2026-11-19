-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_parentId_fk";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_tenantId_fk";

-- DropForeignKey
ALTER TABLE "allergens" DROP CONSTRAINT "allergens_tenantId_fk";

-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_tenantId_fk";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_tenantId_fk";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fk";

-- DropForeignKey
ALTER TABLE "bank_accounts" DROP CONSTRAINT "bank_accounts_accountId_fk";

-- DropForeignKey
ALTER TABLE "bank_accounts" DROP CONSTRAINT "bank_accounts_tenantId_fk";

-- DropForeignKey
ALTER TABLE "branches" DROP CONSTRAINT "branches_tenantId_fk";

-- DropForeignKey
ALTER TABLE "cash_accounts" DROP CONSTRAINT "cash_accounts_accountId_fk";

-- DropForeignKey
ALTER TABLE "cash_accounts" DROP CONSTRAINT "cash_accounts_tenantId_fk";

-- DropForeignKey
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_sessionId_fk";

-- DropForeignKey
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_tenantId_fk";

-- DropForeignKey
ALTER TABLE "cash_registers" DROP CONSTRAINT "cash_registers_branchId_fk";

-- DropForeignKey
ALTER TABLE "cash_registers" DROP CONSTRAINT "cash_registers_tenantId_fk";

-- DropForeignKey
ALTER TABLE "cash_sessions" DROP CONSTRAINT "cash_sessions_branchId_fk";

-- DropForeignKey
ALTER TABLE "cash_sessions" DROP CONSTRAINT "cash_sessions_cashierId_fk";

-- DropForeignKey
ALTER TABLE "cash_sessions" DROP CONSTRAINT "cash_sessions_registerId_fk";

-- DropForeignKey
ALTER TABLE "cash_sessions" DROP CONSTRAINT "cash_sessions_tenantId_fk";

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_parentId_fk";

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_tenantId_fk";

-- DropForeignKey
ALTER TABLE "cleaning_records" DROP CONSTRAINT "cleaning_records_tenantId_fk";

-- DropForeignKey
ALTER TABLE "corrective_actions" DROP CONSTRAINT "corrective_actions_inspectionId_fk";

-- DropForeignKey
ALTER TABLE "corrective_actions" DROP CONSTRAINT "corrective_actions_tenantId_fk";

-- DropForeignKey
ALTER TABLE "customer_addresses" DROP CONSTRAINT "customer_addresses_customerId_fk";

-- DropForeignKey
ALTER TABLE "customer_addresses" DROP CONSTRAINT "customer_addresses_tenantId_fk";

-- DropForeignKey
ALTER TABLE "customer_order_attachments" DROP CONSTRAINT "customer_order_attachments_orderId_fk";

-- DropForeignKey
ALTER TABLE "customer_order_attachments" DROP CONSTRAINT "customer_order_attachments_tenantId_fk";

-- DropForeignKey
ALTER TABLE "customer_order_items" DROP CONSTRAINT "customer_order_items_orderId_fk";

-- DropForeignKey
ALTER TABLE "customer_order_items" DROP CONSTRAINT "customer_order_items_productId_fk";

-- DropForeignKey
ALTER TABLE "customer_order_items" DROP CONSTRAINT "customer_order_items_tenantId_fk";

-- DropForeignKey
ALTER TABLE "customer_order_payments" DROP CONSTRAINT "customer_order_payments_journalId_fk";

-- DropForeignKey
ALTER TABLE "customer_order_payments" DROP CONSTRAINT "customer_order_payments_orderId_fk";

-- DropForeignKey
ALTER TABLE "customer_order_payments" DROP CONSTRAINT "customer_order_payments_tenantId_fk";

-- DropForeignKey
ALTER TABLE "customer_orders" DROP CONSTRAINT "customer_orders_assignedBakerId_fk";

-- DropForeignKey
ALTER TABLE "customer_orders" DROP CONSTRAINT "customer_orders_batchId_fk";

-- DropForeignKey
ALTER TABLE "customer_orders" DROP CONSTRAINT "customer_orders_branchId_fk";

-- DropForeignKey
ALTER TABLE "customer_orders" DROP CONSTRAINT "customer_orders_customerId_fk";

-- DropForeignKey
ALTER TABLE "customer_orders" DROP CONSTRAINT "customer_orders_journalId_fk";

-- DropForeignKey
ALTER TABLE "customer_orders" DROP CONSTRAINT "customer_orders_productId_fk";

-- DropForeignKey
ALTER TABLE "customer_orders" DROP CONSTRAINT "customer_orders_tenantId_fk";

-- DropForeignKey
ALTER TABLE "customer_receivables" DROP CONSTRAINT "customer_receivables_customerId_fk";

-- DropForeignKey
ALTER TABLE "customer_receivables" DROP CONSTRAINT "customer_receivables_tenantId_fk";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_tenantId_fk";

-- DropForeignKey
ALTER TABLE "deliveries" DROP CONSTRAINT "deliveries_orderId_fk";

-- DropForeignKey
ALTER TABLE "deliveries" DROP CONSTRAINT "deliveries_saleId_fk";

-- DropForeignKey
ALTER TABLE "deliveries" DROP CONSTRAINT "deliveries_tenantId_fk";

-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_tenantId_fk";

-- DropForeignKey
ALTER TABLE "employee_attendance" DROP CONSTRAINT "employee_attendance_employeeId_fk";

-- DropForeignKey
ALTER TABLE "employee_attendance" DROP CONSTRAINT "employee_attendance_tenantId_fk";

-- DropForeignKey
ALTER TABLE "employee_leaves" DROP CONSTRAINT "employee_leaves_employeeId_fk";

-- DropForeignKey
ALTER TABLE "employee_leaves" DROP CONSTRAINT "employee_leaves_tenantId_fk";

-- DropForeignKey
ALTER TABLE "employee_shifts" DROP CONSTRAINT "employee_shifts_branchId_fk";

-- DropForeignKey
ALTER TABLE "employee_shifts" DROP CONSTRAINT "employee_shifts_employeeId_fk";

-- DropForeignKey
ALTER TABLE "employee_shifts" DROP CONSTRAINT "employee_shifts_tenantId_fk";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_branchId_fk";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_departmentId_fk";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_positionId_fk";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_tenantId_fk";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_userId_fk";

-- DropForeignKey
ALTER TABLE "expense_categories" DROP CONSTRAINT "expense_categories_accountId_fk";

-- DropForeignKey
ALTER TABLE "expense_categories" DROP CONSTRAINT "expense_categories_tenantId_fk";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_accountId_fk";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_branchId_fk";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_categoryId_fk";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_journalId_fk";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_tenantId_fk";

-- DropForeignKey
ALTER TABLE "finished_lots" DROP CONSTRAINT "finished_lots_batchId_fk";

-- DropForeignKey
ALTER TABLE "finished_lots" DROP CONSTRAINT "finished_lots_productId_fk";

-- DropForeignKey
ALTER TABLE "finished_lots" DROP CONSTRAINT "finished_lots_tenantId_fk";

-- DropForeignKey
ALTER TABLE "finished_lots" DROP CONSTRAINT "finished_lots_variantId_fk";

-- DropForeignKey
ALTER TABLE "finished_lots" DROP CONSTRAINT "finished_lots_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "finished_movements" DROP CONSTRAINT "finished_movements_lotId_fk";

-- DropForeignKey
ALTER TABLE "finished_movements" DROP CONSTRAINT "finished_movements_productId_fk";

-- DropForeignKey
ALTER TABLE "finished_movements" DROP CONSTRAINT "finished_movements_tenantId_fk";

-- DropForeignKey
ALTER TABLE "finished_movements" DROP CONSTRAINT "finished_movements_variantId_fk";

-- DropForeignKey
ALTER TABLE "finished_movements" DROP CONSTRAINT "finished_movements_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "finished_stock" DROP CONSTRAINT "finished_stock_productId_fk";

-- DropForeignKey
ALTER TABLE "finished_stock" DROP CONSTRAINT "finished_stock_tenantId_fk";

-- DropForeignKey
ALTER TABLE "finished_stock" DROP CONSTRAINT "finished_stock_variantId_fk";

-- DropForeignKey
ALTER TABLE "finished_stock" DROP CONSTRAINT "finished_stock_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "fiscal_periods" DROP CONSTRAINT "fiscal_periods_tenantId_fk";

-- DropForeignKey
ALTER TABLE "goods_receipt_items" DROP CONSTRAINT "goods_receipt_items_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "goods_receipt_items" DROP CONSTRAINT "goods_receipt_items_orderItemId_fk";

-- DropForeignKey
ALTER TABLE "goods_receipt_items" DROP CONSTRAINT "goods_receipt_items_qualityCheckId_fk";

-- DropForeignKey
ALTER TABLE "goods_receipt_items" DROP CONSTRAINT "goods_receipt_items_receiptId_fk";

-- DropForeignKey
ALTER TABLE "goods_receipt_items" DROP CONSTRAINT "goods_receipt_items_tenantId_fk";

-- DropForeignKey
ALTER TABLE "goods_receipt_items" DROP CONSTRAINT "goods_receipt_items_unitId_fk";

-- DropForeignKey
ALTER TABLE "goods_receipts" DROP CONSTRAINT "goods_receipts_orderId_fk";

-- DropForeignKey
ALTER TABLE "goods_receipts" DROP CONSTRAINT "goods_receipts_supplierId_fk";

-- DropForeignKey
ALTER TABLE "goods_receipts" DROP CONSTRAINT "goods_receipts_tenantId_fk";

-- DropForeignKey
ALTER TABLE "goods_receipts" DROP CONSTRAINT "goods_receipts_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "hygiene_checklists" DROP CONSTRAINT "hygiene_checklists_tenantId_fk";

-- DropForeignKey
ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_tenantId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_allergens" DROP CONSTRAINT "ingredient_allergens_allergenId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_allergens" DROP CONSTRAINT "ingredient_allergens_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_allergens" DROP CONSTRAINT "ingredient_allergens_tenantId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_lots" DROP CONSTRAINT "ingredient_lots_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_lots" DROP CONSTRAINT "ingredient_lots_supplierId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_lots" DROP CONSTRAINT "ingredient_lots_tenantId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_lots" DROP CONSTRAINT "ingredient_lots_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_movements" DROP CONSTRAINT "ingredient_movements_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_movements" DROP CONSTRAINT "ingredient_movements_lotId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_movements" DROP CONSTRAINT "ingredient_movements_tenantId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_movements" DROP CONSTRAINT "ingredient_movements_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_stock" DROP CONSTRAINT "ingredient_stock_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_stock" DROP CONSTRAINT "ingredient_stock_tenantId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_stock" DROP CONSTRAINT "ingredient_stock_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_suppliers" DROP CONSTRAINT "ingredient_suppliers_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_suppliers" DROP CONSTRAINT "ingredient_suppliers_supplierId_fk";

-- DropForeignKey
ALTER TABLE "ingredient_suppliers" DROP CONSTRAINT "ingredient_suppliers_tenantId_fk";

-- DropForeignKey
ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_baseUnitId_fk";

-- DropForeignKey
ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_categoryId_fk";

-- DropForeignKey
ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_preferredSupplierId_fk";

-- DropForeignKey
ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_purchaseUnitId_fk";

-- DropForeignKey
ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_tenantId_fk";

-- DropForeignKey
ALTER TABLE "job_positions" DROP CONSTRAINT "job_positions_departmentId_fk";

-- DropForeignKey
ALTER TABLE "job_positions" DROP CONSTRAINT "job_positions_tenantId_fk";

-- DropForeignKey
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_branchId_fk";

-- DropForeignKey
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_reversalOfId_fk";

-- DropForeignKey
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_tenantId_fk";

-- DropForeignKey
ALTER TABLE "journal_lines" DROP CONSTRAINT "journal_lines_accountId_fk";

-- DropForeignKey
ALTER TABLE "journal_lines" DROP CONSTRAINT "journal_lines_branchId_fk";

-- DropForeignKey
ALTER TABLE "journal_lines" DROP CONSTRAINT "journal_lines_entryId_fk";

-- DropForeignKey
ALTER TABLE "journal_lines" DROP CONSTRAINT "journal_lines_tenantId_fk";

-- DropForeignKey
ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_tenantId_fk";

-- DropForeignKey
ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_userId_fk";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_tenantId_fk";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fk";

-- DropForeignKey
ALTER TABLE "number_sequences" DROP CONSTRAINT "number_sequences_tenantId_fk";

-- DropForeignKey
ALTER TABLE "offline_sync_records" DROP CONSTRAINT "offline_sync_records_tenantId_fk";

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_tenantId_fk";

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_userId_fk";

-- DropForeignKey
ALTER TABLE "payroll_items" DROP CONSTRAINT "payroll_items_employeeId_fk";

-- DropForeignKey
ALTER TABLE "payroll_items" DROP CONSTRAINT "payroll_items_runId_fk";

-- DropForeignKey
ALTER TABLE "payroll_items" DROP CONSTRAINT "payroll_items_tenantId_fk";

-- DropForeignKey
ALTER TABLE "payroll_runs" DROP CONSTRAINT "payroll_runs_journalId_fk";

-- DropForeignKey
ALTER TABLE "payroll_runs" DROP CONSTRAINT "payroll_runs_tenantId_fk";

-- DropForeignKey
ALTER TABLE "price_history" DROP CONSTRAINT "price_history_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "price_history" DROP CONSTRAINT "price_history_supplierId_fk";

-- DropForeignKey
ALTER TABLE "price_history" DROP CONSTRAINT "price_history_tenantId_fk";

-- DropForeignKey
ALTER TABLE "product_allergens" DROP CONSTRAINT "product_allergens_allergenId_fk";

-- DropForeignKey
ALTER TABLE "product_allergens" DROP CONSTRAINT "product_allergens_productId_fk";

-- DropForeignKey
ALTER TABLE "product_allergens" DROP CONSTRAINT "product_allergens_tenantId_fk";

-- DropForeignKey
ALTER TABLE "product_barcodes" DROP CONSTRAINT "product_barcodes_productId_fk";

-- DropForeignKey
ALTER TABLE "product_barcodes" DROP CONSTRAINT "product_barcodes_tenantId_fk";

-- DropForeignKey
ALTER TABLE "product_barcodes" DROP CONSTRAINT "product_barcodes_unitId_fk";

-- DropForeignKey
ALTER TABLE "product_barcodes" DROP CONSTRAINT "product_barcodes_variantId_fk";

-- DropForeignKey
ALTER TABLE "product_modifiers" DROP CONSTRAINT "product_modifiers_tenantId_fk";

-- DropForeignKey
ALTER TABLE "product_prices" DROP CONSTRAINT "product_prices_branchId_fk";

-- DropForeignKey
ALTER TABLE "product_prices" DROP CONSTRAINT "product_prices_productId_fk";

-- DropForeignKey
ALTER TABLE "product_prices" DROP CONSTRAINT "product_prices_tenantId_fk";

-- DropForeignKey
ALTER TABLE "product_prices" DROP CONSTRAINT "product_prices_variantId_fk";

-- DropForeignKey
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_productId_fk";

-- DropForeignKey
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_tenantId_fk";

-- DropForeignKey
ALTER TABLE "production_batch_employees" DROP CONSTRAINT "production_batch_employees_batchId_fk";

-- DropForeignKey
ALTER TABLE "production_batch_employees" DROP CONSTRAINT "production_batch_employees_employeeId_fk";

-- DropForeignKey
ALTER TABLE "production_batch_employees" DROP CONSTRAINT "production_batch_employees_tenantId_fk";

-- DropForeignKey
ALTER TABLE "production_batch_ingredients" DROP CONSTRAINT "production_batch_ingredients_batchId_fk";

-- DropForeignKey
ALTER TABLE "production_batch_ingredients" DROP CONSTRAINT "production_batch_ingredients_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "production_batch_ingredients" DROP CONSTRAINT "production_batch_ingredients_lotId_fk";

-- DropForeignKey
ALTER TABLE "production_batch_ingredients" DROP CONSTRAINT "production_batch_ingredients_tenantId_fk";

-- DropForeignKey
ALTER TABLE "production_batch_ingredients" DROP CONSTRAINT "production_batch_ingredients_unitId_fk";

-- DropForeignKey
ALTER TABLE "production_batches" DROP CONSTRAINT "production_batches_branchId_fk";

-- DropForeignKey
ALTER TABLE "production_batches" DROP CONSTRAINT "production_batches_costSnapshotId_fk";

-- DropForeignKey
ALTER TABLE "production_batches" DROP CONSTRAINT "production_batches_planId_fk";

-- DropForeignKey
ALTER TABLE "production_batches" DROP CONSTRAINT "production_batches_productId_fk";

-- DropForeignKey
ALTER TABLE "production_batches" DROP CONSTRAINT "production_batches_recipeVersionId_fk";

-- DropForeignKey
ALTER TABLE "production_batches" DROP CONSTRAINT "production_batches_tenantId_fk";

-- DropForeignKey
ALTER TABLE "production_batches" DROP CONSTRAINT "production_batches_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "production_plan_items" DROP CONSTRAINT "production_plan_items_assignedTo_fk";

-- DropForeignKey
ALTER TABLE "production_plan_items" DROP CONSTRAINT "production_plan_items_planId_fk";

-- DropForeignKey
ALTER TABLE "production_plan_items" DROP CONSTRAINT "production_plan_items_productId_fk";

-- DropForeignKey
ALTER TABLE "production_plan_items" DROP CONSTRAINT "production_plan_items_recipeVersionId_fk";

-- DropForeignKey
ALTER TABLE "production_plan_items" DROP CONSTRAINT "production_plan_items_tenantId_fk";

-- DropForeignKey
ALTER TABLE "production_plans" DROP CONSTRAINT "production_plans_branchId_fk";

-- DropForeignKey
ALTER TABLE "production_plans" DROP CONSTRAINT "production_plans_productId_fk";

-- DropForeignKey
ALTER TABLE "production_plans" DROP CONSTRAINT "production_plans_recipeVersionId_fk";

-- DropForeignKey
ALTER TABLE "production_plans" DROP CONSTRAINT "production_plans_tenantId_fk";

-- DropForeignKey
ALTER TABLE "production_stage_logs" DROP CONSTRAINT "production_stage_logs_batchId_fk";

-- DropForeignKey
ALTER TABLE "production_stage_logs" DROP CONSTRAINT "production_stage_logs_employeeId_fk";

-- DropForeignKey
ALTER TABLE "production_stage_logs" DROP CONSTRAINT "production_stage_logs_stageId_fk";

-- DropForeignKey
ALTER TABLE "production_stage_logs" DROP CONSTRAINT "production_stage_logs_tenantId_fk";

-- DropForeignKey
ALTER TABLE "production_stages" DROP CONSTRAINT "production_stages_tenantId_fk";

-- DropForeignKey
ALTER TABLE "production_waste" DROP CONSTRAINT "production_waste_batchId_fk";

-- DropForeignKey
ALTER TABLE "production_waste" DROP CONSTRAINT "production_waste_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "production_waste" DROP CONSTRAINT "production_waste_productId_fk";

-- DropForeignKey
ALTER TABLE "production_waste" DROP CONSTRAINT "production_waste_tenantId_fk";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_baseUnitId_fk";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_categoryId_fk";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_recipeId_fk";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_tenantId_fk";

-- DropForeignKey
ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_orderId_fk";

-- DropForeignKey
ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_tenantId_fk";

-- DropForeignKey
ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_unitId_fk";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_branchId_fk";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_supplierId_fk";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_tenantId_fk";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "purchase_request_items" DROP CONSTRAINT "purchase_request_items_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "purchase_request_items" DROP CONSTRAINT "purchase_request_items_requestId_fk";

-- DropForeignKey
ALTER TABLE "purchase_request_items" DROP CONSTRAINT "purchase_request_items_tenantId_fk";

-- DropForeignKey
ALTER TABLE "purchase_request_items" DROP CONSTRAINT "purchase_request_items_unitId_fk";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_branchId_fk";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_tenantId_fk";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "purchase_return_items" DROP CONSTRAINT "purchase_return_items_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "purchase_return_items" DROP CONSTRAINT "purchase_return_items_returnId_fk";

-- DropForeignKey
ALTER TABLE "purchase_return_items" DROP CONSTRAINT "purchase_return_items_tenantId_fk";

-- DropForeignKey
ALTER TABLE "purchase_returns" DROP CONSTRAINT "purchase_returns_receiptId_fk";

-- DropForeignKey
ALTER TABLE "purchase_returns" DROP CONSTRAINT "purchase_returns_supplierId_fk";

-- DropForeignKey
ALTER TABLE "purchase_returns" DROP CONSTRAINT "purchase_returns_tenantId_fk";

-- DropForeignKey
ALTER TABLE "quality_inspections" DROP CONSTRAINT "quality_inspections_employeeId_fk";

-- DropForeignKey
ALTER TABLE "quality_inspections" DROP CONSTRAINT "quality_inspections_tenantId_fk";

-- DropForeignKey
ALTER TABLE "recall_records" DROP CONSTRAINT "recall_records_batchId_fk";

-- DropForeignKey
ALTER TABLE "recall_records" DROP CONSTRAINT "recall_records_ingredientLotId_fk";

-- DropForeignKey
ALTER TABLE "recall_records" DROP CONSTRAINT "recall_records_tenantId_fk";

-- DropForeignKey
ALTER TABLE "recipe_cost_snapshots" DROP CONSTRAINT "recipe_cost_snapshots_recipeId_fk";

-- DropForeignKey
ALTER TABLE "recipe_cost_snapshots" DROP CONSTRAINT "recipe_cost_snapshots_tenantId_fk";

-- DropForeignKey
ALTER TABLE "recipe_cost_snapshots" DROP CONSTRAINT "recipe_cost_snapshots_versionId_fk";

-- DropForeignKey
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_ingredientId_fk";

-- DropForeignKey
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_tenantId_fk";

-- DropForeignKey
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_unitId_fk";

-- DropForeignKey
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_versionId_fk";

-- DropForeignKey
ALTER TABLE "recipe_instructions" DROP CONSTRAINT "recipe_instructions_tenantId_fk";

-- DropForeignKey
ALTER TABLE "recipe_instructions" DROP CONSTRAINT "recipe_instructions_versionId_fk";

-- DropForeignKey
ALTER TABLE "recipe_versions" DROP CONSTRAINT "recipe_versions_recipeId_fk";

-- DropForeignKey
ALTER TABLE "recipe_versions" DROP CONSTRAINT "recipe_versions_tenantId_fk";

-- DropForeignKey
ALTER TABLE "recipes" DROP CONSTRAINT "recipes_productId_fk";

-- DropForeignKey
ALTER TABLE "recipes" DROP CONSTRAINT "recipes_tenantId_fk";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_fk";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_roleId_fk";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_tenantId_fk";

-- DropForeignKey
ALTER TABLE "roles" DROP CONSTRAINT "roles_tenantId_fk";

-- DropForeignKey
ALTER TABLE "salary_advances" DROP CONSTRAINT "salary_advances_employeeId_fk";

-- DropForeignKey
ALTER TABLE "salary_advances" DROP CONSTRAINT "salary_advances_tenantId_fk";

-- DropForeignKey
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_lotId_fk";

-- DropForeignKey
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_productId_fk";

-- DropForeignKey
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_saleId_fk";

-- DropForeignKey
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_tenantId_fk";

-- DropForeignKey
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_variantId_fk";

-- DropForeignKey
ALTER TABLE "sale_payments" DROP CONSTRAINT "sale_payments_saleId_fk";

-- DropForeignKey
ALTER TABLE "sale_payments" DROP CONSTRAINT "sale_payments_tenantId_fk";

-- DropForeignKey
ALTER TABLE "sale_return_items" DROP CONSTRAINT "sale_return_items_productId_fk";

-- DropForeignKey
ALTER TABLE "sale_return_items" DROP CONSTRAINT "sale_return_items_returnId_fk";

-- DropForeignKey
ALTER TABLE "sale_return_items" DROP CONSTRAINT "sale_return_items_saleItemId_fk";

-- DropForeignKey
ALTER TABLE "sale_return_items" DROP CONSTRAINT "sale_return_items_tenantId_fk";

-- DropForeignKey
ALTER TABLE "sale_returns" DROP CONSTRAINT "sale_returns_journalId_fk";

-- DropForeignKey
ALTER TABLE "sale_returns" DROP CONSTRAINT "sale_returns_saleId_fk";

-- DropForeignKey
ALTER TABLE "sale_returns" DROP CONSTRAINT "sale_returns_tenantId_fk";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_branchId_fk";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_cashSessionId_fk";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_cashierId_fk";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_customerId_fk";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_journalId_fk";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_tenantId_fk";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_tenantId_fk";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fk";

-- DropForeignKey
ALTER TABLE "stock_adjustments" DROP CONSTRAINT "stock_adjustments_tenantId_fk";

-- DropForeignKey
ALTER TABLE "stock_adjustments" DROP CONSTRAINT "stock_adjustments_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "stock_count_lines" DROP CONSTRAINT "stock_count_lines_countId_fk";

-- DropForeignKey
ALTER TABLE "stock_count_lines" DROP CONSTRAINT "stock_count_lines_tenantId_fk";

-- DropForeignKey
ALTER TABLE "stock_counts" DROP CONSTRAINT "stock_counts_tenantId_fk";

-- DropForeignKey
ALTER TABLE "stock_counts" DROP CONSTRAINT "stock_counts_warehouseId_fk";

-- DropForeignKey
ALTER TABLE "supplier_invoices" DROP CONSTRAINT "supplier_invoices_receiptId_fk";

-- DropForeignKey
ALTER TABLE "supplier_invoices" DROP CONSTRAINT "supplier_invoices_supplierId_fk";

-- DropForeignKey
ALTER TABLE "supplier_invoices" DROP CONSTRAINT "supplier_invoices_tenantId_fk";

-- DropForeignKey
ALTER TABLE "supplier_payables" DROP CONSTRAINT "supplier_payables_supplierId_fk";

-- DropForeignKey
ALTER TABLE "supplier_payables" DROP CONSTRAINT "supplier_payables_tenantId_fk";

-- DropForeignKey
ALTER TABLE "supplier_payments" DROP CONSTRAINT "supplier_payments_invoiceId_fk";

-- DropForeignKey
ALTER TABLE "supplier_payments" DROP CONSTRAINT "supplier_payments_supplierId_fk";

-- DropForeignKey
ALTER TABLE "supplier_payments" DROP CONSTRAINT "supplier_payments_tenantId_fk";

-- DropForeignKey
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_tenantId_fk";

-- DropForeignKey
ALTER TABLE "system_settings" DROP CONSTRAINT "system_settings_tenantId_fk";

-- DropForeignKey
ALTER TABLE "temperature_logs" DROP CONSTRAINT "temperature_logs_tenantId_fk";

-- DropForeignKey
ALTER TABLE "unit_conversions" DROP CONSTRAINT "unit_conversions_fromUnitId_fk";

-- DropForeignKey
ALTER TABLE "unit_conversions" DROP CONSTRAINT "unit_conversions_tenantId_fk";

-- DropForeignKey
ALTER TABLE "unit_conversions" DROP CONSTRAINT "unit_conversions_toUnitId_fk";

-- DropForeignKey
ALTER TABLE "units_of_measure" DROP CONSTRAINT "units_of_measure_tenantId_fk";

-- DropForeignKey
ALTER TABLE "user_branch_access" DROP CONSTRAINT "user_branch_access_branchId_fk";

-- DropForeignKey
ALTER TABLE "user_branch_access" DROP CONSTRAINT "user_branch_access_tenantId_fk";

-- DropForeignKey
ALTER TABLE "user_branch_access" DROP CONSTRAINT "user_branch_access_userId_fk";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_branchId_fk";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_roleId_fk";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_tenantId_fk";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_userId_fk";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_tenantId_fk";

-- DropForeignKey
ALTER TABLE "warehouse_transfers" DROP CONSTRAINT "warehouse_transfers_fromWarehouse_fk";

-- DropForeignKey
ALTER TABLE "warehouse_transfers" DROP CONSTRAINT "warehouse_transfers_tenantId_fk";

-- DropForeignKey
ALTER TABLE "warehouse_transfers" DROP CONSTRAINT "warehouse_transfers_toWarehouse_fk";

-- DropForeignKey
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_branchId_fk";

-- DropForeignKey
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_tenantId_fk";

-- AlterTable
ALTER TABLE "production_batches" ADD COLUMN     "sourceWarehouseId" TEXT;
