import type {
  Category, Food, GroceryItem, ListSource, MealSelection, PantryItem, Recipe, Unit, WeekPlan,
} from '../types';
import { DAYS, SLOTS } from '../types';
import { convert, dimensionOf, pickDisplayUnit, roundForShopping, toBase } from './units';
import { uid } from './id';

// ---------------------------------------------------------------------------
// Grocery list generation. Every function here is pure (no React, no storage)
// so the logic can be unit-tested directly — see grocery.test.ts.
//
// Pipeline:
//   selections -> expand (scale by servings) -> aggregate (combine compatible
//   units) -> subtract pantry (optional) -> round -> merge with existing list
// ---------------------------------------------------------------------------

export interface RequiredLine {
  /** foodId + unit dimension: identifies one line on the list. */
  key: string;
  foodId: string;
  name: string;
  category: Category;
  quantity: number;
  unit: Unit;
  fromRecipes: string[];
}

export interface PantryCoverage {
  foodId: string;
  name: string;
  quantity: number;
  unit: Unit;
  fullyCovered: boolean;
}

export interface GenerateResult {
  items: GroceryItem[];
  coveredByPantry: PantryCoverage[];
  /** Selections that point to recipes that no longer exist. */
  skippedSelections: number;
}

const EPS = 1e-9;

export function lineKey(foodId: string, unit: Unit): string {
  return `${foodId}|${dimensionOf(unit)}`;
}

/** Gather meal selections from the quick list, the week plan, or both. */
export function collectSelections(quick: MealSelection[], week: WeekPlan, source: ListSource): MealSelection[] {
  const out: MealSelection[] = [];
  if (source === 'quick' || source === 'both') out.push(...quick);
  if (source === 'week' || source === 'both') {
    for (const d of DAYS) for (const s of SLOTS) out.push(...(week[d]?.[s] ?? []));
  }
  return out;
}

/** Scale every recipe to its selected servings and sum compatible ingredients. */
export function aggregateIngredients(
  selections: MealSelection[],
  recipes: Recipe[],
  foods: Food[],
): { lines: RequiredLine[]; skipped: number } {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const foodById = new Map(foods.map((f) => [f.id, f]));
  const acc = new Map<string, { foodId: string; base: number; units: Unit[]; recipes: Set<string> }>();
  let skipped = 0;

  for (const sel of selections) {
    const recipe = recipeById.get(sel.recipeId);
    if (!recipe || !(sel.servings > 0) || !(recipe.servings > 0)) {
      skipped++;
      continue;
    }
    const scale = sel.servings / recipe.servings;
    for (const ing of recipe.ingredients) {
      if (!(ing.quantity > 0)) continue;
      const key = lineKey(ing.foodId, ing.unit);
      const entry = acc.get(key) ?? { foodId: ing.foodId, base: 0, units: [], recipes: new Set<string>() };
      entry.base += toBase(ing.quantity * scale, ing.unit);
      entry.units.push(ing.unit);
      entry.recipes.add(recipe.name);
      acc.set(key, entry);
    }
  }

  const lines: RequiredLine[] = [];
  for (const [key, e] of acc) {
    const food = foodById.get(e.foodId);
    const dim = dimensionOf(e.units[0]);
    const unit = pickDisplayUnit(e.base, dim, e.units);
    lines.push({
      key,
      foodId: e.foodId,
      name: food?.name ?? 'Unknown item',
      category: food?.category ?? 'other',
      quantity: e.base / toBase(1, unit),
      unit,
      fromRecipes: Array.from(e.recipes),
    });
  }
  return { lines, skipped };
}

/**
 * Subtract what the user already has. Only pantry items the user explicitly
 * added AND marked available are used, and only when units are compatible.
 */
export function subtractPantry(
  lines: RequiredLine[],
  pantry: PantryItem[],
): { lines: RequiredLine[]; covered: PantryCoverage[] } {
  // Track remaining pantry amounts so one pantry item isn't counted twice.
  const remaining = pantry.filter((p) => p.available && p.quantity > 0).map((p) => ({ ...p }));
  const covered: PantryCoverage[] = [];
  const out: RequiredLine[] = [];

  for (const line of lines) {
    let need = line.quantity;
    let used = 0;
    for (const p of remaining) {
      if (need <= EPS) break;
      if (p.foodId !== line.foodId || dimensionOf(p.unit) !== dimensionOf(line.unit) || p.quantity <= EPS) continue;
      const have = convert(p.quantity, p.unit, line.unit);
      const take = Math.min(have, need);
      need -= take;
      used += take;
      p.quantity -= convert(take, line.unit, p.unit);
    }
    if (used > EPS) {
      covered.push({ foodId: line.foodId, name: line.name, quantity: used, unit: line.unit, fullyCovered: need <= EPS });
    }
    if (need > EPS) out.push({ ...line, quantity: need });
  }
  return { lines: out, covered };
}

/**
 * Merge freshly generated lines into the current list.
 * - Previously generated items are replaced by the new calculation.
 * - Manual items are kept (unless keepManual is false).
 * - A generated item that was already ticked stays ticked if it is still
 *   needed, so regenerating mid-shop doesn't lose progress.
 */
export function mergeGroceryList(
  existing: GroceryItem[],
  lines: RequiredLine[],
  opts: { keepManual: boolean },
): GroceryItem[] {
  const checkedKeys = new Set(
    existing
      .filter((i) => i.source === 'generated' && i.checked && i.foodId && i.unit)
      .map((i) => lineKey(i.foodId!, i.unit!)),
  );
  const manual = opts.keepManual ? existing.filter((i) => i.source === 'manual') : [];
  const generated: GroceryItem[] = lines.map((l) => ({
    id: uid(),
    foodId: l.foodId,
    name: l.name,
    category: l.category,
    quantity: roundForShopping(l.quantity, l.unit),
    unit: l.unit,
    checked: checkedKeys.has(l.key),
    source: 'generated',
    fromRecipes: l.fromRecipes,
  }));
  return [...generated, ...manual];
}

export function generateGroceryList(input: {
  selections: MealSelection[];
  recipes: Recipe[];
  foods: Food[];
  pantry: PantryItem[];
  existing: GroceryItem[];
  subtractPantry: boolean;
  keepManual: boolean;
}): GenerateResult {
  const { lines, skipped } = aggregateIngredients(input.selections, input.recipes, input.foods);
  let finalLines = lines;
  let covered: PantryCoverage[] = [];
  if (input.subtractPantry) {
    const r = subtractPantry(lines, input.pantry);
    finalLines = r.lines;
    covered = r.covered;
  }
  finalLines = finalLines.filter((l) => roundForShopping(l.quantity, l.unit) > 0);
  return {
    items: mergeGroceryList(input.existing, finalLines, { keepManual: input.keepManual }),
    coveredByPantry: covered,
    skippedSelections: skipped,
  };
}

/** Plain-text version of the list, grouped by category, for copying. */
export function groceryListToText(items: GroceryItem[], categoryLabel: (c: Category) => string, fmt: (i: GroceryItem) => string): string {
  const groups = new Map<Category, GroceryItem[]>();
  for (const i of items) {
    if (i.checked) continue;
    groups.set(i.category, [...(groups.get(i.category) ?? []), i]);
  }
  const parts: string[] = [];
  for (const [cat, list] of groups) {
    parts.push(categoryLabel(cat));
    for (const i of list) parts.push(`  [ ] ${i.name}${fmt(i) ? ` — ${fmt(i)}` : ''}`);
  }
  return parts.join('\n');
}
