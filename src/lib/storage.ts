import type { AppData, Category, Food, GroceryItem, MealSelection, PantryItem, Recipe, Unit, WeekPlan } from '../types';
import { CATEGORIES, DATA_VERSION, DAYS, SLOTS, UNITS } from '../types';
import { SEED_FOODS, SEED_RECIPES } from '../data/seed';

// ---------------------------------------------------------------------------
// Keep raw bytes at the storage boundary so failed parsing never erases them.
// Operations are synchronous and must throw on failure. Async storage and
// migrations need a separately reviewed contract.
// ---------------------------------------------------------------------------

export interface StorageAdapter {
  load(): string | null;
  save(raw: string): void;
  backup(raw: string): void;
  loadBackup(): string | null;
}

export const STORAGE_KEY = 'larder:data:v1';
export const RECOVERY_KEY = 'larder:recovery:v1';

function browserStorage(): Storage {
  const storage = globalThis.localStorage;
  if (!storage) throw new Error('Browser storage is unavailable.');
  return storage;
}

export const localStorageAdapter: StorageAdapter = {
  load() {
    return browserStorage().getItem(STORAGE_KEY);
  },
  save(raw) {
    browserStorage().setItem(STORAGE_KEY, raw);
  },
  backup(raw) {
    browserStorage().setItem(RECOVERY_KEY, raw);
  },
  loadBackup() {
    return browserStorage().getItem(RECOVERY_KEY);
  },
};

export function emptyWeek(): WeekPlan {
  const w = {} as WeekPlan;
  for (const d of DAYS) {
    w[d] = { breakfast: [], lunch: [], dinner: [], snack: [] };
  }
  return w;
}

export function createDefaultData(): AppData {
  return {
    version: DATA_VERSION,
    foods: SEED_FOODS.map((f) => ({ ...f })),
    recipes: SEED_RECIPES.map((r) => ({ ...r, ingredients: r.ingredients.map((i) => ({ ...i })) })),
    quick: [],
    week: emptyWeek(),
    grocery: [],
    pantry: [],
    settings: { theme: 'system', listSource: 'both', subtractPantry: true, keepManualItems: true },
  };
}

// ---- Validation -----------------------------------------------------------
// Imported JSON is untrusted: check shapes field by field and throw a clear
// error message rather than letting bad data crash the UI later.

