# Data model overview

The authoritative schema is `prisma/schema.prisma`. Referential integrity constraints are applied by the `add_integrity_constraints` migration. The generated client lives in `src/generated/prisma`.

## Core domains

### Identity and tenancy

`Tenant` → `Branch`, `User`, `Role`, `UserRole`, `UserBranchAccess`, `Session`. Roles carry `RolePermission` rows; `OWNER` also receives all codes from the permission catalogue. Every business table carries `tenantId`.

### Master data

`Product`, `Ingredient`, `Category`, `UnitOfMeasure`, `Supplier`, `Customer`, `Employee`, `Warehouse`, `Account`, `ExpenseCategory`. Products and ingredients store bilingual names, SKUs, minimum stock and costing fields.

### Purchasing

`PurchaseOrder` → `PurchaseOrderItem`, `GoodsReceipt` → `GoodsReceiptItem`, `SupplierPayable`, `SupplierPayment`. Receiving creates FEFO lots (`IngredientLot`) and stock ledger entries (`IngredientMovement`) inside a single transaction.

### Inventory

`IngredientStock`, `FinishedStock`, `IngredientLot`, `FinishedLot`, `StockAdjustment`, `StockCount`, `StockCountLine`, `WarehouseTransfer`, `IngredientMovement`, `FinishedMovement`. Aggregate stock rows and lot rows are both maintained so valuation and FEFO consumption remain consistent.

### Recipes and production

`Recipe` → `RecipeVersion` → `RecipeLine`, `RecipeInstruction`, `RecipeCostSnapshot`. `ProductionPlan` and `ProductionBatch` track planned and actual output, rejection and waste. Completion requires a passing `QualityInspection` and consumes ingredients FEFO before adding finished lots.

### Sales

`Sale` → `SaleItem`, `SalePayment`, `SaleReturn`, `SaleReturnItem`, `CustomerOrder` → `CustomerOrderItem` / `CustomerOrderPayment`, `CashSession`. Sales require payments covering the total, consume finished lots FEFO, and post revenue/COGS journals.

### Accounting

`JournalEntry` → `JournalLine`, `CustomerReceivable`, `SupplierPayable`. Entries are immutable once posted. `reverseJournal` creates a new compensating entry and marks the original `REVERSED`.

### Quality

`QualityInspection` references a receipt, batch or product. A passing batch inspection sets `ProductionBatch.qualityApproved`, enabling completion.

## Conventions

- Money and quantities use `NUMERIC(18,4)`; percentages use `NUMERIC(9,4)`.
- IDs are scalar `cuid()` strings. Relations are joined manually in services to avoid generated-client include/nested-type issues.
- All financial and stock mutations are wrapped in `db.$transaction`.
- Legacy/destructive resets are not part of the supported workflow; use migrations only.
