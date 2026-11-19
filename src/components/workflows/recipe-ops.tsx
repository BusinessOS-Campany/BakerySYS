"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  apiFetch, apiSend, DataPanel, FieldInput, L, LineItemsEditor, lookupOptions, useList, useLookups,
  type Field, type LineItem, type Locale,
} from "./shared";

type RecipeRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  productName: string;
  currentVersion: number;
  yieldQuantity: string | number;
  status: string;
  snapshot: { costPerUnit: string | number; grossProfit: string | number } | null;
};
type RecipeDetail = {
  recipe: { id: string };
  lines: { ingredientId: string; quantity: string | number; unitId: string | null }[];
};

export function RecipesPage({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const recipes = useList<RecipeRow>("/api/recipes", undefined, locale, refresh);
  const lookups = useLookups(["products", "ingredients", "units"], locale);
  const productOptions = lookupOptions(lookups.products ?? [], locale);
  const ingredientOptions = lookupOptions(lookups.ingredients ?? [], locale);
  const unitOptions = lookupOptions(lookups.units ?? [], locale);
  const [lines, setLines] = useState<LineItem[]>([{ key: "initial", quantity: "1", unitPrice: "0" }]);

  const reloadAll = async () => {
    await recipes.reload();
    setRefresh((v) => v + 1);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{L(locale, "الوصفات", "Recipes")}</h1>
        <p className="muted mt-1 text-sm">
          {L(locale, "مكونات الإنتاج وتكلفة الوحدة وإصدارات الوصفات", "Production ingredients, unit cost and recipe versions")}
        </p>
      </div>

      <DataPanel<RecipeRow>
        title={L(locale, "دليل الوصفات", "Recipe catalogue")}
        endpoint="/api/recipes"
        locale={locale}
        rows={recipes.rows}
        loading={recipes.loading}
        reload={reloadAll}
        refreshKey={refresh}
        canManage={canManage}
        columns={[
          { key: "productName", label: L(locale, "المنتج", "Product") },
          { key: "nameEn", label: L(locale, "الوصفة", "Recipe"), render: (row) => locale === "ar" ? row.nameAr : row.nameEn },
          { key: "currentVersion", label: L(locale, "الإصدار", "Version"), render: (row) => `v${row.currentVersion}` },
          { key: "yieldQuantity", label: L(locale, "الإنتاجية", "Yield") },
          { key: "snapshot", label: L(locale, "تكلفة الوحدة", "Unit cost"), render: (row) => row.snapshot ? Number(row.snapshot.costPerUnit).toFixed(2) : "—" },
          { key: "status", label: L(locale, "الحالة", "Status"), render: (row) => row.status },
        ]}
        form={{
          title: L(locale, "وصفة جديدة", "New recipe"),
          endpoint: "/api/recipes",
          enabled: canManage,
          fields: [
            { name: "productId", label: L(locale, "المنتج", "Product"), type: "select", required: true, options: productOptions },
            { name: "nameAr", label: L(locale, "الاسم (عربي)", "Name (Arabic)"), required: true },
            { name: "nameEn", label: L(locale, "الاسم (إنجليزي)", "Name (English)"), required: true },
            { name: "yieldQuantity", label: L(locale, "الإنتاجية", "Yield"), type: "number", required: true, defaultValue: "1" },
            { name: "prepMinutes", label: L(locale, "زمن التحضير (د)", "Prep minutes"), type: "number", defaultValue: "0" },
            { name: "bakeTempC", label: L(locale, "حرارة الخبز", "Bake temp (°C)"), type: "number" },
            { name: "bakeMinutes", label: L(locale, "زمن الخبز (د)", "Bake minutes"), type: "number" },
            { name: "laborCost", label: L(locale, "تكلفة العمالة", "Labour cost"), type: "number", defaultValue: "0" },
            { name: "packagingCost", label: L(locale, "تكلفة التغليف", "Packaging cost"), type: "number", defaultValue: "0" },
            { name: "overheadCost", label: L(locale, "المصاريف العامة", "Overhead cost"), type: "number", defaultValue: "0" },
            { name: "instructions", label: L(locale, "تعليمات التحضير", "Instructions"), type: "textarea" },
          ],
          extra: () => (
            <LineItemsEditor
              itemOptions={ingredientOptions}
              unitOptions={unitOptions}
              includeUnit
              includePrice={false}
              lines={lines}
              locale={locale}
              onChange={setLines}
            />
          ),
          build: (values) => ({
            productId: String(values.productId),
            nameAr: String(values.nameAr),
            nameEn: String(values.nameEn),
            yieldQuantity: Number(values.yieldQuantity),
            prepMinutes: Number(values.prepMinutes || 0),
            bakeTempC: values.bakeTempC ? Number(values.bakeTempC) : null,
            bakeMinutes: values.bakeMinutes ? Number(values.bakeMinutes) : null,
            laborCost: Number(values.laborCost || 0),
            packagingCost: Number(values.packagingCost || 0),
            overheadCost: Number(values.overheadCost || 0),
            instructions: String(values.instructions || "") || undefined,
            lines: lines.filter((line) => line.ingredientId).map((line) => ({
              ingredientId: String(line.ingredientId),
              quantity: Number(line.quantity),
              unitId: String(line.unitId || ""),
            })),
          }),
          afterSave: async () => { setLines([{ key: crypto.randomUUID(), quantity: "1", unitPrice: "0" }]); },
        }}
        rowActions={[
          {
            label: L(locale, "إعادة حساب التكلفة", "Recalculate cost"),
            tone: "secondary",
            requiresManage: true,
            run: async (row, reload, setError) => {
              try {
                await apiSend(`/api/recipes/${row.id}`, "PATCH", {}, locale);
                await reload();
                setRefresh((v) => v + 1);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            },
          },
        ]}
      />

      {canManage ? <RecipeVersionForm locale={locale} recipes={recipes.rows} onDone={reloadAll} /> : null}
    </div>
  );
}

function RecipeVersionForm({
  locale,
  recipes,
  onDone,
}: {
  locale: Locale;
  recipes: RecipeRow[];
  onDone: () => Promise<void>;
}) {
  const [recipeId, setRecipeId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const lookups = useLookups(["ingredients", "units"], locale);
  const ingredientOptions = lookupOptions(lookups.ingredients ?? [], locale);
  const unitOptions = lookupOptions(lookups.units ?? [], locale);

  useEffect(() => {
    let active = true;
    setLines([]);
    if (!recipeId) return;
    void apiFetch<RecipeDetail>(`/api/recipes/${recipeId}`, locale)
      .then((detail) => {
        if (!active) return;
        setLines(detail.lines.map((line, index) => ({
          key: `${line.ingredientId}-${index}`,
          ingredientId: line.ingredientId,
          quantity: String(line.quantity),
          unitId: line.unitId ?? undefined,
          unitPrice: "0",
        })));
      })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : String(err)); });
    return () => { active = false; };
  }, [locale, recipeId]);

  const fields: Field[] = [
    { name: "recipeId", label: L(locale, "الوصفة", "Recipe"), type: "select", required: true, options: recipes.map((recipe) => ({ value: recipe.id, label: `${locale === "ar" ? recipe.nameAr : recipe.nameEn} · v${recipe.currentVersion}` })) },
    { name: "notes", label: L(locale, "ملاحظات الإصدار", "Version notes"), type: "textarea" },
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiSend(`/api/recipes/${recipeId}`, "POST", {
        action: "version",
        notes: notes || undefined,
        lines: lines.filter((line) => line.ingredientId).map((line) => ({
          ingredientId: String(line.ingredientId),
          quantity: Number(line.quantity),
          unitId: String(line.unitId || ""),
          isAlternative: false,
        })),
      }, locale);
      setRecipeId("");
      setNotes("");
      setLines([]);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card space-y-3 p-4" onSubmit={(event) => void submit(event)}>
      <div>
        <h3 className="text-sm font-bold">{L(locale, "إصدار جديد من الوصفة", "Create recipe version")}</h3>
        <p className="muted mt-1 text-xs">
          {L(locale, "يتم نسخ البنود الحالية وإنشاء إصدار جديد بأرقام إنتاج محدثة.", "Current lines are copied into a new version with fresh cost snapshots.")}
        </p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldInput field={fields[0]} onChange={(value) => setRecipeId(String(value))} value={recipeId} />
        <FieldInput field={fields[1]} onChange={(value) => setNotes(String(value))} value={notes} />
      </div>
      {recipeId ? (
        <LineItemsEditor
          itemOptions={ingredientOptions}
          unitOptions={unitOptions}
          includeUnit
          includePrice={false}
          lines={lines}
          locale={locale}
          onChange={setLines}
        />
      ) : null}
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={saving || !recipeId || lines.length === 0} type="submit">
          {saving ? L(locale, "جارٍ الحفظ...", "Saving...") : L(locale, "إنشاء الإصدار", "Create version")}
        </button>
      </div>
    </form>
  );
}
