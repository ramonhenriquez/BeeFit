import { expect, test, type Locator, type Page } from '@playwright/test';
import { BEEFIT_THEMES, APPEARANCE_KEY } from '../src/lib/appearance';
import { createDefaultData, RECOVERY_KEY, STORAGE_KEY } from '../src/lib/storage';
import type { ThemePref } from '../src/types';
import { contrast } from '../tests/helpers/contrast';

async function colors(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const background = (node: Element | null): string => {
      if (!node) throw new Error('No opaque background found');
      const color = getComputedStyle(node).backgroundColor;
      return color === 'rgba(0, 0, 0, 0)' || color === 'transparent' ? background(node.parentElement) : color;
    };
    return {
      text: style.color, fill: background(element), outside: background(element.parentElement),
      border: style.borderTopColor, width: parseFloat(style.borderTopWidth),
      outline: style.outlineColor, outlineWidth: parseFloat(style.outlineWidth), outlineStyle: style.outlineStyle,
    };
  });
}

async function textContrast(locator: Locator) {
  const value = await colors(locator);
  expect(contrast(value.text, value.fill), `Text contrast for ${await locator.textContent()}`).toBeGreaterThanOrEqual(4.5);
}

async function borderContrast(locator: Locator) {
  const value = await colors(locator);
  expect(value.width).toBeGreaterThanOrEqual(1);
  expect(contrast(value.border, value.fill), 'Control border against its fill').toBeGreaterThanOrEqual(3);
  expect(contrast(value.border, value.outside), 'Control border against surrounding surface').toBeGreaterThanOrEqual(3);
}

async function keyboardFocus(page: Page, control: Locator) {
  // Reach the control with a real Tab key so :focus-visible is exercised.
  await page.keyboard.press('Tab');
  await control.focus();
  await expect(control).toBeFocused();
  const value = await colors(control);
  expect(value.outlineStyle).toBe('solid');
  expect(value.outlineWidth).toBeGreaterThanOrEqual(3);
  expect(contrast(value.outline, value.outside), 'Keyboard focus outline').toBeGreaterThanOrEqual(3);
}

async function seed(page: Page, preset: string, preference: ThemePref, rawOverride?: string) {
  const data = createDefaultData();
  data.settings.theme = preference;
  data.pantry = [false, true].map((available, index) => ({
    id: `a11y-pantry-${index}`, foodId: data.foods[index].id, quantity: available ? 1 : 0,
    unit: data.foods[index].defaultUnit, available,
  }));
  const raw = rawOverride ?? JSON.stringify(data);
  const backup = 'previous saved copy — retain these exact bytes';
  await page.addInitScript(({ raw, backup, preset, keys }) => {
    if (sessionStorage.getItem('a11y:seeded')) return;
    localStorage.setItem(keys.data, raw);
    localStorage.setItem(keys.backup, backup);
    localStorage.setItem(keys.appearance, preset);
    sessionStorage.setItem('a11y:seeded', 'yes');
  }, { raw, backup, preset, keys: { data: STORAGE_KEY, backup: RECOVERY_KEY, appearance: APPEARANCE_KEY } });
  return { raw, backup };
}

