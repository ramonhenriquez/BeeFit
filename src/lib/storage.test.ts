import { describe, expect, it, vi } from 'vitest';
import type { AppData } from '../types';
import { PersistenceSession } from './persistence';
import { createDefaultData, ImportError, parseAppData, type StorageAdapter } from './storage';

type Damage = { name: string; path: string; value: unknown };
const selection = { id: 'meal', recipeId: createDefaultData().recipes[0].id, servings: 3 };
const invalidSelections: [string, unknown][] = [
  ['null record', null], ['array record', []], ['primitive record', 3],
  ['missing id', { recipeId: selection.recipeId, servings: 3 }],
  ['invalid id', { ...selection, id: 3 }], ['empty id', { ...selection, id: ' ' }],
  ['missing recipe', { id: 'meal', servings: 3 }], ['empty recipe', { ...selection, recipeId: '' }],
  ['string servings', { ...selection, servings: '3' }], ['missing servings', { ...selection, servings: undefined }],
  ['zero servings', { ...selection, servings: 0 }], ['negative servings', { ...selection, servings: -1 }],
  ['nonfinite servings', { ...selection, servings: Infinity }],
  ['unsupported field', { ...selection, unsupported: 'must not discard' }],
];
const damaged: Damage[] = [];
for (const path of ['quick', 'week.mon.dinner']) {
  for (const [name, value] of invalidSelections) damaged.push({ name: `${path}: ${name}`, path, value: [selection, value] });
}
for (const path of ['foods', 'recipes', 'quick', 'grocery', 'pantry', 'recipes.0.ingredients', 'week.mon.dinner']) {
  for (const value of [undefined, null, {}, 'wrong', 3]) damaged.push({ name: `${path}: collection ${JSON.stringify(value)}`, path, value });
}
for (const path of ['week', 'week.mon', 'settings']) {
  for (const value of [undefined, null, [], 'wrong', 3]) damaged.push({ name: `${path}: object ${JSON.stringify(value)}`, path, value });
}
damaged.push(
  { name: 'missing weekday', path: 'week.sun', value: undefined },
  { name: 'missing weekly slot', path: 'week.mon.breakfast', value: undefined },
  { name: 'unsupported weekday', path: 'week.monday', value: { dinner: [selection] } },
  { name: 'unsupported slot', path: 'week.mon.snacks', value: [selection] },
  { name: 'unsupported top-level data', path: 'unrecognized', value: [selection] },
  { name: 'food category cannot default', path: 'foods.0.category', value: 'unknown-category' },
  { name: 'food amount cannot default', path: 'foods.0.defaultQuantity', value: 0 },
  { name: 'food unit cannot default', path: 'foods.0.defaultUnit', value: 'bushel' },
  { name: 'optional notes cannot disappear', path: 'foods.0.notes', value: 3 },
  { name: 'optional custom flag cannot disappear', path: 'foods.0.custom', value: 'yes' },
  { name: 'recipe servings cannot default', path: 'recipes.0.servings', value: -1 },
  { name: 'recipe description cannot default', path: 'recipes.0.description', value: undefined },
  { name: 'recipe instructions cannot disappear', path: 'recipes.0.instructions', value: [] },
  { name: 'recipe prep cannot be negative', path: 'recipes.0.prepMinutes', value: -1 },
  { name: 'ingredient amount cannot be ignored', path: 'recipes.0.ingredients.0.quantity', value: -2 },
  { name: 'invalid theme cannot default', path: 'settings.theme', value: 'unknown' },
  { name: 'missing theme cannot default', path: 'settings.theme', value: undefined },
  { name: 'invalid list source cannot default', path: 'settings.listSource', value: [] },
  { name: 'missing stock preference cannot default', path: 'settings.subtractPantry', value: undefined },
  { name: 'invalid manual preference cannot default', path: 'settings.keepManualItems', value: 'false' },
);

function setPath(input: AppData, path: string, value: unknown) {
  const keys = path.split('.');
  let target = input as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys[keys.length - 1]] = value;
}

function savedSession(raw: string) {
  let stored = raw;
  const adapter: StorageAdapter = {
    load: vi.fn(() => stored), save: vi.fn((value: string) => { stored = value; }),
    backup: vi.fn(), loadBackup: vi.fn(() => null),
  };
  return { adapter, session: new PersistenceSession(adapter), stored: () => stored };
}

