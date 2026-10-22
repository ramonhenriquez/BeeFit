import { expect, test, type Page } from '@playwright/test';
import { createDefaultData, RECOVERY_KEY, STORAGE_KEY } from '../src/lib/storage';

declare global {
  interface Window {
    storageTest: { readBlocked: boolean; writeBlocked: boolean; backupBlocked: boolean; writes: string[] };
  }
}

async function seed(page: Page, raw: string | null, readBlocked = false) {
  await page.addInitScript(({ raw, readBlocked, key, recoveryKey }) => {
    if (!sessionStorage.getItem('test:seeded')) {
      if (raw !== null) localStorage.setItem(key, raw);
      sessionStorage.setItem('test:seeded', 'yes');
    }
    window.storageTest = { readBlocked, writeBlocked: false, backupBlocked: false, writes: [] };
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (name) {
      if (this === localStorage && name === key && window.storageTest.readBlocked) throw new DOMException('Read denied', 'SecurityError');
      return getItem.call(this, name);
    };
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage) {
        if (name === key) {
          window.storageTest.writes.push(value);
          if (window.storageTest.writeBlocked) throw new DOMException('No space', 'QuotaExceededError');
        }
        if (name === recoveryKey && window.storageTest.backupBlocked) throw new DOMException('No backup space', 'QuotaExceededError');
      }
      return setItem.call(this, name, value);
    };
  }, { raw, readBlocked, key: STORAGE_KEY, recoveryKey: RECOVERY_KEY });
}

const saved = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
const checkpoint = (page: Page) => page.evaluate((key) => localStorage.getItem(key), RECOVERY_KEY);
const downloadText = async (page: Page, name: string) => {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const download = await event;
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Download stream unavailable');
  const parts: Buffer[] = [];
  for await (const part of stream) parts.push(Buffer.from(part));
  return Buffer.concat(parts).toString('utf8');
};

function damagedSnapshot(path: string, value: unknown): string {
  const data = createDefaultData();
  const keys = path.split('.');
  let target = data as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys[keys.length - 1]] = value;
  return JSON.stringify(data, null, 2);
}
const validMeal = { id: 'kept', recipeId: createDefaultData().recipes[0].id, servings: 3 };

for (const [name, raw] of [
  ['corrupt JSON', '{broken\n\u2603'],
  ['invalid schema', JSON.stringify({ version: 1, foods: 'bad', recipes: [] })],
  ['newer version', JSON.stringify({ ...createDefaultData(), version: 2, future: 'keep me' })],
  ['malformed quick selection', damagedSnapshot('quick', [validMeal, { ...validMeal, id: 'bad', servings: '3' }])],
  ['malformed weekly selection', damagedSnapshot('week.mon.dinner', [validMeal, { ...validMeal, id: 'bad', servings: '3' }])],
  ['missing selection id', damagedSnapshot('quick', [{ recipeId: validMeal.recipeId, servings: 3 }])],
  ['invalid weekly servings', damagedSnapshot('week.fri.lunch', [{ ...validMeal, servings: 0 }])],
  ['wrong quick collection', damagedSnapshot('quick', {})],
  ['wrong weekly collection', damagedSnapshot('week.mon.dinner', {})],
  ['wrong week object', damagedSnapshot('week', [])],
  ['missing quick collection', damagedSnapshot('quick', undefined)],
  ['missing grocery collection', damagedSnapshot('grocery', undefined)],
  ['missing weekday', damagedSnapshot('week.mon', undefined)],
  ['unsupported meal slot', damagedSnapshot('week.mon.snacks', [validMeal])],
  ['wrong settings object', damagedSnapshot('settings', [])],
] as const) {
  test(`${name}: mount, lifecycle flush, retry and reload preserve original bytes`, async ({ page }) => {
    await seed(page, raw); await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Recover saved data' })).toBeVisible();
    await expect(page.getByLabel('Original saved data')).toHaveValue(raw);
    await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toHaveCount(0);
    await page.waitForTimeout(600); // Past the ordinary debounce, including StrictMode mount effects.
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(await saved(page)).toBe(raw);
    await page.getByRole('button', { name: 'Retry loading saved data' }).click();
    await page.reload(); await expect(page.getByLabel('Original saved data')).toHaveValue(raw);
    expect(await saved(page)).toBe(raw);
    expect(await page.evaluate(() => window.storageTest.writes)).toHaveLength(0);
    expect(await downloadText(page, 'Export original saved data')).toBe(raw);
  });
}