for (const theme of BEEFIT_THEMES) {
  for (const preference of ['light', 'dark', 'system'] as const) {
    for (const device of ['light', 'dark'] as const) {
      test(`${theme.label}: ${preference} preference on ${device} device`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: device, reducedMotion: 'reduce' });
        const original = await seed(page, theme.id, preference);
        await page.goto('/#/settings');
        const effective = preference === 'system' ? device : preference;
        await expect(page.locator('html')).toHaveAttribute('data-gym-theme', theme.id);
        expect(await page.locator('html').evaluate((e) => getComputedStyle(e).colorScheme)).toBe(effective);
        if (preference === 'system') await expect(page.locator('html')).not.toHaveAttribute('data-theme');
        else await expect(page.locator('html')).toHaveAttribute('data-theme', preference);
        await expect(page).toHaveTitle('BeeFit — Plan meals. Build better.');
        await expect(page.getByRole('img', { name: 'BeeFit strong bee lifting a barbell' })).toBeVisible();
        await expect(page.getByRole('button', { name: new RegExp(theme.label) })).toHaveAttribute('aria-pressed', 'true');
        for (const label of await page.locator('.beefit-theme-card small, .nav-item.is-active').all()) await textContrast(label);
        const primary = page.getByRole('button', { name: 'Export backup', exact: true });
        await textContrast(primary);
        await primary.hover();
        await textContrast(primary);

        const reset = page.getByRole('button', { name: 'Reset app', exact: true });
        await textContrast(reset);
        await reset.hover();
        await textContrast(reset);
        await keyboardFocus(page, reset);
        await reset.press('Enter');
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await textContrast(dialog.locator('.btn-danger'));
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(dialog).not.toBeVisible();

        const paste = page.getByRole('textbox', { name: 'Paste backup JSON', exact: true });
        await borderContrast(paste);
        await paste.hover();
        await borderContrast(paste);
        await page.goto('/#/foods');
        const search = page.getByRole('searchbox', { name: 'Search foods' });
        await borderContrast(search);
        await page.getByRole('button', { name: 'Add food', exact: true }).click();
        const editor = page.getByRole('dialog');
        for (const [label, role] of [['Name', 'textbox'], ['Category', 'combobox'], ['Usual quantity', 'spinbutton'], ['Unit', 'combobox'], ['Notes', 'textbox']] as const) {
          const control = editor.getByRole(role, { name: new RegExp(`^${label}\\b`) });
          await expect(control).toHaveAccessibleName(new RegExp(label));
          await page.mouse.move(0, 0);
          await borderContrast(control);
          await control.hover();
          await borderContrast(control);
          await keyboardFocus(page, control);
        }
        await editor.getByRole('button', { name: 'Add food', exact: true }).click();
        await expect(editor.getByRole('alert')).toHaveText('Enter a name.');
        await borderContrast(editor.locator('.has-error input'));
        await textContrast(editor.getByRole('alert'));
        await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.goto('/#/pantry');
        await expect(page.locator('.switch input')).toHaveCount(2);
        for (const toggle of await page.locator('.switch input').all()) {
          const value = await colors(toggle);
          expect(contrast(value.fill, value.outside), 'Switch boundary').toBeGreaterThanOrEqual(3);
          const thumb = await toggle.evaluate((e) => getComputedStyle(e, '::after').backgroundColor);
          expect(contrast(thumb, value.fill), 'Switch thumb').toBeGreaterThanOrEqual(3);
          await keyboardFocus(page, toggle);
        }

        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-gym-theme', theme.id);
        expect(await page.evaluate(({ data, backup, appearance }) => ({
          raw: localStorage.getItem(data), backup: localStorage.getItem(backup), preset: localStorage.getItem(appearance),
        }), { data: STORAGE_KEY, backup: RECOVERY_KEY, appearance: APPEARANCE_KEY })).toEqual({ ...original, preset: theme.id });
      });
    }
  }
}

test('preset and display-mode changes persist without adding fields to meal data or changing backups', async ({ page }) => {
  const original = await seed(page, 'iron-hive', 'system');
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/#/settings');
  for (const theme of BEEFIT_THEMES) {
    await page.getByRole('button', { name: new RegExp(theme.label) }).click();
    await expect(page.locator('html')).toHaveAttribute('data-gym-theme', theme.id);
    await page.reload();
    await expect(page.getByRole('button', { name: new RegExp(theme.label) })).toHaveAttribute('aria-pressed', 'true');
    for (const [label, mode] of [['Dark', 'dark'], ['Light', 'light'], ['Match device', 'system']] as const) {
      await page.getByRole('radio', { name: label, exact: true }).click();
      await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).settings.theme, STORAGE_KEY)).toBe(mode);
      const expected = JSON.parse(original.raw); expected.settings.theme = mode;
      expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)).toEqual(expected);
      await page.reload();
      await expect(page.getByRole('radio', { name: label, exact: true })).toHaveAttribute('aria-checked', 'true');
    }
  }
  const reset = page.getByRole('button', { name: 'Reset app', exact: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.locator('html').evaluate((e) => getComputedStyle(e).colorScheme)).toBe('dark');
  await textContrast(reset);
  await page.emulateMedia({ colorScheme: 'light' });
  await textContrast(reset);
  expect(await page.evaluate((key) => localStorage.getItem(key), RECOVERY_KEY)).toBe('previous saved copy — retain these exact bytes');
});

for (const theme of BEEFIT_THEMES) {
  for (const device of ['light', 'dark'] as const) {
    test(`${theme.label}: recovery screen contrast and byte preservation on ${device} device`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: device, reducedMotion: 'reduce' });
      const damaged = '{damaged original UI-01 data';
      await seed(page, theme.id, 'system', damaged);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Recover saved data', exact: true })).toBeVisible();
      const reset = page.getByRole('button', { name: 'Reset app', exact: true });
      await textContrast(reset);
      await reset.click();
      const dialog = page.getByRole('dialog');
      await textContrast(dialog.locator('.btn-danger'));
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(damaged);
      expect(await page.evaluate((key) => localStorage.getItem(key), RECOVERY_KEY)).toBe('previous saved copy — retain these exact bytes');
    });
  }
}