describe('damaged v1 data must not be silently repaired', () => {
  it.each(damaged)('$name: recover and preserve bytes even after an unrelated edit', ({ path, value }) => {
    const input = createDefaultData(); setPath(input, path, value);
    const raw = JSON.stringify(input, null, 2);
    expect(() => parseAppData(JSON.parse(raw))).toThrow(ImportError);
    const { session, adapter, stored } = savedSession(raw);
    expect(session.getSnapshot().persistence).toMatchObject({ kind: 'recovery', reason: 'invalid', raw });
    // This is the original data-loss trigger: an unrelated theme edit after load.
    const edit = vi.fn((data: AppData): AppData => ({ ...data, settings: { ...data.settings, theme: 'dark' } }));
    session.update(edit); session.save(); session.retryLoad(); session.update(edit); session.save();
    expect(edit).not.toHaveBeenCalled();
    expect(adapter.save).not.toHaveBeenCalled(); expect(adapter.backup).not.toHaveBeenCalled();
    expect(stored()).toBe(raw);
  });

  it('reports the damaged selection path instead of dropping it or making up an id', () => {
    const input = createDefaultData(); setPath(input, 'week.fri.lunch', [{ ...selection, servings: '3' }]);
    expect(() => parseAppData(input)).toThrow('week.fri.lunch[0].servings');
    setPath(input, 'week.fri.lunch', []); setPath(input, 'quick', [{ recipeId: selection.recipeId, servings: 3 }]);
    expect(() => parseAppData(input)).toThrow('quick[0].id');
  });

  it('rejects nonfinite selection values passed directly to validation', () => {
    for (const servings of [NaN, Infinity, -Infinity]) {
      const input = createDefaultData(); setPath(input, 'quick', [{ ...selection, servings }]);
      expect(() => parseAppData(input)).toThrow('quick[0].servings');
    }
  });
});

describe('valid v1 data stays unchanged', () => {
  it('round-trips populated plans, optional values, zero pantry stock and manual groceries', () => {
    const input = createDefaultData();
    input.quick = [{ id: 'quick', recipeId: input.recipes[0].id, servings: 0.5 }];
    input.week.mon.dinner = [{ id: 'weekly', recipeId: input.recipes[1].id, servings: 4 }];
    input.foods[0] = { ...input.foods[0], name: '  Keep original name spacing  ', notes: '', custom: false };
    input.recipes[0] = { ...input.recipes[0], custom: false, instructions: '', prepMinutes: 0 };
    input.pantry = [{ id: 'stock', foodId: input.foods[0].id, quantity: 0, unit: 'g', available: false }];
    input.grocery = [{ id: 'manual', name: 'Paper towels', quantity: null, unit: null, category: 'other', checked: false, source: 'manual' }];
    input.settings = { theme: 'dark', listSource: 'quick', subtractPantry: false, keepManualItems: false };
    input.lastGeneratedAt = '2026-10-19T12:00:00Z';
    const raw = JSON.stringify(input, null, 2);
    const parsed = parseAppData(JSON.parse(raw));
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(JSON.parse(raw));
    const { session, stored } = savedSession(raw);
    expect(session.getSnapshot().persistence.kind).toBe('saved'); expect(stored()).toBe(raw);
    session.update((data) => ({ ...data, settings: { ...data.settings, theme: 'light' } }));
    expect(session.save()).toBe(true);
    expect(JSON.parse(stored())).toEqual({ ...JSON.parse(raw), settings: { ...input.settings, theme: 'light' } });
  });

  it('rejects invalid grocery/pantry fields rather than filtering or clamping them', () => {
    const input = createDefaultData();
    input.grocery = [{ id: 'g', name: 'Rice', quantity: 1, unit: 'g', category: 'grains', checked: false, source: 'generated', fromRecipes: ['Rice recipe'] }];
    input.pantry = [{ id: 'p', foodId: input.foods[0].id, quantity: 1, unit: 'g', available: true }];
    for (const [path, value] of [
      ['grocery.0.quantity', '1'], ['grocery.0.unit', 'unknown'], ['grocery.0.checked', 'false'],
      ['grocery.0.source', 'unknown'], ['grocery.0.fromRecipes', ['Rice recipe', 3]],
      ['grocery.0.fromRecipes', {}], ['pantry.0.quantity', -1], ['pantry.0.available', undefined],
    ] as [string, unknown][]) {
      const damaged = structuredClone(input); setPath(damaged, path, value);
      const raw = JSON.stringify(damaged); const { session, stored, adapter } = savedSession(raw);
      expect(session.getSnapshot().persistence.kind).toBe('recovery');
      session.save(); expect(stored()).toBe(raw); expect(adapter.save).not.toHaveBeenCalled();
    }
    expect(parseAppData(input)).toEqual(input);
  });
});
