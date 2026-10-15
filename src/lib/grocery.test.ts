import { describe, expect, it } from 'vitest';
import type { Food, GroceryItem, MealSelection, PantryItem, Recipe } from '../types';
import { aggregateIngredients, collectSelections, generateGroceryList, mergeGroceryList, subtractPantry } from './grocery';
import { areCompatible, convert, formatQuantity, roundForShopping } from './units';
import { createDefaultData, emptyWeek, ImportError, parseAppData } from './storage';

const foods: Food[] = [
  { id: 'chicken', name: 'Chicken', category: 'proteins', defaultQuantity: 200, defaultUnit: 'g' },
  { id: 'rice', name: 'Rice', category: 'grains', defaultQuantity: 100, defaultUnit: 'g' },
  { id: 'oil', name: 'Olive oil', category: 'pantry', defaultQuantity: 1, defaultUnit: 'tbsp' },
  { id: 'beans', name: 'Beans', category: 'legumes', defaultQuantity: 50, defaultUnit: 'g' },
  { id: 'eggs', name: 'Eggs', category: 'dairy', defaultQuantity: 2, defaultUnit: 'piece' },
  { id: 'milk', name: 'Milk', category: 'dairy', defaultQuantity: 250, defaultUnit: 'ml' },
];

const recipes: Recipe[] = [
  {
    id: 'cr', name: 'Chicken and Rice', description: '', emoji: '', servings: 1,
    ingredients: [
      { foodId: 'chicken', quantity: 200, unit: 'g' },
      { foodId: 'rice', quantity: 100, unit: 'g' },
      { foodId: 'oil', quantity: 1, unit: 'tbsp' },
    ],
  },
  {
    id: 'bb', name: 'Chicken Burrito Bowl', description: '', emoji: '', servings: 1,
    ingredients: [
      { foodId: 'chicken', quantity: 150, unit: 'g' },
      { foodId: 'rice', quantity: 100, unit: 'g' },
      { foodId: 'beans', quantity: 50, unit: 'g' },
    ],
  },
  {
    id: 'om', name: 'Omelette', description: '', emoji: '', servings: 2,
    ingredients: [
      { foodId: 'eggs', quantity: 3, unit: 'piece' },
      { foodId: 'milk', quantity: 2, unit: 'tbsp' },
    ],
  },
];

const sel = (recipeId: string, servings: number): MealSelection => ({ id: recipeId + servings, recipeId, servings });
const find = (lines: { name: string }[], name: string) => lines.find((l) => l.name === name) as any;

describe('units', () => {
  it('converts within a dimension', () => {
    expect(convert(1, 'kg', 'g')).toBe(1000);
    expect(convert(3, 'tsp', 'tbsp')).toBeCloseTo(1, 10);
    expect(convert(1, 'lb', 'oz')).toBeCloseTo(16, 10);
  });
  it('refuses incompatible conversions', () => {
    expect(areCompatible('g', 'ml')).toBe(false);
    expect(areCompatible('piece', 'can')).toBe(false);
    expect(() => convert(1, 'g', 'ml')).toThrow();
  });
  it('rounds whole-purchase units up', () => {
    expect(roundForShopping(1.5, 'piece')).toBe(2);
    expect(roundForShopping(1.0000000001, 'can')).toBe(1);
    expect(roundForShopping(149.6, 'g')).toBe(150);
    expect(roundForShopping(1.333333, 'tbsp')).toBe(1.33);
  });
  it('formats quantities', () => {
    expect(formatQuantity(2, 'piece')).toBe('2 pcs');
    expect(formatQuantity(1, 'can')).toBe('1 can');
    expect(formatQuantity(null, null)).toBe('');
  });
});

