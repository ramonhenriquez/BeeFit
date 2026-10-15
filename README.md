# Larder: meal planner & grocery list generator

Choose meals → adjust servings → calculate ingredients → generate a shopping list → go shopping.

A client-side React + TypeScript app. No backend, no account. Data is saved in the browser (localStorage) and can be exported/imported as JSON.

## Run it

Use Node 24 LTS (tested with 24.19.0) and npm. No database or API credentials are needed for the current local-only app.

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests for the grocery/unit/import logic (Vitest)
npm run build      # type-check + build to dist/index.html (one self-contained file)
npm run preview    # serve the production build
```

`dist/index.html` has all JS and CSS inlined, so it can be opened directly from disk or dropped on any static host.

## Why this stack

**React + TypeScript** gives typed data models end to end (the grocery math is where bugs would hurt, and types catch unit/shape mistakes early) and a component model that suits the many repeated controls here. **Vite** for a fast dev server and simple build; `vite-plugin-singlefile` outputs one portable HTML file. **Plain CSS with custom properties** rather than a CSS framework: the design is small, theming (light/dark) is just a token swap, and there's no build-time styling dependency. **Vitest** because it shares Vite's config and runs TS directly. **lucide-react** for icons. Playwright adds production-browser regression coverage as a development-only dependency.

## Project structure

```
src/
  types.ts              Data models (Food, Recipe, MealSelection, WeekPlan, GroceryItem, PantryItem, AppData)
  data/seed.ts          Built-in foods (~85) and recipes (11)
  lib/
    units.ts            Unit dimensions, conversion, display-unit choice, shopping rounding
    grocery.ts          Pure list-generation pipeline (the core feature)
    grocery.test.ts     24 tests covering the spec example, scaling, units, pantry, merging, import
    storage.ts          Raw StorageAdapter, localStorage keys, defaults, import validation
    persistence.ts      Read-only initialization, recovery state, safe saves/replacement
    persistence.test.ts Storage failure and recovery regressions
    id.ts               ID helper
  store.tsx             React context: app data + debounced persistence + toasts
  hooks.ts              useGenerateList(): wires the pure logic to app state
  components/
    ui.tsx              Button, Modal, Field, NumberInput, Stepper, Chips, selects, confirm dialog…
    RecipePicker.tsx    Search-and-pick recipe modal used by the planner
  pages/                Dashboard, Foods, Recipes, Planner, Shopping, Pantry, Settings
  App.tsx               Shell, navigation (sidebar on desktop, tab bar on mobile), hash routing, theme
  styles.css            Design tokens and all styles
