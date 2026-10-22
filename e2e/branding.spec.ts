import { expect, test } from '@playwright/test';
import { BEEFIT_THEMES, APPEARANCE_KEY } from '../src/lib/appearance';
import { createDefaultData, STORAGE_KEY } from '../src/lib/storage';

for (const theme of BEEFIT_THEMES) {
  for (const mode of ['light', 'dark'] as const) {
    for (const width of [390, 1280]) {
      test(`${theme.label} ${mode} at ${width}px: every page retains the brand and fits the viewport`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
        const data = createDefaultData(); data.settings.theme = mode;
        const raw = JSON.stringify(data);
        await page.addInitScript(({ raw, key, appearance, preset }) => {
          localStorage.setItem(key, raw); localStorage.setItem(appearance, preset);
        }, { raw, key: STORAGE_KEY, appearance: APPEARANCE_KEY, preset: theme.id });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        for (const route of ['dashboard', 'planner', 'recipes', 'shopping', 'foods', 'pantry', 'settings']) {
          await page.goto(`/#/${route}`);
          await expect(page.locator('main h1')).toBeVisible();
          await expect(page.getByRole('img', { name: 'BeeFit strong bee lifting a barbell', exact: true })).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), route).toBeLessThanOrEqual(1);
          expect(await page.locator('body').innerText()).not.toContain('Larder');
        }
        expect(errors).toEqual([]);
        expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);
      });
    }
  }
}