test('valid data loads unchanged and ordinary edits persist across reload', async ({ page }) => {
  const original = JSON.stringify(createDefaultData(), null, 2);
  await seed(page, original); await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings & backup' })).toBeVisible();
  await page.waitForTimeout(600); expect(await saved(page)).toBe(original);
  expect(await page.evaluate(() => window.storageTest.writes)).toHaveLength(0);
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect.poll(async () => JSON.parse((await saved(page))!).settings.theme).toBe('dark');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('empty storage is not written until a user edit, and pagehide flushes pending work', async ({ page }) => {
  await seed(page, null); await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings & backup' })).toBeVisible();
  expect(await saved(page)).toBeNull();
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(JSON.parse((await saved(page))!).settings.theme).toBe('dark');
});

test('reset cancellation preserves raw bytes; confirmation archives them before replacing', async ({ page }) => {
  const raw = '{broken'; await seed(page, raw); await page.goto('/');
  await page.getByRole('button', { name: 'Reset app', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await saved(page)).toBe(raw); expect(await checkpoint(page)).toBeNull();
  await page.getByRole('button', { name: 'Reset app', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset app', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Fuel your\s*next rep\./ })).toBeVisible();
  expect(await checkpoint(page)).toBe(raw); expect(JSON.parse((await saved(page))!)).toEqual(createDefaultData());
  await page.getByRole('button', { name: /Settings & backup/ }).click();
  expect(await downloadText(page, 'Export previous saved copy')).toBe(raw);
});

test('restore a valid file only after confirmation, preserving the corrupt original', async ({ page }) => {
  const raw = '{broken'; const restored = createDefaultData(); restored.settings.theme = 'dark';
  await seed(page, raw); await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(restored)) });
  await expect(page.getByRole('dialog')).toBeVisible(); expect(await saved(page)).toBe(raw);
  await page.getByRole('button', { name: 'Import backup', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Fuel your\s*next rep\./ })).toBeVisible();
  expect(await checkpoint(page)).toBe(raw); expect(JSON.parse((await saved(page))!)).toEqual(restored);
});

test('invalid imports never replace the protected original', async ({ page }) => {
  const raw = '{broken'; await seed(page, raw); await page.goto('/');
  await page.getByLabel('Paste backup JSON').fill('{bad');
  await page.getByRole('button', { name: 'Import pasted JSON' }).click();
  await expect(page.getByText('That isn’t valid JSON. Check the file and try again.')).toBeVisible();
  expect(await saved(page)).toBe(raw); expect(await checkpoint(page)).toBeNull();
});

test('backup quota failure aborts a confirmed reset without claiming success', async ({ page }) => {
  const raw = '{broken'; await seed(page, raw); await page.goto('/');
  await page.evaluate(() => { window.storageTest.backupBlocked = true; });
  await page.getByRole('button', { name: 'Reset app', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset app', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recover saved data' })).toBeVisible();
  await expect(page.getByText('Reset was not saved. Resolve the storage warning and try again.')).toBeVisible();
  expect(await saved(page)).toBe(raw); expect(await checkpoint(page)).toBeNull();
  expect(await page.evaluate(() => window.storageTest.writes)).toHaveLength(0);
});

test('denied reads block replacement, and a retry resumes without writing defaults', async ({ page }) => {
  const raw = JSON.stringify(createDefaultData(), null, 2); await seed(page, raw, true); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Recover saved data' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset app', exact: true })).toBeDisabled();
  await page.evaluate(() => { window.storageTest.readBlocked = false; });
  await page.getByRole('button', { name: 'Retry loading saved data' }).click();
  await expect(page.getByRole('heading', { name: /Fuel your\s*next rep\./ })).toBeVisible();
  expect(await saved(page)).toBe(raw);
  expect(await page.evaluate(() => window.storageTest.writes)).toHaveLength(0);
});