```

## How the shopping list is calculated

`src/lib/grocery.ts`, all pure functions:

1. **collectSelections**: gather meals from the quick selection, the weekly plan, or both.
2. **aggregateIngredients**: scale each recipe by `selectedServings / recipeServings`, then sum per food *and unit dimension*. Units combine only within a dimension: mass (g, kg, oz, lb), volume (ml, L, tsp, tbsp, cup, fl oz), or a single count unit (piece, slice, clove, can, pack, pinch each stand alone). 200 g + 0.5 kg → 0.7 kg; 250 ml milk and 100 g milk stay as two lines rather than being guessed together.
3. **Display unit**: if every contribution used the same unit it's kept; mixed metric becomes g/kg or ml/L; mixed kitchen measures become the largest unit that reads as ≥ 1 (1 tbsp + 3 tsp → 2 tbsp).
4. **subtractPantry** (optional): only pantry items the user added *and* marked "in stock" are subtracted, with unit conversion, and each pantry quantity is consumed once.
5. **Rounding**: pieces/cans/packs round up (you can't buy 1.5 eggs), g/ml to whole numbers, others to 2 decimals.
6. **mergeGroceryList**: generated items are replaced, manually added items are kept (unless the user unticks "Keep items I added myself"), and already-ticked items stay ticked if still needed, so regenerating mid-shop keeps progress.

## Data & storage

- All state lives in one JSON-serialisable `AppData` object (`types.ts`).
- Persistence goes through the synchronous raw-string `StorageAdapter` (`storage.ts`) and `PersistenceSession` (`persistence.ts`), subscribed to by the React context. The adapter must throw on failures. IndexedDB/Dexie and asynchronous/cloud adapters require a separate reviewed milestone; they cannot simply replace this synchronous adapter.
- Import runs through `parseAppData`; only data version 1 is currently supported. Shape checks are present, but full domain/referential validation is future work. A schema change needs explicit tested migrations; do not simply relabel or bump versions.
- Deleting a recipe removes it from plans; a food used by a recipe can't be deleted until it's removed from those recipes.

## Extending

- **Nutrition / costs**: add optional `nutrition` or `price` to `Food` (commented placeholders are in `types.ts`), then compute totals from `aggregateIngredients` output, which already has per-food quantities.
- **Favourites / tags**: add fields to `Recipe`, filter in `RecipesPage`.
- **Sharing**: `groceryListToText()` already produces a plain-text list.
- **AI suggestions, barcode scanning, recipe import**: add as new pages or modals that produce `Recipe` or `GroceryItem` objects and call `update()`.

## Recovery and backups

Startup never writes defaults. Missing data opens the normal app; malformed, invalid-schema, unsupported-version and newer-version data open a recovery screen with editing paused. Failed reads also pause replacement until a successful retry. The original raw string can be downloaded as text or copied, including invalid JSON. Use the newer Larder version for newer backups when available.

Import/reset requires confirmation. Before replacing an existing saved record, Larder preserves its exact bytes at `larder:recovery:v1`. If the recovery-copy write or replacement fails, the primary `larder:data:v1` record remains intact. Only the latest pre-replacement copy is retained; an explicit later import/reset replaces it. Export an independent file first. Settings can export/copy that previous saved record, which might itself need repair. The recovery copy is in the same browser and is not protection against browser-data clearing or device loss.

Ordinary edits are debounced for 250 ms and flushed on page hide/visibility loss. Failed saves show a durable warning on every page; work remains in memory for export. Further edits do not automatically retry after a failure. Free storage or allow browser storage, then use Retry saving. A best-effort beforeunload prompt protects unsaved work where browsers support it; abrupt process termination/mobile lifecycle events cannot guarantee a final save. Export before closing when the warning is present.

A saved-byte comparison rejects a detected change from another tab rather than overwriting it. Export open work before reloading to inspect the other copy. This is a guard, not transactional multi-tab synchronization; localStorage has no compare-and-swap transaction. Full sync/conflict resolution is deferred.

## Testing

```sh
npm ci
npm run typecheck
npm test                 # Existing grocery tests plus storage/recovery regressions
npm run build
npx playwright install chromium
npm run test:e2e         # Builds, then starts a private local preview and runs Chromium tests
```

Playwright is an exact-pinned development dependency. It adds no runtime browser bundle. Its result/trace directories are ignored. If a system Chromium is already installed, Linux can use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` instead of downloading a browser. In PowerShell set `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to the installed executable, then run `npm.cmd run test:e2e`; otherwise use Playwright's browser install. These Windows commands are documented equivalents, not a claim of Windows testing.

Browser tests exercise corrupt/newer/schema-invalid recovery, denied reads, quota failures, backup download/restore, confirmed reset/cancel, durable warnings, latest-edit retry, normal reload persistence and the food→recipe→planner→pantry→grocery workflow against a production build. Run all checks before review. Use disposable profiles when testing corruption or quota behavior.

Inherited audit limitations remain: vulnerable Vite/Vitest tooling is not upgraded by this persistence change, so keep development/test servers loopback-only. Comprehensive import-domain validation, accessibility remediation, real-device/browser coverage, PWA behavior and IndexedDB migration are separate milestones.
