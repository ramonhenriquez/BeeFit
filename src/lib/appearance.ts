export const APPEARANCE_KEY = 'beefit:appearance:v1';
export const BEEFIT_THEMES = [
  { id: 'iron-hive', label: 'Iron Hive', description: 'Gold and graphite' },
  { id: 'midnight-bulk', label: 'Midnight Bulk', description: 'Electric lime and midnight blue' },
  { id: 'clean-cut', label: 'Clean Cut', description: 'Calm green and clean neutrals' },
  { id: 'titanium', label: 'Titanium', description: 'Steel and electric blue' },
] as const;
export type BeeFitTheme = (typeof BEEFIT_THEMES)[number]['id'];

export function readBeeFitTheme(): BeeFitTheme {
  try {
    const saved = window.localStorage.getItem(APPEARANCE_KEY);
    if (BEEFIT_THEMES.some((theme) => theme.id === saved)) return saved as BeeFitTheme;
  } catch { /* Storage may be unavailable; continue with a safe default. */ }
  return 'iron-hive';
}

export function applyBeeFitTheme(theme: BeeFitTheme): void {
  document.documentElement.dataset.gymTheme = theme;
  try { window.localStorage.setItem(APPEARANCE_KEY, theme); } catch { /* Appearance is optional. */ }
}
