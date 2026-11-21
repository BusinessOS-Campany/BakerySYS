/**
 * Development seed. Idempotent: if the demo tenant exists it does nothing.
 * Creates a complete, interconnected bakery dataset and exercises the real
 * services (purchase receipt → production → sale → accounting).
 * Run: npm run db:seed
 */
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../src/lib/auth/admin";
import { calcRecipeCost, round } from "../src/lib/calculations";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "../src/lib/permissions/catalog";
import type { AuthContext } from "../src/lib/auth/session";
import { receiveIngredient, addFinishedStock } from "../src/lib/inventory/stock";
import { postJournal, ACCOUNT_CODES } from "../src/lib/accounting/ledger";
import { createProductionPlan, createBatch, completeBatch } from "../src/lib/production/service";
import { createPurchaseOrder, approvePurchaseOrder, receiveGoods } from "../src/lib/purchasing/service";
import { createSale } from "../src/lib/sales/service";
import { nextNumber } from "../src/lib/sequence";

const DEMO_PASSWORD = "Bakery@2026";
const SLUG = "golden-crust";
async function main() {
  const existing = await db.tenant.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log("[seed] Demo tenant already exists — nothing was changed.");
    return;
  }

  const tenant = await db.tenant.create({
    data: {
      slug: SLUG, nameAr: "مخبز القشرة الذهبية", nameEn: "Golden Crust Bakery",
      currencyCode: "YER", decimalPlaces: 2, locale: "ar", timezone: "Asia/Aden",
      taxEnabled: false, taxRate: 0, invoicePrefix: "INV",
      address: "صنعاء، اليمن", phone: "+967 1 000 000", email: "info@goldencrust.demo",
    },
  });
  const tid = tenant.id;

  const branchMain = await db.branch.create({
    data: { tenantId: tid, code: "MAIN", nameAr: "الفرع الرئيسي", nameEn: "Main Branch", address: "صنعاء" },
  });
  const branchNorth = await db.branch.create({
    data: { tenantId: tid, code: "NORTH", nameAr: "فرع الشمال", nameEn: "North Branch", address: "صنعاء - شارع الستين" },
  });
  const whRaw = await db.warehouse.create({
    data: { tenantId: tid, branchId: branchMain.id, code: "RAW-MAIN", nameAr: "مخزن المواد الخام", nameEn: "Raw Material Warehouse", kind: "RAW" },
  });
  const whFinished = await db.warehouse.create({
    data: { tenantId: tid, branchId: branchMain.id, code: "FG-MAIN", nameAr: "مخزن المنتجات التامة", nameEn: "Finished Goods Warehouse", kind: "FINISHED" },
  });
  const whNorth = await db.warehouse.create({
    data: { tenantId: tid, branchId: branchNorth.id, code: "FG-NORTH", nameAr: "مخزن فرع الشمال", nameEn: "North Branch Warehouse", kind: "BOTH" },
  });

  // Permissions catalogue + configurable roles
  await db.permission.createMany({
    data: PERMISSIONS.map((code) => ({ code, module: code.split(".")[0], description: code })),
  });
  const roleIds = new Map<string, string>();
  for (const [code, nameEn, nameAr] of [
    ["OWNER", "Owner", "المالك"],
    ["GENERAL_MANAGER", "General Manager", "المدير العام"],
    ["ACCOUNTANT", "Accountant", "المحاسب"],
    ["PRODUCTION_MANAGER", "Production Manager", "مدير الإنتاج"],
    ["BAKER", "Baker", "الخباز"],
    ["CASHIER", "Cashier", "أمين الصندوق"],
    ["STOREKEEPER", "Storekeeper", "أمين المخزن"],
    ["SALES_EMPLOYEE", "Sales Employee", "موظف المبيعات"],
    ["SUPERVISOR", "Supervisor", "المشرف"],
  ] as const) {
    const role = await db.role.create({
      data: { tenantId: tid, code, nameEn, nameAr, isSystem: true },
    });
    roleIds.set(code, role.id);
    await db.rolePermission.createMany({
      data: (DEFAULT_ROLE_PERMISSIONS[code] ?? []).map((permission) => ({
        tenantId: tid, roleId: role.id, permission,
      })),
    });
  }
  const passwordHash = hashPassword(DEMO_PASSWORD);
  const users = new Map<string, string>();
  for (const [code, email, nameArName, nameEn] of [
    ["OWNER", "owner@goldencrust.demo", "مالك المخبز", "Bakery Owner"],
    ["GENERAL_MANAGER", "manager@goldencrust.demo", "المدير العام", "General Manager"],
    ["ACCOUNTANT", "accountant@goldencrust.demo", "المحاسب", "Accountant"],
    ["PRODUCTION_MANAGER", "production@goldencrust.demo", "مدير الإنتاج", "Production Manager"],
    ["BAKER", "baker@goldencrust.demo", "الخباز", "Baker"],
    ["CASHIER", "cashier@goldencrust.demo", "أمين الصندوق", "Cashier"],
    ["STOREKEEPER", "storekeeper@goldencrust.demo", "أمين المخزن", "Storekeeper"],
    ["SALES_EMPLOYEE", "sales@goldencrust.demo", "موظف المبيعات", "Sales Employee"],
    ["SUPERVISOR", "supervisor@goldencrust.demo", "المشرف", "Supervisor"],
  ] as const) {
    const user = await db.user.create({
      data: { tenantId: tid, email, nameAr: nameArName, nameEn, passwordHash, locale: "ar" },
    });
    users.set(code, user.id);
    await db.userRole.create({
      data: { tenantId: tid, userId: user.id, roleId: roleIds.get(code)! },
    });
    await db.userBranchAccess.createMany({
      data: [branchMain.id, branchNorth.id].map((branchId) => ({
        tenantId: tid, userId: user.id, branchId,
      })),
    });
  }

  const admin = await db.user.create({
    data: {
      tenantId: tid,
      email: ADMIN_EMAIL,
      nameAr: "مدير النظام",
      nameEn: "System Admin",
      passwordHash: hashPassword(ADMIN_PASSWORD, 1),
      locale: "en",
    },
  });
  await db.userRole.create({
    data: { tenantId: tid, userId: admin.id, roleId: roleIds.get("OWNER")! },
  });

  // Chart of accounts
  const accounts = new Map<string, string>();
  for (const [code, nameEn, nameAr, type] of [
    [ACCOUNT_CODES.CASH, "Cash", "النقدية", "ASSET"],
    [ACCOUNT_CODES.BANK, "Bank", "البنك", "ASSET"],
    [ACCOUNT_CODES.RECEIVABLES, "Accounts Receivable", "المدينون", "ASSET"],
    [ACCOUNT_CODES.RAW_INVENTORY, "Raw Material Inventory", "مخزون المواد الخام", "ASSET"],
    [ACCOUNT_CODES.FINISHED_INVENTORY, "Finished Goods Inventory", "مخزون المنتجات التامة", "ASSET"],
    ["2200", "Tax Payable", "الضرائب المستحقة", "LIABILITY"],
    [ACCOUNT_CODES.PAYABLES, "Accounts Payable", "الدائنون", "LIABILITY"],
    [ACCOUNT_CODES.CUSTOMER_ADVANCES, "Customer Advances", "ospit deposits".replace("ospit ", "Customer "), "LIABILITY"],
    [ACCOUNT_CODES.EQUITY, "Owner Equity", "رأس المال", "EQUITY"],
    [ACCOUNT_CODES.SALES, "Sales Revenue", "إيراد المبيعات", "REVENUE"],
    [ACCOUNT_CODES.SALES_RETURNS, "Sales Returns", "مرتجعات المبيعات", "REVENUE"],
    [ACCOUNT_CODES.COGS, "Cost of Goods Sold", "تكلفة البضاعة المباعة", "COGS"],
    [ACCOUNT_CODES.OPERATING_EXPENSE, "Operating Expenses", "المصروفات التشغيلية", "EXPENSE"],
    [ACCOUNT_CODES.PAYROLL, "Payroll Expense", "مصروف الرواتب", "EXPENSE"],
  ] as const) {
    const account = await db.account.create({
      data: { tenantId: tid, code, nameEn, nameAr, type },
    });
    accounts.set(code, account.id);
  }
  await db.fiscalPeriod.create({
    data: {
      tenantId: tid, name: "FY2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"),
    },
  });
  await db.cashAccount.create({
    data: { tenantId: tid, code: "CASH-MAIN", nameAr: "الصندوق الرئيسي", nameEn: "Main Cash", accountId: accounts.get(ACCOUNT_CODES.CASH) },
  });

  // Units and conversions
  const units = new Map<string, string>();
  for (const [code, nameEn, nameAr, precision] of [
    ["g", "Gram", "جرام", 3], ["kg", "Kilogram", "كيلوجرام", 3],
    ["ml", "Millilitre", "ملليلتر", 3], ["L", "Litre", "لتر", 3],
    ["pcs", "Piece", "قطعة", 2], ["box", "Box", "علبة", 2],
  ] as const) {
    const unit = await db.unitOfMeasure.create({
      data: { tenantId: tid, code, nameEn, nameAr, precision },
    });
    units.set(code, unit.id);
  }
  for (const [from, to, factor] of [["g", "kg", 0.001], ["ml", "L", 0.001], ["pcs", "box", 1 / 12]] as const) {
    await db.unitConversion.create({
      data: { tenantId: tid, fromUnitId: units.get(from)!, toUnitId: units.get(to)!, factor },
    });
  }

  // Categories
  const categories = new Map<string, string>();
  for (const [code, nameEn, nameAr, kind] of [
    ["FLOUR", "Flour & Grains", "الدقيق والحبوب", "INGREDIENT"],
    ["DAIRY", "Dairy & Eggs", "الألبان والبيض", "INGREDIENT"],
    ["SWEET", "Sugar & Chocolate", "السكر والشوكولاتة", "INGREDIENT"],
    ["PACK", "Packaging", "التغليف", "INGREDIENT"],
    ["BREAD", "Bread", "الخبز", "PRODUCT"],
    ["CAKES", "Cakes", "الكيك", "PRODUCT"],
    ["PASTRY", "Pastries", "المعجنات", "PRODUCT"],
    ["COOKIES", "Cookies", "البسكويت", "PRODUCT"],
  ] as const) {
    const cat = await db.category.create({ data: { tenantId: tid, code, nameEn, nameAr, kind } });
    categories.set(code, cat.id);
  }

  // Suppliers
  const suppliers = new Map<string, string>();
  for (const [code, nameEn, nameAr, phone] of [
    ["SUP1", "Al-Nahrain Foods", "مؤسسة النهرين للأغذية", "+967 1 200 000"],
    ["SUP2", "Sana'a Dairy Co.", "شركة صنعاء للألبان", "+967 1 300 000"],
  ] as const) {
    const supplier = await db.supplier.create({
      data: {
        tenantId: tid, code, nameEn, nameAr, phone, contactName: nameEn,
        email: `${code.toLowerCase()}@example.demo`, paymentTermsDays: 30,
      },
    });
    suppliers.set(code, supplier.id);
  }

  // Ingredients — currentCost is always PER BASE UNIT
  const ingredients = new Map<string, string>();
  const ingredientData = [
    ["FLOUR", "Wheat Flour", "دقيق القمح", "FLOUR", "g", "kg", 0.25, 20000, 2000, true, "SUP1"],
    ["SUGAR", "Sugar", "السكر", "SWEET", "g", "kg", 0.20, 15000, 2000, false, "SUP1"],
    ["YEAST", "Instant Yeast", "الخميرة الفورية", "FLOUR", "g", "kg", 1.20, 1200, 200, true, "SUP1"],
    ["SALT", "Salt", "الملح", "FLOUR", "g", "kg", 0.05, 4000, 500, false, "SUP1"],
    ["EGGS", "Eggs", "البيض", "DAIRY", "pcs", "pcs", 45, 600, 60, true, "SUP2"],
    ["BUTTER", "Butter", "الزبدة", "DAIRY", "g", "kg", 1.10, 6000, 500, true, "SUP2"],
    ["MILK", "Milk", "الحليب", "DAIRY", "ml", "L", 0.35, 15000, 1000, true, "SUP2"],
    ["COCOA", "Cocoa Powder", "الكاكاو", "SWEET", "g", "kg", 1.80, 3000, 300, false, "SUP1"],
    ["CHOCH", "Chocolate", "الشوكولاتة", "SWEET", "g", "kg", 2.20, 3000, 300, true, "SUP1"],
    ["OIL", "Vegetable Oil", "الزيت النباتي", "SWEET", "ml", "L", 0.40, 8000, 1000, false, "SUP1"],
    ["BOX", "Cake Box", "علبة كيك", "PACK", "pcs", "box", 30, 500, 50, false, "SUP1"],
  ] as const;
  for (const [code, nameEn, nameAr, cat, base, purchase, cost, stock, minimum, expiry, supplier] of ingredientData) {
    const ingredient = await db.ingredient.create({
      data: {
        tenantId: tid, sku: `ING-${code}`, nameEn, nameAr,
        categoryId: categories.get(cat)!, baseUnitId: units.get(base)!,
        purchaseUnitId: units.get(purchase)!, conversionFactor: 1, currentCost: cost,
        minStock: minimum, maxStock: minimum * 10,
        preferredSupplierId: suppliers.get(supplier), trackExpiry: expiry,
      },
    });
    ingredients.set(code, ingredient.id);
    await db.ingredientSupplier.create({
      data: {
        tenantId: tid, ingredientId: ingredient.id, supplierId: suppliers.get(supplier)!,
        lastPrice: cost, isPreferred: true, leadTimeDays: 3,
      },
    });
  }

  // Products and recipes
  const products = new Map<string, string>();
  const recipes = new Map<string, string>();
  const productData = [
    ["BREAD", "Country Bread", "خبز بلدي", "BREAD", "pcs", 350, 2, [
      ["FLOUR", 500, "g"], ["YEAST", 8, "g"], ["SALT", 8, "g"], ["SUGAR", 10, "g"], ["MILK", 250, "ml"],
    ], 2, 0, 0, 0],
    ["CAKE", "Chocolate Cake", "كيك الشوكولاتة", "CAKES", "pcs", 4500, 3, [
      ["FLOUR", 1000, "g"], ["SUGAR", 500, "g"], ["EGGS", 10, "pcs"], ["BUTTER", 300, "g"],
      ["COCOA", 200, "g"], ["MILK", 500, "ml"], ["BOX", 1, "pcs"],
    ], 4, 800, 200, 150],
    ["CROISSANT", "Butter Croissant", "كرواسون بالزبدة", "PASTRY", "pcs", 550, 2, [
      ["FLOUR", 400, "g"], ["BUTTER", 150, "g"], ["MILK", 200, "ml"], ["SUGAR", 40, "g"], ["YEAST", 6, "g"],
    ], 4, 400, 100, 80],
    ["COOKIE", "Butter Cookies", "بسكويت الزبدة", "COOKIES", "pcs", 250, 7, [
      ["FLOUR", 500, "g"], ["BUTTER", 200, "g"], ["SUGAR", 180, "g"], ["EGGS", 2, "pcs"],
    ], 12, 250, 50, 40],
  ] as const;
  for (const [code, nameEn, nameAr, cat, unit, price, shelf, recipeLines, yieldQty, labor, packaging, overhead] of productData) {
    const product = await db.product.create({
      data: {
        tenantId: tid, sku: `PRD-${code}`, barcode: `608${code}000001`,
        nameEn, nameAr, categoryId: categories.get(cat)!, baseUnitId: units.get(unit)!,
        sellingPrice: price, costPrice: 0, shelfLifeDays: shelf, minStock: 20, maxStock: 500,
      },
    });
    products.set(code, product.id);
    const recipe = await db.recipe.create({
      data: {
        tenantId: tid, productId: product.id, nameEn: `${nameEn} Recipe`, nameAr: `وصفة ${nameAr}`,
        description: `Standard recipe for ${nameEn}`, prepMinutes: 30, bakeTempC: 180,
        bakeMinutes: 25, restMinutes: 20, yieldQuantity: yieldQty, portions: yieldQty,
        laborCost: labor, packagingCost: packaging, overheadCost: overhead,
        instructions: "Mix ingredients, knead, rest, bake until golden.", currentVersion: 1,
      },
    });
    recipes.set(code, recipe.id);
    const version = await db.recipeVersion.create({
      data: { tenantId: tid, recipeId: recipe.id, version: 1, notes: "Initial version" },
    });
    for (const [ingCode, qty, unitCode] of recipeLines) {
      await db.recipeIngredient.create({
        data: {
          tenantId: tid, versionId: version.id, ingredientId: ingredients.get(ingCode)!,
          quantity: qty, unitId: units.get(unitCode)!,
        },
      });
    }
    await db.recipeInstruction.createMany({
      data: [
        { tenantId: tid, versionId: version.id, step: 1, textEn: "Weigh all ingredients", textAr: "وزن جميع المكونات" },
        { tenantId: tid, versionId: version.id, step: 2, textEn: "Mix and rest", textAr: "الخلط والراحة" },
        { tenantId: tid, versionId: version.id, step: 3, textEn: "Bake at 180°C", textAr: "الخبز على 180 درجة" },
      ],
    });
    const calc = calcRecipeCost({
      ingredients: recipeLines.map(([ingCode, qty, unitCode]) => {
        const ing = ingredientData.find((i) => i[0] === ingCode)!;
        const cost = ing[6] as number;
        const baseQty = qty;
        return { quantity: qty, quantityInBase: baseQty, unitCostPerBase: cost };
      }),
      laborCost: labor, packagingCost: packaging, overheadCost: overhead,
      yieldQuantity: yieldQty, sellingPrice: price,
    });
    await db.recipeCostSnapshot.create({
      data: {
        tenantId: tid, recipeId: recipe.id, versionId: version.id,
        ingredientCost: calc.ingredientCost, laborCost: calc.laborCost,
        packagingCost: calc.packagingCost, overheadCost: calc.overheadCost,
        totalCost: calc.totalCost, costPerUnit: calc.costPerUnit,
        sellingPrice: price, grossProfit: calc.grossProfit, profitPercent: calc.profitPercent,
      },
    });
    await db.product.update({ where: { id: product.id }, data: { costPrice: calc.costPerUnit } });
  }
  for (const [code, nameEn, nameAr, price] of [
    ["SMALL", "Small", "صغير", 3500], ["MEDIUM", "Medium", "متوسط", 4500], ["LARGE", "Large", "كبير", 6500],
  ] as const) {
    await db.productVariant.create({
      data: {
        tenantId: tid, productId: products.get("CAKE")!, nameEn, nameAr,
        sku: `VAR-CAKE-${code}`, priceAdjustment: price - 4500,
      },
    });
  }
  await db.productModifier.createMany({
    data: [
      { tenantId: tid, nameEn: "Extra chocolate", nameAr: "شوكولاتة إضافية", price: 500 },
      { tenantId: tid, nameEn: "Candles", nameAr: "شموع", price: 150 },
    ],
  });
  for (const [code, nameEn, nameAr] of [
    ["MILK", "Milk", "الحليب"], ["EGGS", "Eggs", "البيض"], ["NUTS", "Nuts", "المكسرات"], ["GLUTEN", "Gluten", "الجلوتين"],
  ] as const) {
    await db.allergen.create({ data: { tenantId: tid, code, nameEn, nameAr } });
  }
  for (const [ingredientCode, allergenCode] of [["MILK", "MILK"], ["EGGS", "EGGS"]] as const) {
    await db.ingredientAllergen.create({
      data: {
        tenantId: tid, ingredientId: ingredients.get(ingredientCode)!,
        allergenId: (await db.allergen.findFirst({ where: { tenantId: tid, code: allergenCode } }))!.id,
      },
    });
  }
  for (const stage of [
    ["MIXING", "Mixing", "الخلط", 1], ["FERMENTATION", "Fermentation", "التخمر", 2],
    ["BAKING", "Baking", "الخبز", 3], ["COOLING", "Cooling", "التبريد", 4], ["FINISHING", "Finishing", "التشطيب", 5],
  ] as const) {
    await db.productionStage.create({
      data: { tenantId: tid, code: stage[0], nameEn: stage[1], nameAr: stage[2], sortOrder: stage[3] },
    });
  }

  // Opening stock, purchase order and receipt — all through real inventory services
  await db.$transaction(async (tx) => {
    for (const [code, , , , , , , stock] of ingredientData) {
      await receiveIngredient(tx, {
        tenantId: tid, warehouseId: whRaw.id, ingredientId: ingredients.get(code)!,
        quantity: stock, unitCost: ingredientData.find((i) => i[0] === code)![6],
        lotNumber: `OPEN-${code}`, supplierId: suppliers.get("SUP1"),
        expiryDate: new Date(Date.now() + 180 * 86_400_000),
        movementType: "PURCHASE_RECEIPT", note: "Opening stock", createdById: users.get("STOREKEEPER"),
      });
    }
  });

  const employeeIds = new Map<string, string>();
  for (const [code, nameEn, nameAr, position] of [
    [" baker", "Ahmed Baker", "أحمد الخباز", "Baker"],
    ["cashier", "Nadia Cashier", "نادية أمينة الصندوق", "Cashier"],
    ["store", "Omar Storekeeper", "عمر أمين المخزن", "Storekeeper"],
  ] as const) {
    const employee = await db.employee.create({
      data: {
        tenantId: tid, branchId: branchMain.id, number: `EMP-${code.trim().toUpperCase()}`,
        nameEn, nameAr, phone: "+967 700 000 000", salary: 120000,
        hireDate: new Date("2025-01-01"), positionId: null,
      },
    });
    employeeIds.set(code.trim(), employee.id);
  }
  await db.employeeAttendance.createMany({
    data: [...employeeIds.values()].map((employeeId) => ({
      tenantId: tid, employeeId, date: new Date(),
      clockIn: new Date(Date.now() - 8 * 3_600_000),
      clockOut: new Date(Date.now() - 1 * 3_600_000), workedMinutes: 420,
    })),
  });

  await db.$transaction(async (tx) => {
    const po = await createPurchaseOrder(tx, {
      tenantId: tid, supplierId: suppliers.get("SUP1")!, warehouseId: whRaw.id,
      branchId: branchMain.id, expectedDate: new Date(Date.now() + 5 * 86_400_000),
      createdById: users.get("STOREKEEPER")!,
      items: [
        { ingredientId: ingredients.get("FLOUR")!, quantity: 50, unitId: units.get("kg")!, unitPrice: 250 },
        { ingredientId: ingredients.get("SUGAR")!, quantity: 25, unitId: units.get("kg")!, unitPrice: 200 },
      ],
    });
    await approvePurchaseOrder(tx, { tenantId: tid, orderId: po.id, approvedById: users.get("OWNER")! });
    const poItems = await tx.purchaseOrderItem.findMany({ where: { orderId: po.id } });
    await receiveGoods(tx, {
      tenantId: tid, orderId: po.id, supplierId: suppliers.get("SUP1")!, warehouseId: whRaw.id,
      receivedById: users.get("STOREKEEPER")!,
      items: poItems.map((item) => ({
        orderItemId: item.id, ingredientId: item.ingredientId,
        quantity: Number(item.quantity), unitId: item.unitId, unitCost: Number(item.unitPrice),
        lotNumber: `RCV-${item.id.slice(-4)}`,
        expiryDate: new Date(Date.now() + 120 * 86_400_000),
      })),
    });
  });

  // Approved production: plan → batch → quality approval → completion
  let breadBatchId = "";
  await db.$transaction(async (tx) => {
    const plan = await createProductionPlan(tx, {
      tenantId: tid, branchId: branchMain.id, productId: products.get("BREAD")!,
      plannedQuantity: 40, plannedDate: new Date(), createdById: users.get("PRODUCTION_MANAGER")!,
    });
    await tx.productionPlan.update({ where: { id: plan.id }, data: { status: "APPROVED" } });
    const batch = await createBatch(tx, {
      tenantId: tid, planId: plan.id, branchId: branchMain.id, warehouseId: whFinished.id,
      sourceWarehouseId: whRaw.id,
      productId: products.get("BREAD")!, plannedQuantity: 40,
      createdById: users.get("PRODUCTION_MANAGER")!,
      employeeIds: [...employeeIds.values()],
    });
    await tx.productionBatch.update({
      where: { id: batch.id },
      data: { status: "QUALITY_CONTROL", stage: "QUALITY_CONTROL", startedAt: new Date(Date.now() - 3_600_000) },
    });
    await tx.qualityInspection.create({
      data: {
        tenantId: tid, referenceType: "BATCH", referenceId: batch.id,
        checkType: "FINAL_PRODUCT", standard: "Weight 250g ±10g, internal temp ≥ 90°C",
        actualResult: "Weight 255g, temp 94°C", result: "PASS",
        employeeId: employeeIds.get("baker"), checkedAt: new Date(),
      },
    });
    await completeBatch(tx, {
      tenantId: tid, batchId: batch.id, actualQuantity: 40, rejectedQuantity: 1, wasteQuantity: 1,
      completedById: users.get("PRODUCTION_MANAGER")!,
    });
    breadBatchId = batch.id;
  });

  // Additional approved finished stock for POS demo
  await db.$transaction(async (tx) => {
    for (const [code, qty] of [["CAKE", 30], ["CROISSANT", 60], ["COOKIE", 80]] as const) {
      await addFinishedStock(tx, {
        tenantId: tid, warehouseId: whFinished.id, productId: products.get(code)!,
        quantity: qty, unitCost: Number((await tx.product.findUnique({ where: { id: products.get(code)! } }))?.costPrice ?? 0),
        lotNumber: `FG-${code}-OPEN`, expiryDate: new Date(Date.now() + 3 * 86_400_000),
        qualityApproved: true, createdById: users.get("PRODUCTION_MANAGER")!,
      });
    }
  });

  // Customers, POS sales, payments, journals and cash session
  const customers = new Map<string, string>();
  for (const [code, nameEn, nameAr, phone] of [
    ["C1", "Salem Al-Ahmed", "سالم الأحمد", "+967 700 111 111"],
    ["C2", "Fatima Hassan", "فاطمة حسن", "+967 700 222 222"],
    ["C3", "Walk-in Customer", "عميل عابر", null],
  ] as const) {
    const customer = await db.customer.create({
      data: { tenantId: tid, code, nameEn, nameAr, phone, customerGroup: code === "C3" ? "RETAIL" : "VIP" },
    });
    customers.set(code, customer.id);
  }
  const register = await db.cashRegister.create({
    data: { tenantId: tid, branchId: branchMain.id, code: "REG-1", nameEn: "Main Counter", nameAr: "الكاونتر الرئيسي" },
  });
  let sessionId = "";
  await db.$transaction(async (tx) => {
    const session = await tx.cashSession.create({
      data: {
        tenantId: tid, registerId: register.id, cashierId: users.get("CASHIER")!,
        branchId: branchMain.id, openingBalance: 50000, status: "OPEN",
      },
    });
    sessionId = session.id;
    const auth: AuthContext = {
      user: {
        id: users.get("CASHIER")!, tenantId: tid, email: "cashier@goldencrust.demo",
        nameAr: "أمين الصندوق", nameEn: "Cashier", locale: "ar", avatarUrl: null,
      },
      tenant: {
        id: tid, slug: SLUG, nameAr: tenant.nameAr, nameEn: tenant.nameEn,
        currencyCode: "YER", decimalPlaces: 2, locale: "ar", timezone: "Asia/Aden",
        taxEnabled: false, taxRate: 0, invoicePrefix: "INV", logoUrl: null,
      },
      roles: ["CASHIER"], permissions: new Set(DEFAULT_ROLE_PERMISSIONS.CASHIER),
      branchIds: [branchMain.id, branchNorth.id], branchId: branchMain.id, locale: "ar",
    };
    const sale1 = await createSale(tx, auth, {
      branchId: branchMain.id, warehouseId: whFinished.id, customerId: customers.get("C1"),
      cashSessionId: session.id,
      lines: [
        { productId: products.get("BREAD")!, quantity: 6 },
        { productId: products.get("CAKE")!, quantity: 1 },
        { productId: products.get("CROISSANT")!, quantity: 4 },
      ],
      payments: [{ method: "CASH", amount: 8800 }],
    });
    const sale2 = await createSale(tx, auth, {
      branchId: branchMain.id, warehouseId: whFinished.id, customerId: customers.get("C2"),
      cashSessionId: session.id,
      lines: [
        { productId: products.get("COOKIE")!, quantity: 10 },
        { productId: products.get("BREAD")!, quantity: 4 },
      ],
      payments: [{ method: "CARD", amount: 3900 }],
    });
    if (sale1.duplicate || sale2.duplicate) throw new Error("Seed sale duplication detected");
  });

  // Expenses with double-entry postings
  for (const [nameEn, nameAr, amount, category] of [
    ["Electricity", "الكهرباء", 85000, "UTILITIES"],
    ["Cleaning supplies", "مواد التنظيف", 22500, "SUPPLIES"],
    ["Transport", "النقل", 18000, "TRANSPORT"],
  ] as const) {
    const categoryRow = await db.expenseCategory.upsert({
      where: { tenantId_code: { tenantId: tid, code: category } },
      create: { tenantId: tid, code: category, nameEn: category, nameAr: category, accountId: accounts.get(ACCOUNT_CODES.OPERATING_EXPENSE) },
      update: {},
    });
    await db.$transaction(async (tx) => {
      const number = await nextNumber(tx, tid, "EXP", "EXP-");
      const expense = await db.expense.create({
        data: {
          tenantId: tid, branchId: branchMain.id, categoryId: categoryRow.id,
          accountId: accounts.get(ACCOUNT_CODES.OPERATING_EXPENSE), number,
          expenseDate: new Date(), amount, vendor: "Local supplier",
          description: `${nameEn} / ${nameAr}`, method: "CASH",
          recordedBy: users.get("ACCOUNTANT")!,
        },
      });
      const journal = await postJournal(tx, {
        tenantId: tid, branchId: branchMain.id, description: `Expense ${number}`,
        referenceType: "EXPENSE", referenceId: expense.id, createdById: users.get("ACCOUNTANT")!,
        lines: [
          { code: ACCOUNT_CODES.OPERATING_EXPENSE, debit: amount, credit: 0 },
          { code: ACCOUNT_CODES.CASH, debit: 0, credit: amount },
        ],
      });
      await tx.expense.update({ where: { id: expense.id }, data: { journalId: journal.id } });
    });
  }

  // Custom cake order with deposit
  await db.$transaction(async (tx) => {
    const number = await nextNumber(tx, tid, "ORD", "ORD-");
    const order = await tx.customerOrder.create({
      data: {
        tenantId: tid, branchId: branchMain.id, number, customerId: customers.get("C2"),
        customerName: "فاطمة حسن", customerPhone: "+967 700 222 222",
        productId: products.get("CAKE")!, cakeSize: "Medium", weightKg: 2,
        shape: "Round", flavor: "Chocolate", filling: "Cream", decoration: "Flowers",
        message: "عيد ميلاد سعيد", allergies: "None",
        requestedPickup: new Date(Date.now() + 3 * 86_400_000),
        status: "DEPOSIT_PAID", quotedAmount: 4500, depositAmount: 2000,
        paidAmount: 2000, totalAmount: 4500, createdById: users.get("SALES_EMPLOYEE")!,
      },
    });
    await tx.customerOrderPayment.create({
      data: {
        tenantId: tid, orderId: order.id, amount: 2000, kind: "DEPOSIT", method: "CASH",
        recordedBy: users.get("SALES_EMPLOYEE")!,
      },
    });
    await tx.customerReceivable.create({
      data: {
        tenantId: tid, customerId: customers.get("C2")!, sourceType: "ORDER", sourceId: order.id,
        amount: 2500,
      },
    });
    await tx.customer.update({ where: { id: customers.get("C2")! }, data: { balance: 2500 } });
    const journal = await postJournal(tx, {
      tenantId: tid, description: `Customer deposit ${number}`,
      referenceType: "CUSTOMER_ORDER", referenceId: order.id, createdById: users.get("ACCOUNTANT")!,
      lines: [
        { code: ACCOUNT_CODES.CASH, debit: 2000, credit: 0 },
        { code: ACCOUNT_CODES.CUSTOMER_ADVANCES, debit: 0, credit: 2000 },
      ],
    });
    await tx.customerOrder.update({ where: { id: order.id }, data: { journalId: journal.id } });
  });

  // Quality, food-safety and notification samples
  await db.temperatureLog.createMany({
    data: [
      { tenantId: tid, location: "Refrigerator 1", temperature: 3.5, minAllowed: 0, maxAllowed: 5, ok: true, recordedBy: users.get("BAKER")! },
      { tenantId: tid, location: "Freezer 1", temperature: -18, minAllowed: -25, maxAllowed: -18, ok: true, recordedBy: users.get("STOREKEEPER")! },
      { tenantId: tid, location: "Oven 1", equipment: "Deck oven", temperature: 185, minAllowed: 175, maxAllowed: 195, ok: true, recordedBy: users.get("BAKER")! },
    ],
  });
  await db.qualityInspection.create({
    data: {
      tenantId: tid, referenceType: "RECEIPT", checkType: "INGREDIENT_RECEIVING",
      standard: "Flour moisture ≤ 14%", actualResult: "13.2%", result: "PASS",
      employeeId: employeeIds.get("store"),
    },
  });
  await db.notification.createMany({
    data: [
      {
        tenantId: tid, titleAr: "اكتملت دفعة الإنتاج", titleEn: "Production batch completed",
        bodyAr: "تم إنهاء دفعة الخبز بنجاح", bodyEn: "Bread batch completed successfully",
        kind: "PRODUCTION", link: `/production/${breadBatchId}`,
      },
      {
        tenantId: tid, titleAr: "طلب مخصص جديد", titleEn: "New custom order",
        bodyAr: "طلب كيك بانتظار التنفيذ", bodyEn: "A cake order is awaiting production",
        kind: "ORDER",
      },
    ],
  });

  console.log(`[seed] Demo tenant created: ${tenant.nameEn} (${tid})`);
  console.log(`[seed] Login with any seeded email and password: ${DEMO_PASSWORD}`);
  console.log(`[seed] Cash session: ${sessionId}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