describe('aggregateIngredients', () => {
  it('reproduces the spec example', () => {
    const { lines } = aggregateIngredients([sel('cr', 1), sel('bb', 1)], recipes, foods);
    expect(lines).toHaveLength(4);
    expect(find(lines, 'Chicken')).toMatchObject({ quantity: 350, unit: 'g' });
    expect(find(lines, 'Rice')).toMatchObject({ quantity: 200, unit: 'g' });
    expect(find(lines, 'Olive oil')).toMatchObject({ quantity: 1, unit: 'tbsp' });
    expect(find(lines, 'Beans')).toMatchObject({ quantity: 50, unit: 'g' });
    expect(find(lines, 'Chicken').fromRecipes).toEqual(['Chicken and Rice', 'Chicken Burrito Bowl']);
  });

  it('scales by servings', () => {
    const { lines } = aggregateIngredients([sel('om', 3)], recipes, foods);
    expect(find(lines, 'Eggs').quantity).toBeCloseTo(4.5);
    expect(find(lines, 'Milk')).toMatchObject({ unit: 'tbsp' });
    expect(find(lines, 'Milk').quantity).toBeCloseTo(3);
  });

  it('combines compatible units and converts to a sensible unit', () => {
    const r: Recipe[] = [
      { id: 'a', name: 'A', description: '', emoji: '', servings: 1, ingredients: [{ foodId: 'rice', quantity: 0.8, unit: 'kg' }] },
      { id: 'b', name: 'B', description: '', emoji: '', servings: 1, ingredients: [{ foodId: 'rice', quantity: 300, unit: 'g' }] },
    ];
    const { lines } = aggregateIngredients([sel('a', 1), sel('b', 1)], r, foods);
    expect(lines).toHaveLength(1);
    expect(lines[0].unit).toBe('kg');
    expect(lines[0].quantity).toBeCloseTo(1.1);
  });

  it('keeps incompatible units for the same food on separate lines', () => {
    const r: Recipe[] = [
      { id: 'a', name: 'A', description: '', emoji: '', servings: 1, ingredients: [{ foodId: 'milk', quantity: 250, unit: 'ml' }] },
      { id: 'b', name: 'B', description: '', emoji: '', servings: 1, ingredients: [{ foodId: 'milk', quantity: 100, unit: 'g' }] },
    ];
    const { lines } = aggregateIngredients([sel('a', 1), sel('b', 1)], r, foods);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.unit).sort()).toEqual(['g', 'ml']);
  });

  it('mixes kitchen volume units into the largest sensible one', () => {
    const r: Recipe[] = [
      { id: 'a', name: 'A', description: '', emoji: '', servings: 1, ingredients: [{ foodId: 'oil', quantity: 1, unit: 'tbsp' }] },
      { id: 'b', name: 'B', description: '', emoji: '', servings: 1, ingredients: [{ foodId: 'oil', quantity: 3, unit: 'tsp' }] },
    ];
    const { lines } = aggregateIngredients([sel('a', 1), sel('b', 1)], r, foods);
    expect(lines[0].unit).toBe('tbsp');
    expect(lines[0].quantity).toBeCloseTo(2);
  });

  it('skips selections whose recipe was deleted', () => {
    const { lines, skipped } = aggregateIngredients([sel('missing', 1), sel('cr', 1)], recipes, foods);
    expect(skipped).toBe(1);
    expect(lines).toHaveLength(3);
  });

  it('returns nothing for no selections', () => {
    expect(aggregateIngredients([], recipes, foods).lines).toEqual([]);
  });
});

describe('subtractPantry', () => {
  const lines = aggregateIngredients([sel('cr', 1), sel('bb', 1)], recipes, foods).lines;

  it('subtracts available pantry stock with unit conversion', () => {
    const pantry: PantryItem[] = [{ id: 'p', foodId: 'rice', quantity: 0.15, unit: 'kg', available: true }];
    const r = subtractPantry(lines, pantry);
    expect(find(r.lines, 'Rice').quantity).toBeCloseTo(50);
    expect(r.covered[0]).toMatchObject({ name: 'Rice', fullyCovered: false });
  });

  it('removes fully covered items', () => {
    const pantry: PantryItem[] = [{ id: 'p', foodId: 'oil', quantity: 500, unit: 'ml', available: true }];
    const r = subtractPantry(lines, pantry);
    expect(find(r.lines, 'Olive oil')).toBeUndefined();
    expect(r.covered[0].fullyCovered).toBe(true);
  });

  it('ignores unavailable or incompatible pantry items', () => {
    const pantry: PantryItem[] = [
      { id: 'p1', foodId: 'chicken', quantity: 1000, unit: 'g', available: false },
      { id: 'p2', foodId: 'rice', quantity: 2, unit: 'cup', available: true },
    ];
    const r = subtractPantry(lines, pantry);
    expect(find(r.lines, 'Chicken').quantity).toBe(350);
    expect(find(r.lines, 'Rice').quantity).toBe(200);
    expect(r.covered).toEqual([]);
  });

  it('never assumes an item is available without a pantry entry', () => {
    expect(subtractPantry(lines, []).lines).toEqual(lines);
  });
});

