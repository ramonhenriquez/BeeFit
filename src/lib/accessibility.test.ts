import css from '../styles.css?raw';
import { describe, expect, it } from 'vitest';
import { BEEFIT_THEMES } from './appearance';
import { contrast } from '../../tests/helpers/contrast';

// Read actual declarations, never duplicate token values in the expectations.
function tokens(selector: string): Record<string, string> {
  const block = css.match(new RegExp(
    `^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]+)\\}`, 'm',
  ));
  if (!block) throw new Error(`Missing CSS token block: ${selector}`);
  return Object.fromEntries([...block[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

it('calculates WCAG reference contrast without rounding a failure up', () => {
  expect(contrast('#000', '#fff')).toBe(21);
  expect(contrast('#fff', 'rgb(255, 255, 255)')).toBe(1);
  expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5);
  expect(contrast('#767676', '#ffffff')).toBeGreaterThan(4.5);
  expect(() => contrast('transparent', '#fff')).toThrow();
});

for (const theme of BEEFIT_THEMES) {
  for (const mode of ['light', 'dark'] as const) {
    describe(`${theme.label} ${mode} tokens`, () => {
      const values = {
        ...tokens(':root'),
        ...(mode === 'dark' ? tokens(":root[data-theme='dark']") : {}),
        ...tokens(`:root[data-gym-theme='${theme.id}']`),
        ...(mode === 'dark' ? tokens(`:root[data-theme='dark'][data-gym-theme='${theme.id}']`) : {}),
      };
      const check = (foreground: string, background: string, minimum: number) => {
        const resolve = (name: string): string => {
          const value = values[name];
          const reference = value.match(/^var\((--[\w-]+)\)$/);
          return reference ? resolve(reference[1]) : value;
        };
        expect(contrast(resolve(foreground), resolve(background)), `${foreground} on ${background}`).toBeGreaterThanOrEqual(minimum);
      };
      it('keeps danger, primary and hover button text at 4.5:1', () => {
        check('--on-beet', '--beet', 4.5);
        check('--on-basil', '--basil', 4.5);
        check('--on-basil', '--basil-strong', 4.5);
        check('--on-action', '--action', 4.5);
        check('--on-action', '--action-hover', 4.5);
        check('--brand-ink', '--brand', 4.5);
      });
      it('keeps normal, hover, error and focus boundaries at 3:1', () => {
        for (const background of ['--bg', '--surface', '--surface-2']) {
          for (const border of ['--control-border', '--control-border-hover', '--beet', '--focus']) check(border, background, 3);
        }
      });
      it('keeps body, muted, error and selected-navigation text at 4.5:1', () => {
        for (const background of ['--bg', '--surface', '--surface-2']) {
          for (const text of ['--ink', '--muted', '--beet']) check(text, background, 4.5);
        }
        check('--ink', '--basil-soft', 4.5);
      });
    });
  }
}