export class ImportError extends Error {}
export class NewerVersionError extends ImportError {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isUnit = (v: unknown): v is Unit => isStr(v) && (UNITS as readonly string[]).includes(v);
const isCat = (v: unknown): v is Category => isStr(v) && (CATEGORIES as readonly string[]).includes(v);

// Reject damaged or unsupported v1 fields instead of repairing/dropping data.
// Schema changes need explicit migrations, not defaults at the read boundary.
function object(v: unknown, name: string, keys: readonly string[]): Record<string, unknown> {
  if (!isObj(v)) throw new ImportError(`"${name}" should be an object.`);
  for (const key of Object.keys(v)) {
    if (!keys.includes(key)) throw new ImportError(`"${name}.${key}" is not supported by this data version.`);
  }
  return v;
}

function field<T>(v: unknown, name: string, check: (x: unknown) => x is T): T {
  if (!check(v)) throw new ImportError(`"${name}" is missing or invalid.`);
  return v;
}

function optional<T>(v: unknown, name: string, check: (x: unknown) => x is T): T | undefined {
  return v === undefined ? undefined : field(v, name, check);
}

const isName = (v: unknown): v is string => isStr(v) && v.trim().length > 0;
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isPositive = (v: unknown): v is number => isNum(v) && v > 0;
const isNonNegative = (v: unknown): v is number => isNum(v) && v >= 0;
const isTheme = (v: unknown): v is AppData['settings']['theme'] => v === 'system' || v === 'light' || v === 'dark';
const isSource = (v: unknown): v is AppData['settings']['listSource'] => v === 'quick' || v === 'week' || v === 'both';

function arr<T>(v: unknown, name: string, check: (x: unknown, i: number) => T): T[] {
  if (!Array.isArray(v)) throw new ImportError(`"${name}" should be a list.`);
  return Array.from(v, (x, i) => check(x, i));
}

function food(v: unknown, i: number): Food {
  const name = `foods[${i}]`;
  const x = object(v, name, ['id', 'name', 'category', 'defaultQuantity', 'defaultUnit', 'notes', 'custom']);
  return {
    id: field(x.id, `${name}.id`, isName), name: field(x.name, `${name}.name`, isName),
    category: field(x.category, `${name}.category`, isCat),
    defaultQuantity: field(x.defaultQuantity, `${name}.defaultQuantity`, isPositive),
    defaultUnit: field(x.defaultUnit, `${name}.defaultUnit`, isUnit),
    notes: optional(x.notes, `${name}.notes`, isStr),
    custom: optional(x.custom, `${name}.custom`, isBool),
  };
}

function recipe(v: unknown, i: number): Recipe {
  const name = `recipes[${i}]`;
  const x = object(v, name, ['id', 'name', 'description', 'emoji', 'servings', 'ingredients', 'instructions', 'prepMinutes', 'custom']);
  const ingredients = arr(x.ingredients, `${name}.ingredients`, (v, j) => {
    const label = `Ingredient #${j + 1} of recipes[${i}]`;
    const g = object(v, label, ['foodId', 'quantity', 'unit', 'note']);
    return {
      foodId: field(g.foodId, `${label}.foodId`, isName),
      quantity: field(g.quantity, `${label}.quantity`, isPositive),
      unit: field(g.unit, `${label}.unit`, isUnit),
      note: optional(g.note, `${label}.note`, isStr),
    };
  });
  return {
    id: field(x.id, `${name}.id`, isName), name: field(x.name, `${name}.name`, isName),
    description: field(x.description, `${name}.description`, isStr),
    emoji: field(x.emoji, `${name}.emoji`, isStr),
    servings: field(x.servings, `${name}.servings`, isPositive), ingredients,
    instructions: optional(x.instructions, `${name}.instructions`, isStr),
    prepMinutes: optional(x.prepMinutes, `${name}.prepMinutes`, isNonNegative),
    custom: optional(x.custom, `${name}.custom`, isBool),
  };
}

function selections(v: unknown, name: string): MealSelection[] {
  return arr(v, name, (v, i) => {
    const label = `${name}[${i}]`;
    const x = object(v, label, ['id', 'recipeId', 'servings']);
    return {
      id: field(x.id, `${label}.id`, isName),
      recipeId: field(x.recipeId, `${label}.recipeId`, isName),
      servings: field(x.servings, `${label}.servings`, isPositive),
    };
  });
}

function grocery(v: unknown, i: number): GroceryItem {
  const name = `grocery[${i}]`;
  const x = object(v, name, ['id', 'name', 'foodId', 'category', 'quantity', 'unit', 'checked', 'source', 'fromRecipes']);
  return {
    id: field(x.id, `${name}.id`, isName), name: field(x.name, `${name}.name`, isName),
    foodId: optional(x.foodId, `${name}.foodId`, isName),
    category: field(x.category, `${name}.category`, isCat),
    quantity: field(x.quantity, `${name}.quantity`, (v): v is number | null => v === null || isNonNegative(v)),
    unit: field(x.unit, `${name}.unit`, (v): v is Unit | null => v === null || isUnit(v)),
    checked: field(x.checked, `${name}.checked`, isBool),
    source: field(x.source, `${name}.source`, (v): v is GroceryItem['source'] => v === 'generated' || v === 'manual'),
    fromRecipes: x.fromRecipes === undefined ? undefined
      : arr(x.fromRecipes, `${name}.fromRecipes`, (v, j) => field(v, `${name}.fromRecipes[${j}]`, isStr)),
  };
}

function pantry(v: unknown, i: number): PantryItem {
  const name = `pantry[${i}]`;
  const x = object(v, name, ['id', 'foodId', 'quantity', 'unit', 'available']);
  return {
    id: field(x.id, `${name}.id`, isName), foodId: field(x.foodId, `${name}.foodId`, isName),
    quantity: field(x.quantity, `${name}.quantity`, isNonNegative),
    unit: field(x.unit, `${name}.unit`, isUnit), available: field(x.available, `${name}.available`, isBool),
  };
}

/** Parse supported v1 data without coercion, omission or automatic repair. */
export function parseAppData(input: unknown): AppData {
  if (!isObj(input)) throw new ImportError('This file is not a Larder backup.');
  if (!Array.isArray(input.foods) || !Array.isArray(input.recipes)) {
    throw new ImportError('This file is not a Larder backup: it has no foods or recipes.');
  }
  if (isNum(input.version) && input.version > DATA_VERSION) {
    throw new NewerVersionError('This backup was made by a newer version of the app.');
  }
  if (input.version !== DATA_VERSION) {
    throw new ImportError('This backup has an unsupported or missing data version.');
  }
  object(input, 'backup', ['version', 'foods', 'recipes', 'quick', 'week', 'grocery', 'pantry', 'settings', 'lastGeneratedAt']);
  const sourceWeek = object(input.week, 'week', DAYS);
  const week = emptyWeek();
  for (const d of DAYS) {
    const day = object(sourceWeek[d], `week.${d}`, SLOTS);
    for (const s of SLOTS) week[d][s] = selections(day[s], `week.${d}.${s}`);
  }
  const s = object(input.settings, 'settings', ['theme', 'listSource', 'subtractPantry', 'keepManualItems']);
  return {
    version: DATA_VERSION,
    foods: arr(input.foods, 'foods', food), recipes: arr(input.recipes, 'recipes', recipe),
    quick: selections(input.quick, 'quick'), week,
    grocery: arr(input.grocery, 'grocery', grocery), pantry: arr(input.pantry, 'pantry', pantry),
    settings: {
      theme: field(s.theme, 'settings.theme', isTheme),
      listSource: field(s.listSource, 'settings.listSource', isSource),
      subtractPantry: field(s.subtractPantry, 'settings.subtractPantry', isBool),
      keepManualItems: field(s.keepManualItems, 'settings.keepManualItems', isBool),
    },
    lastGeneratedAt: optional(input.lastGeneratedAt, 'lastGeneratedAt', isStr),
  };
}