describe('mergeGroceryList / generateGroceryList', () => {
  const manual: GroceryItem = { id: 'm1', name: 'Paper towels', category: 'other', quantity: 1, unit: 'pack', checked: false, source: 'manual' };

  it('preserves manual items on regenerate', () => {
    const lines = aggregateIngredients([sel('cr', 1)], recipes, foods).lines;
    const merged = mergeGroceryList([manual], lines, { keepManual: true });
    expect(merged.find((i) => i.id === 'm1')).toBeTruthy();
    expect(merged.filter((i) => i.source === 'generated')).toHaveLength(3);
  });

  it('drops manual items when asked', () => {
    const lines = aggregateIngredients([sel('cr', 1)], recipes, foods).lines;
    expect(mergeGroceryList([manual], lines, { keepManual: false }).some((i) => i.source === 'manual')).toBe(false);
  });

  it('keeps purchased ticks for items still needed', () => {
    const first = generateGroceryList({ selections: [sel('cr', 1)], recipes, foods, pantry: [], existing: [], subtractPantry: false, keepManual: true });
    const ticked = first.items.map((i) => (i.name === 'Chicken' ? { ...i, checked: true } : i));
    const second = generateGroceryList({ selections: [sel('cr', 2)], recipes, foods, pantry: [], existing: ticked, subtractPantry: false, keepManual: true });
    const chicken = second.items.find((i) => i.name === 'Chicken')!;
    expect(chicken.checked).toBe(true);
    expect(chicken.quantity).toBe(400);
  });

  it('rounds countable items up for shopping', () => {
    const r = generateGroceryList({ selections: [sel('om', 3)], recipes, foods, pantry: [], existing: [], subtractPantry: false, keepManual: true });
    expect(r.items.find((i) => i.name === 'Eggs')!.quantity).toBe(5);
  });
});

describe('collectSelections', () => {
  it('reads quick, week, or both', () => {
    const week = emptyWeek();
    week.mon.dinner.push(sel('cr', 2));
    week.fri.breakfast.push(sel('om', 1));
    const quick = [sel('bb', 1)];
    expect(collectSelections(quick, week, 'quick')).toHaveLength(1);
    expect(collectSelections(quick, week, 'week')).toHaveLength(2);
    expect(collectSelections(quick, week, 'both')).toHaveLength(3);
  });
});

describe('import validation', () => {
  it('round-trips default data', () => {
    const d = createDefaultData();
    expect(parseAppData(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it('rejects non-backup files with a clear error', () => {
    expect(() => parseAppData({ hello: 'world' })).toThrow(ImportError);
    expect(() => parseAppData([1, 2])).toThrow(/not a Larder backup/);
  });
  it('rejects malformed ingredients', () => {
    const d = createDefaultData() as any;
    d.recipes[0].ingredients[0].unit = 'bushel';
    expect(() => parseAppData(d)).toThrow(/Ingredient #1/);
  });
});

describe('seed data integrity', () => {
  it('every built-in recipe ingredient references a built-in food', () => {
    const d = createDefaultData();
    const ids = new Set(d.foods.map((f) => f.id));
    for (const r of d.recipes) for (const i of r.ingredients) expect(ids.has(i.foodId), `${r.name}: ${i.foodId}`).toBe(true);
  });
});
