export type FieldType = "text" | "number" | "boolean" | "select" | "date" | "textarea";

export type ResourceField = {
  name: string;
  label: { ar: string; en: string };
  type: FieldType;
  required?: boolean;
  list?: boolean;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: { ar: string; en: string } }[];
  optionResource?: string;
  optionCodes?: string[];
  optionLabels?: Record<string, { ar: string; en: string }>;
  optionLabel?: "name" | "code";
  hidden?: boolean;
  autoCode?: string;
  defaultFrom?: string;
};

export type ResourceConfig = {
  key: string;
  model: string;
  entity: string;
  title: { ar: string; en: string };
  viewPermission: string;
  managePermission: string;
  searchFields: string[];
  fields: ResourceField[];
  branchScoped?: boolean;
};

const f = (
  name: string,
  ar: string,
  en: string,
  type: FieldType = "text",
  extra: Partial<ResourceField> = {},
): ResourceField => ({ name, label: { ar, en }, type, ...extra });

const active = f("active", "نشط", "Active", "boolean", { defaultValue: true, list: true });

export const RESOURCES: Record<string, ResourceConfig> = {
  categories: {
    key: "categories", model: "category", entity: "Category",
    title: { ar: "التصنيفات", en: "Categories" },
    viewPermission: "products.view", managePermission: "products.manage",
    searchFields: ["nameAr"],
    fields: [
      f("code", "الرمز", "Code", "text", { hidden: true, autoCode: "CAT" }),
      f("nameAr", "اسم التصنيف", "Category name", "text", { required: true, list: true }),
      f("nameEn", "الاسم (إنجليزي)", "Name (English)", "text", { hidden: true, defaultFrom: "nameAr" }),
      f("kind", "النوع", "Kind", "select", {
        required: true, defaultValue: "PRODUCT", list: true,
        options: [
          { value: "PRODUCT", label: { ar: "منتجات", en: "Products" } },
          { value: "INGREDIENT", label: { ar: "مكونات", en: "Ingredients" } },
          { value: "EXPENSE", label: { ar: "مصروفات", en: "Expenses" } },
        ],
      }),
    ],
  },
  units: {
    key: "units", model: "unitOfMeasure", entity: "UnitOfMeasure",
    title: { ar: "وحدات القياس", en: "Units of Measure" },
    viewPermission: "products.view", managePermission: "products.manage",
    searchFields: ["code", "nameAr", "nameEn"],
    fields: [
      f("code", "الرمز", "Code", "text", { required: true, list: true }),
      f("nameAr", "الاسم (عربي)", "Name (Arabic)", "text", { required: true, list: true }),
      f("nameEn", "الاسم (إنجليزي)", "Name (English)", "text", { required: true }),
      f("precision", "الكسور العشرية", "Decimals", "number", { defaultValue: 3 }),
      active,
    ],
  },
  suppliers: {
    key: "suppliers", model: "supplier", entity: "Supplier",
    title: { ar: "الموردون", en: "Suppliers" },
    viewPermission: "purchases.view", managePermission: "purchases.manage",
    searchFields: ["code", "nameAr", "nameEn", "phone"],
    fields: [
      f("code", "الرمز", "Code", "text", { required: true, list: true }),
      f("nameAr", "الاسم (عربي)", "Name (Arabic)", "text", { required: true, list: true }),
      f("nameEn", "الاسم (إنجليزي)", "Name (English)", "text", { required: true }),
      f("contactName", "جهة الاتصال", "Contact", "text"),
      f("phone", "الهاتف", "Phone", "text", { list: true }),
      f("email", "البريد الإلكتروني", "Email", "text"),
      f("address", "العنوان", "Address", "textarea"),
      f("paymentTermsDays", "أجل الدفع (يوم)", "Payment terms (days)", "number", { defaultValue: 0 }),
      f("taxNumber", "الرقم الضريبي", "Tax number", "text"),
      f("notes", "ملاحظات", "Notes", "textarea"),
      active,
    ],
  },
  ingredients: {
    key: "ingredients", model: "ingredient", entity: "Ingredient",
    title: { ar: "المكونات", en: "Ingredients" },
    viewPermission: "ingredients.view", managePermission: "ingredients.manage",
    searchFields: ["sku", "nameAr", "nameEn"],
    fields: [
      f("sku", "رمز المكون", "SKU", "text", { required: true, list: true }),
      f("nameAr", "الاسم (عربي)", "Name (Arabic)", "text", { required: true, list: true }),
      f("nameEn", "الاسم (إنجليزي)", "Name (English)", "text", { required: true }),
      f("categoryId", "التصنيف", "Category", "select", { optionResource: "categories" }),
      f("baseUnitId", "الوحدة الأساسية", "Base unit", "select", { required: true, optionResource: "units" }),
      f("purchaseUnitId", "وحدة الشراء", "Purchase unit", "select", { required: true, optionResource: "units" }),
      f("conversionFactor", "معامل التحويل", "Conversion factor", "number", { defaultValue: 1 }),
      f("currentCost", "التكلفة الحالية", "Current cost", "number", { defaultValue: 0, list: true }),
      f("minStock", "الحد الأدنى", "Minimum stock", "number", { defaultValue: 0, list: true }),
      f("maxStock", "الحد الأعلى", "Maximum stock", "number", { defaultValue: 0 }),
      f("preferredSupplierId", "المورد المفضل", "Preferred supplier", "select", { optionResource: "suppliers" }),
      f("trackExpiry", "تتبع تاريخ الانتهاء", "Track expiry", "boolean", { defaultValue: false }),
      f("storageRequirement", "شروط التخزين", "Storage requirement", "text"),
      active,
    ],
  },
  products: {
    key: "products", model: "product", entity: "Product",
    title: { ar: "المنتجات", en: "Products" },
    viewPermission: "products.view", managePermission: "products.manage",
    searchFields: ["sku", "nameAr"],
    fields: [
      f("sku", "رمز المنتج", "SKU", "text", { hidden: true, autoCode: "PRD" }),
      f("nameAr", "اسم المنتج", "Product name", "text", { required: true, list: true }),
      f("nameEn", "الاسم (إنجليزي)", "Name (English)", "text", { hidden: true, defaultFrom: "nameAr" }),
      f("categoryId", "التصنيف", "Category", "select", { optionResource: "categories", list: true }),
      f("sellingPrice", "سعر المنتج", "Selling price", "number", { required: true, defaultValue: 0, list: true }),
      f("costPrice", "سعر التكلفة", "Cost price", "number", { defaultValue: 0, list: true }),
      f("baseUnitId", "الوحدة", "Unit", "select", {
        required: true, list: true, optionResource: "units", optionCodes: ["pcs", "kg"],
        optionLabels: {
          pcs: { ar: "حبة", en: "Piece" },
          kg: { ar: "كيلو", en: "Kilogram" },
        },
      }),
      f("piecesPerUnit", "عدد القطع في الوحدة", "Pieces per unit", "number", { required: true, defaultValue: 1, list: true }),
    ],
  },
  warehouses: {
    key: "warehouses", model: "warehouse", entity: "Warehouse",
    title: { ar: "المخازن", en: "Warehouses" },
    viewPermission: "warehouses.view", managePermission: "warehouses.manage",
    searchFields: ["code", "nameAr", "nameEn"],
    branchScoped: true,
    fields: [
      f("code", "الرمز", "Code", "text", { required: true, list: true }),
      f("nameAr", "الاسم (عربي)", "Name (Arabic)", "text", { required: true, list: true }),
      f("nameEn", "الاسم (إنجليزي)", "Name (English)", "text", { required: true }),
      f("kind", "النوع", "Kind", "select", {
        defaultValue: "BOTH", list: true,
        options: [
          { value: "RAW", label: { ar: "مواد خام", en: "Raw materials" } },
          { value: "FINISHED", label: { ar: "منتجات تامة", en: "Finished goods" } },
          { value: "BOTH", label: { ar: "كلاهما", en: "Both" } },
        ],
      }),
      f("branchId", "الفرع", "Branch", "select", { optionResource: "branches" }),
      active,
    ],
  },
  customers: {
    key: "customers", model: "customer", entity: "Customer",
    title: { ar: "العملاء", en: "Customers" },
    viewPermission: "customers.view", managePermission: "customers.manage",
    searchFields: ["nameAr", "phone"],
    fields: [
      f("code", "الرمز", "Code", "text", { hidden: true, autoCode: "CUS" }),
      f("nameAr", "الاسم", "Name", "text", { required: true, list: true }),
      f("nameEn", "الاسم (إنجليزي)", "Name (English)", "text", { hidden: true, defaultFrom: "nameAr" }),
      f("phone", "رقم الهاتف", "Phone", "text", { list: true }),
      f("creditLimit", "حد الائتمان", "Credit limit", "number", { defaultValue: 0, list: true }),
      f("notes", "ملاحظات", "Notes", "textarea", { list: true }),
    ],
  },
  employees: {
    key: "employees", model: "employee", entity: "Employee",
    title: { ar: "الموظفون", en: "Employees" },
    viewPermission: "hr.view", managePermission: "hr.manage",
    searchFields: ["number", "nameAr", "nameEn", "phone"],
    branchScoped: true,
    fields: [
      f("number", "رقم الموظف", "Employee no.", "text", { required: true, list: true }),
      f("nameAr", "الاسم (عربي)", "Name (Arabic)", "text", { required: true, list: true }),
      f("nameEn", "الاسم (إنجليزي)", "Name (English)", "text", { required: true }),
      f("phone", "الهاتف", "Phone", "text", { list: true }),
      f("email", "البريد الإلكتروني", "Email", "text"),
      f("salary", "الراتب", "Salary", "number", { defaultValue: 0, list: true }),
      f("hireDate", "تاريخ التعيين", "Hire date", "date"),
      f("status", "الحالة", "Status", "select", {
        defaultValue: "ACTIVE", list: true,
        options: [
          { value: "ACTIVE", label: { ar: "نشط", en: "Active" } },
          { value: "ON_LEAVE", label: { ar: "في إجازة", en: "On leave" } },
          { value: "INACTIVE", label: { ar: "غير نشط", en: "Inactive" } },
        ],
      }),
      f("branchId", "الفرع", "Branch", "select", { optionResource: "branches" }),
    ],
  },
  accounts: {
    key: "accounts", model: "account", entity: "Account",
    title: { ar: "الحسابات", en: "Accounts" },
    viewPermission: "accounting.view", managePermission: "accounting.manage",
    searchFields: ["code", "nameAr", "nameEn"],
    fields: [
      f("code", "الرمز", "Code", "text", { required: true, list: true }),
      f("nameAr", "الاسم (عربي)", "Name (Arabic)", "text", { required: true, list: true }),
      f("nameEn", "الاسم (إنجليزي)", "Name (English)", "text", { required: true }),
      f("type", "النوع", "Type", "select", {
        required: true, defaultValue: "ASSET", list: true,
        options: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE"].map((v) => ({
          value: v, label: { ar: v, en: v },
        })),
      }),
      f("parentId", "الحساب الأب", "Parent account", "select", { optionResource: "accounts" }),
      active,
    ],
  },
  expenseCategories: {
    key: "expenseCategories", model: "expenseCategory", entity: "ExpenseCategory",
    title: { ar: "تصنيفات المصروفات", en: "Expense Categories" },
    viewPermission: "expenses.view", managePermission: "expenses.manage",
    searchFields: ["code", "nameAr", "nameEn"],
    fields: [
      f("code", "الرمز", "Code", "text", { required: true, list: true }),
      f("nameAr", "الاسم (عربي)", "Name (Arabic)", "text", { required: true, list: true }),
      f("nameEn", "الاسم (إنجليزي)", "Name (English)", "text", { required: true }),
      f("accountId", "الحساب المرتبط", "Linked account", "select", { optionResource: "accounts" }),
    ],
  },
  branches: {
    key: "branches", model: "branch", entity: "Branch",
    title: { ar: "الفروع", en: "Branches" },
    viewPermission: "settings.view", managePermission: "settings.manage",
    searchFields: ["code", "nameAr", "nameEn"],
    fields: [
      f("code", "الرمز", "Code", "text", { required: true, list: true }),
      f("nameAr", "الاسم (عربي)", "Name (Arabic)", "text", { required: true, list: true }),
      f("nameEn", "الاسم (إنجليزي)", "Name (English)", "text", { required: true }),
      f("address", "العنوان", "Address", "textarea"),
      f("phone", "الهاتف", "Phone", "text"),
      active,
    ],
  },
};

export type ResourceKey = keyof typeof RESOURCES;