test('failed saves show a durable warning, export unsaved work and retry the latest edits', async ({ page }) => {
  const raw = JSON.stringify(createDefaultData()); await seed(page, raw); await page.goto('/#/foods');
  await page.evaluate(() => { window.storageTest.writeBlocked = true; });
  await page.getByRole('button', { name: 'Add food', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Unsaved test food');
  await page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }).click();
  await expect(page.getByRole('alert').getByText('Changes are not saved', { exact: true })).toBeVisible();
  expect(await saved(page)).toBe(raw);
  await page.waitForTimeout(500);
  const attempts = await page.evaluate(() => window.storageTest.writes.length);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => window.storageTest.writes.length)).toBe(attempts);
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented;
  })).toBe(true);
  await page.getByRole('button', { name: 'Open backup options' }).click();
  const backup = JSON.parse(await downloadText(page, 'Export backup'));
  expect(backup.foods.some((f: { name: string }) => f.name === 'Unsaved test food')).toBe(true);
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect(page.getByText('Changes are not saved', { exact: true })).toBeVisible();
  expect(await saved(page)).toBe(raw);
  await page.evaluate(() => { window.storageTest.writeBlocked = false; });
  await page.getByRole('button', { name: 'Retry saving' }).click();
  await expect(page.getByText('Changes are not saved', { exact: true })).toHaveCount(0);
  expect(JSON.parse((await saved(page))!).settings.theme).toBe('dark');
  await page.reload();
  const data = JSON.parse((await saved(page))!);
  expect(data.foods.some((f: { name: string }) => f.name === 'Unsaved test food')).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('food → recipe → meal plan → pantry → groceries still scales and persists', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await seed(page, JSON.stringify(createDefaultData()));
  await page.goto('/#/foods');
  await page.getByRole('button', { name: 'Add food', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Regression lentils');
  await page.getByLabel('Usual quantity').fill('100');
  await page.getByRole('dialog').locator('select').nth(1).selectOption('g');
  await page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }).click();
  await expect.poll(async () => JSON.parse((await saved(page))!).foods.some((f: { name: string }) => f.name === 'Regression lentils')).toBe(true);
  const foodId = JSON.parse((await saved(page))!).foods.find((f: { name: string }) => f.name === 'Regression lentils').id;
  await page.getByRole('button', { name: /Recipes/, exact: true }).click();
  await page.getByRole('button', { name: 'New recipe', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Regression stew');
  await page.getByLabel('Serves', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Add ingredient', exact: true }).click();
  await page.getByLabel('Ingredient 1', { exact: true }).selectOption(foodId);
  await page.getByLabel('Amount for ingredient 1').fill('200');
  await page.getByRole('button', { name: 'Create recipe', exact: true }).click();
  await page.getByRole('button', { name: /Meal planner/ }).click();
  await page.getByRole('button', { name: 'Add dinner on Monday', exact: true }).click();
  await page.getByRole('option', { name: /Regression stew/ }).click();
  await page.getByRole('button', { name: 'More servings', exact: true }).click();
  await page.getByRole('button', { name: 'Add meal', exact: true }).click();
  await page.getByRole('button', { name: /Pantry/, exact: true }).click();
  await page.getByLabel('Food', { exact: true }).selectOption(foodId);
  await page.getByLabel('Quantity on hand').fill('50');
  await page.getByRole('button', { name: 'Add to pantry', exact: true }).click();
  await page.getByRole('button', { name: /Shopping list/ }).click();
  await page.getByRole('button', { name: 'Generate shopping list', exact: true }).click();
  await expect.poll(async () => JSON.parse((await saved(page))!).grocery.find((g: { foodId: string }) => g.foodId === foodId)?.quantity).toBe(250);
  await page.getByLabel('Item name', { exact: true }).fill('Regression towels');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.locator('.item-check').filter({ hasText: 'Regression lentils' }).locator('input').check();
  await page.getByRole('button', { name: 'Regenerate shopping list', exact: true }).click();
  await expect.poll(async () => JSON.parse((await saved(page))!).grocery.find((g: { foodId: string }) => g.foodId === foodId)?.checked).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Shopping list', exact: true })).toBeVisible();
  const data = JSON.parse((await saved(page))!);
  expect(data.grocery.some((g: { name: string }) => g.name === 'Regression towels')).toBe(true);
  expect(data.pantry.find((p: { foodId: string }) => p.foodId === foodId).quantity).toBe(50);
  expect(errors).toEqual([]);
});


test('a malformed-selection import is rejected without replacing a valid open plan', async ({ page }) => {
  const data = createDefaultData(); data.quick = [validMeal]; data.week.mon.dinner = [{ ...validMeal, id: 'weekly' }];
  const raw = JSON.stringify(data, null, 2); await seed(page, raw); await page.goto('/#/settings');
  await page.getByLabel('Paste backup JSON').fill(damagedSnapshot('quick', [validMeal, { ...validMeal, servings: '3' }]));
  await page.getByRole('button', { name: 'Import pasted JSON' }).click();
  await expect(page.getByRole('alert')).toContainText('quick[1].servings');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await saved(page)).toBe(raw); expect(await checkpoint(page)).toBeNull();
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect.poll(async () => JSON.parse((await saved(page))!).settings.theme).toBe('dark');
  const after = JSON.parse((await saved(page))!);
  expect(after.quick).toEqual(data.quick); expect(after.week).toEqual(data.week);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Settings & backup' })).toBeVisible();
});

test('a valid populated backup retains quick and weekly selections through restore and unrelated edits', async ({ page }) => {
  const data = createDefaultData(); data.quick = [{ ...validMeal, servings: 0.5 }];
  data.week.fri.lunch = [{ ...validMeal, id: 'weekly', servings: 4 }];
  data.foods[0].custom = false; data.recipes[0].prepMinutes = 0;
  await seed(page, JSON.stringify(createDefaultData())); await page.goto('/#/settings');
  await page.getByLabel('Paste backup JSON').fill(JSON.stringify(data));
  await page.getByRole('button', { name: 'Import pasted JSON' }).click();
  await page.getByRole('button', { name: 'Import backup', exact: true }).click();
  await expect.poll(async () => JSON.parse((await saved(page))!).quick).toEqual(data.quick);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Settings & backup' })).toBeVisible();
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect.poll(async () => JSON.parse((await saved(page))!).settings.theme).toBe('dark');
  const after = JSON.parse((await saved(page))!);
  expect(after).toEqual({ ...JSON.parse(JSON.stringify(data)), settings: { ...data.settings, theme: 'dark' } });
});
