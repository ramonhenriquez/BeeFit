import type { AppData, Category, Food, GroceryItem, MealSelection, PantryItem, Recipe, Unit, WeekPlan } from '../types';
import { CATEGORIES, DATA_VERSION, DAYS, SLOTS, UNITS } from '../types';
import { SEED_FOODS, SEED_RECIPES } from '../data/seed';

// ---------------------------------------------------------------------------
// Persistence goes through a StorageAdapter. Today it's localStorage; a cloud
// adapter (with accounts and sync) can implement the same interface later
// without touching the rest of the app.
// ---------------------------------------------------------------------------

export interface StorageAdapter {
  load(): AppData | null;
  save(data: AppData): void;
  clear(): void;
}

const KEY = 'larder:data:v1';

export const localStorageAdapter: StorageAdapter = {
  load() {
    try {
      const raw = globalThis.localStorage?.getItem(KEY);
      if (!raw) return null;
      return parseAppData(JSON.parse(raw));
    } catch (err) {
      console.warn('Could not load saved data, starting fresh.', err);
      return null;
    }
  },
  save(data) {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Could not save data.', err);
    }
  },
  clear() {
    try { globalThis.localStorage?.removeItem(KEY); } catch { /* ignore */ }
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

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isUnit = (v: unknown): v is Unit => isStr(v) && (UNITS as readonly string[]).includes(v);
const isCat = (v: unknown): v is Category => isStr(v) && (CATEGORIES as readonly string[]).includes(v);

function arr<T>(v: unknown, name: string, check: (x: unknown, i: number) => T): T[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new ImportError(`"${name}" should be a list.`);
  return v.map((x, i) => check(x, i));
}

function food(x: unknown, i: number): Food {
  if (!isObj(x) || !isStr(x.id) || !isStr(x.name) || !x.name.trim()) throw new ImportError(`Food #${i + 1} is missing an id or name.`);
  return {
    id: x.id, name: x.name.trim(),
    category: isCat(x.category) ? x.category : 'other',
    defaultQuantity: isNum(x.defaultQuantity) && x.defaultQuantity > 0 ? x.defaultQuantity : 1,
    defaultUnit: isUnit(x.defaultUnit) ? x.defaultUnit : 'piece',
    notes: isStr(x.notes) ? x.notes : undefined,
    custom: x.custom === true || undefined,
  };
}

function recipe(x: unknown, i: number): Recipe {
  if (!isObj(x) || !isStr(x.id) || !isStr(x.name)) throw new ImportError(`Recipe #${i + 1} is missing an id or name.`);
  const ingredients = arr(x.ingredients, `recipes[${i}].ingredients`, (g, j) => {
    if (!isObj(g) || !isStr(g.foodId) || !isNum(g.quantity) || !isUnit(g.unit)) {
      throw new ImportError(`Ingredient #${j + 1} of "${x.name}" is invalid.`);
    }
    return { foodId: g.foodId, quantity: g.quantity, unit: g.unit, note: isStr(g.note) ? g.note : undefined };
  });
  return {
    id: x.id, name: x.name,
    description: isStr(x.description) ? x.description : '',
    emoji: isStr(x.emoji) && x.emoji ? x.emoji : '🍽️',
    servings: isNum(x.servings) && x.servings > 0 ? x.servings : 1,
    ingredients,
    instructions: isStr(x.instructions) ? x.instructions : undefined,
    prepMinutes: isNum(x.prepMinutes) ? x.prepMinutes : undefined,
    custom: x.custom === true || undefined,
  };
}

function selection(x: unknown): MealSelection | null {
  if (!isObj(x) || !isStr(x.recipeId) || !isNum(x.servings)) return null;
  return { id: isStr(x.id) ? x.id : Math.random().toString(36).slice(2), recipeId: x.recipeId, servings: Math.max(1, x.servings) };
}
const selections = (v: unknown) => (Array.isArray(v) ? v.map(selection).filter((s): s is MealSelection => !!s) : []);

function grocery(x: unknown, i: number): GroceryItem {
  if (!isObj(x) || !isStr(x.id) || !isStr(x.name)) throw new ImportError(`Grocery item #${i + 1} is invalid.`);
  return {
    id: x.id, name: x.name,
    foodId: isStr(x.foodId) ? x.foodId : undefined,
    category: isCat(x.category) ? x.category : 'other',
    quantity: isNum(x.quantity) ? x.quantity : null,
    unit: isUnit(x.unit) ? x.unit : null,
    checked: x.checked === true,
    source: x.source === 'generated' ? 'generated' : 'manual',
    fromRecipes: Array.isArray(x.fromRecipes) ? x.fromRecipes.filter(isStr) : undefined,
  };
}

function pantry(x: unknown, i: number): PantryItem {
  if (!isObj(x) || !isStr(x.id) || !isStr(x.foodId) || !isNum(x.quantity) || !isUnit(x.unit)) {
    throw new ImportError(`Pantry item #${i + 1} is invalid.`);
  }
  return { id: x.id, foodId: x.foodId, quantity: Math.max(0, x.quantity), unit: x.unit, available: x.available !== false };
}

/** Parse and validate unknown JSON into AppData. Throws ImportError with a readable message. */
export function parseAppData(input: unknown): AppData {
  if (!isObj(input)) throw new ImportError('This file is not a Larder backup.');
  if (!Array.isArray(input.foods) || !Array.isArray(input.recipes)) {
    throw new ImportError('This file is not a Larder backup: it has no foods or recipes.');
  }
  if (isNum(input.version) && input.version > DATA_VERSION) {
    throw new ImportError('This backup was made by a newer version of the app.');
  }
  const defaults = createDefaultData();
  const week = emptyWeek();
  if (isObj(input.week)) {
    for (const d of DAYS) {
      const day = input.week[d];
      if (isObj(day)) for (const s of SLOTS) week[d][s] = selections(day[s]);
    }
  }
  const s = isObj(input.settings) ? input.settings : {};
  return {
    version: DATA_VERSION,
    foods: arr(input.foods, 'foods', food),
    recipes: arr(input.recipes, 'recipes', recipe),
    quick: selections(input.quick),
    week,
    grocery: arr(input.grocery, 'grocery', grocery),
    pantry: arr(input.pantry, 'pantry', pantry),
    settings: {
      theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
      listSource: s.listSource === 'quick' || s.listSource === 'week' ? s.listSource : defaults.settings.listSource,
      subtractPantry: s.subtractPantry !== false,
      keepManualItems: s.keepManualItems !== false,
    },
    lastGeneratedAt: isStr(input.lastGeneratedAt) ? input.lastGeneratedAt : undefined,
  };
}
