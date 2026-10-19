import { expect, test, type Page } from '@playwright/test';
import type { AppData } from '../src/types';
import { createDefaultData, STORAGE_KEY } from '../src/lib/storage';

async function start(page: Page, data = createDefaultData()) {
  await page.addInitScript(({ raw, key }) => {
    if (!sessionStorage.getItem('features:seeded')) {
      localStorage.setItem(key, raw); sessionStorage.setItem('features:seeded', 'yes');
    }
  }, { raw: JSON.stringify(data), key: STORAGE_KEY });
}
const data = (page: Page): Promise<AppData> => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
const go = (page: Page, route: string) => page.goto(`/#/${route}`);

test('food/recipe editing, duplication, deletion, quick planning, grocery editing and backup files still work', async ({ page }) => {
  await start(page); await go(page, 'recipes');
  const original = (await data(page)).recipes[0];
  await page.getByRole('button', { name: `Duplicate ${original.name}`, exact: true }).click();
  await expect.poll(async () => (await data(page)).recipes.length).toBe(12);
  const copy = (await data(page)).recipes.find((recipe) => recipe.name === `${original.name} (copy)`)!;
  await page.getByRole('button', { name: `Edit ${copy.name}`, exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Edited regression recipe');
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click();
  await page.getByLabel('Search recipes', { exact: true }).fill('Edited regression');
  await expect(page.locator('.recipe-card')).toHaveCount(1);
  await page.locator('.recipe-card').getByRole('button', { name: 'Quick add', exact: true }).click();
  await expect.poll(async () => (await data(page)).quick.some((meal) => meal.recipeId === copy.id)).toBe(true);
  await go(page, 'planner');
  await page.getByRole('button', { name: 'Add dinner on Monday', exact: true }).click();
  await page.getByRole('option', { name: /Edited regression recipe/ }).click();
  await page.getByRole('button', { name: 'Add meal', exact: true }).click();
  await page.getByRole('radio', { name: 'Quick selection', exact: true }).click();
  await page.getByRole('button', { name: 'Generate shopping list', exact: true }).click();
  await expect.poll(async () => (await data(page)).grocery.length).toBeGreaterThan(0);
  const item = (await data(page)).grocery[0];
  await page.getByLabel(`Quantity of ${item.name}`, { exact: true }).fill('123');
  await expect.poll(async () => (await data(page)).grocery.find((g) => g.id === item.id)?.quantity).toBe(123);
  await page.locator('.item-check').filter({ hasText: item.name }).locator('input').check();
  await page.getByRole('button', { name: /Clear purchased/ }).click();
  await expect.poll(async () => (await data(page)).grocery.some((g) => g.id === item.id)).toBe(false);
  await page.getByRole('button', { name: 'Clear list', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear list', exact: true }).click();
  await expect.poll(async () => (await data(page)).grocery).toEqual([]);
  await go(page, 'recipes');
  await page.getByRole('button', { name: 'Delete Edited regression recipe', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(async () => (await data(page)).recipes.some((r) => r.id === copy.id)).toBe(false);
  expect((await data(page)).quick.some((meal) => meal.recipeId === copy.id)).toBe(false);
  expect((await data(page)).week.mon.dinner.some((meal) => meal.recipeId === copy.id)).toBe(false);
  await go(page, 'foods');
  await page.getByRole('button', { name: 'Add food', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Disposable regression food');
  await page.getByLabel('Notes', { exact: false }).fill('searchable note');
  await page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }).click();
  await page.getByLabel('Search foods', { exact: true }).fill('searchable note');
  await page.getByRole('radio', { name: 'Other', exact: true }).click();
  await expect(page.locator('.food-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit Disposable regression food', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Edited regression food');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(async () => (await data(page)).foods.some((f) => f.name === 'Edited regression food')).toBe(true);
  await page.getByRole('button', { name: 'Delete Edited regression food', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(async () => (await data(page)).foods.length).toBe(84);
  await go(page, 'settings');
  const expected = JSON.parse(JSON.stringify(await data(page)));
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadEvent; const stream = await download.createReadStream();
  if (!stream) throw new Error('Missing backup download');
  const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  expect(JSON.parse(buffer.toString('utf8'))).toEqual(expected);
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
  await page.getByRole('button', { name: 'Import backup', exact: true }).click();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Settings & backup' })).toBeVisible();
  expect(await data(page)).toEqual(expected);
});

test('weekly repeat, replacement, serving changes, removal and confirmed clearing persist', async ({ page }) => {
  const input = createDefaultData(); const first = input.recipes[0]; const second = input.recipes[1];
  input.week.mon.dinner = [{ id: 'mon', recipeId: first.id, servings: 2 }];
  await start(page, input); await go(page, 'planner');
  const monday = page.getByRole('article', { name: 'Monday', exact: true });
  await monday.getByRole('button', { name: `Repeat ${first.name} on other days`, exact: true }).click();
  await page.getByRole('dialog').getByLabel('Wednesday', { exact: true }).check();
  await page.getByRole('button', { name: 'Repeat meal', exact: true }).click();
  await expect.poll(async () => (await data(page)).week.wed.dinner.length).toBe(1);
  const wednesday = page.getByRole('article', { name: 'Wednesday', exact: true });
  await wednesday.getByTitle('Replace meal', { exact: true }).click();
  await page.getByRole('option', { name: new RegExp(second.name) }).click();
  await page.getByRole('button', { name: 'Replace meal', exact: true }).click();
  await wednesday.getByRole('button', { name: 'More servings', exact: true }).click();
  await monday.getByRole('button', { name: `Remove ${first.name}`, exact: true }).click();
  await expect.poll(async () => (await data(page)).week.wed.dinner[0]?.servings).toBe(3);
  expect((await data(page)).week.wed.dinner[0].recipeId).toBe(second.id);
  expect((await data(page)).week.mon.dinner).toEqual([]);
  await page.reload(); await expect(wednesday.getByTitle('Replace meal')).toContainText(second.name);
  await page.getByRole('button', { name: 'Clear week', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear week', exact: true }).click();
  await expect.poll(async () => Object.values((await data(page)).week).flatMap((day) => Object.values(day).flat()).length).toBe(0);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Meal planner', exact: true })).toBeVisible();
});

test('pantry edits, units, stock toggles, zero amounts and removal survive reload; used foods stay protected', async ({ page }) => {
  const input = createDefaultData(); const food = input.foods.find((f) => f.id === input.recipes[0].ingredients[0].foodId)!;
  input.pantry = [{ id: 'stock', foodId: food.id, quantity: 100, unit: 'g', available: true }];
  await start(page, input); await go(page, 'pantry');
  await page.getByLabel(`Quantity of ${food.name}`, { exact: true }).fill('0.25');
  await page.getByLabel(`Unit for ${food.name}`, { exact: true }).selectOption('kg');
  await page.getByRole('switch').uncheck();
  await expect.poll(async () => (await data(page)).pantry[0]).toEqual({ id: 'stock', foodId: food.id, quantity: 0.25, unit: 'kg', available: false });
  await page.reload(); await expect(page.getByRole('switch')).not.toBeChecked();
  await expect(page.getByLabel(`Quantity of ${food.name}`, { exact: true })).toHaveValue('0.25');
  await page.getByRole('button', { name: `Remove ${food.name} from pantry`, exact: true }).click();
  await expect.poll(async () => (await data(page)).pantry).toEqual([]);
  await page.getByLabel('Food', { exact: true }).selectOption(food.id);
  await page.getByLabel('Quantity on hand').fill('0');
  await page.getByRole('button', { name: 'Add to pantry', exact: true }).click();
  await expect.poll(async () => (await data(page)).pantry[0]?.quantity).toBe(0);
  expect((await data(page)).pantry[0].available).toBe(false);
  await go(page, 'foods'); await page.getByRole('button', { name: `Delete ${food.name}`, exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('is used in recipes');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  expect((await data(page)).foods.some((f) => f.id === food.id)).toBe(true);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Foods', exact: true })).toBeVisible();
});
