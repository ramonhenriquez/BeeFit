// ---------------------------------------------------------------------------
// Data models. Everything the app stores lives in AppData, which is a plain
// JSON-serialisable object. That keeps export/import trivial and makes a
// future cloud-sync layer a matter of swapping the storage adapter.
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  'proteins',
  'vegetables',
  'fruits',
  'grains',
  'dairy',
  'legumes',
  'pantry',
  'frozen',
  'snacks',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  proteins: 'Proteins',
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  grains: 'Grains, rice, pasta & bread',
  dairy: 'Dairy & eggs',
  legumes: 'Legumes',
  pantry: 'Oils, spices & condiments',
  frozen: 'Frozen',
  snacks: 'Snacks & misc',
  other: 'Other',
};

export const UNITS = [
  'g', 'kg', 'oz', 'lb',
  'ml', 'l', 'tsp', 'tbsp', 'cup', 'fl_oz',
  'piece', 'slice', 'clove', 'can', 'pack', 'pinch',
] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<Unit, string> = {
  g: 'g', kg: 'kg', oz: 'oz', lb: 'lb',
  ml: 'ml', l: 'L', tsp: 'tsp', tbsp: 'tbsp', cup: 'cup', fl_oz: 'fl oz',
  piece: 'pc', slice: 'slice', clove: 'clove', can: 'can', pack: 'pack', pinch: 'pinch',
};

export interface Food {
  id: string;
  name: string;
  category: Category;
  /** Typical quantity used when adding this food somewhere new. */
  defaultQuantity: number;
  defaultUnit: Unit;
  notes?: string;
  /** true for foods the user created (false/undefined = built-in). */
  custom?: boolean;
  // Future: nutrition?: { kcal, protein, carbs, fat } per 100 g; price?: number
}

export interface RecipeIngredient {
  foodId: string;
  quantity: number;
  unit: Unit;
  note?: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  emoji: string;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions?: string;
  prepMinutes?: number;
  custom?: boolean;
  // Future: favorite?: boolean; tags?: string[]
}

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABELS: Record<Day, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABELS: Record<Slot, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks',
};

/** A meal someone intends to cook, at a chosen number of servings. */
export interface MealSelection {
  id: string;
  recipeId: string;
  servings: number;
}

export type WeekPlan = Record<Day, Record<Slot, MealSelection[]>>;

export interface GroceryItem {
  id: string;
  foodId?: string;
  name: string;
  category: Category;
  /** null = no quantity specified (e.g. "some basil"). */
  quantity: number | null;
  unit: Unit | null;
  checked: boolean;
  source: 'generated' | 'manual';
  /** Recipe names that contributed (generated items only). */
  fromRecipes?: string[];
}

export interface PantryItem {
  id: string;
  foodId: string;
  quantity: number;
  unit: Unit;
  available: boolean;
}

export type ListSource = 'quick' | 'week' | 'both';
export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePref;
  listSource: ListSource;
  subtractPantry: boolean;
  keepManualItems: boolean;
}

export interface AppData {
  version: number;
  foods: Food[];
  recipes: Recipe[];
  quick: MealSelection[];
  week: WeekPlan;
  grocery: GroceryItem[];
  pantry: PantryItem[];
  settings: Settings;
  lastGeneratedAt?: string;
}

export const DATA_VERSION = 1;
