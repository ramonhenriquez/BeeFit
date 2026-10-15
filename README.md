# Larder: meal planner & grocery list generator

Choose meals → adjust servings → calculate ingredients → generate a shopping list → go shopping.

A client-side React + TypeScript app. No backend, no account. Data is saved in the browser (localStorage) and can be exported/imported as JSON.

## Run it

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the grocery/unit/import logic (Vitest)
npm run build      # type-check + build to dist/index.html (one self-contained file)
npm run preview    # serve the production build
```

`dist/index.html` has all JS and CSS inlined, so it can be opened directly from disk or dropped on any static host.

## Why this stack

**React + TypeScript** gives typed data models end to end (the grocery math is where bugs would hurt, and types catch unit/shape mistakes early) and a component model that suits the many repeated controls here. **Vite** for a fast dev server and simple build; `vite-plugin-singlefile` outputs one portable HTML file. **Plain CSS with custom properties** rather than a CSS framework: the design is small, theming (light/dark) is just a token swap, and there's no build-time styling dependency. **Vitest** because it shares Vite's config and runs TS directly. **lucide-react** for icons. That's the entire dependency list.

## Project structure

```
src/
  types.ts              Data models (Food, Recipe, MealSelection, WeekPlan, GroceryItem, PantryItem, AppData)
  data/seed.ts          Built-in foods (~85) and recipes (11)
  lib/
    units.ts            Unit dimensions, conversion, display-unit choice, shopping rounding
    grocery.ts          Pure list-generation pipeline (the core feature)
    grocery.test.ts     24 tests covering the spec example, scaling, units, pantry, merging, import
    storage.ts          StorageAdapter interface, localStorage adapter, defaults, import validation
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
- Persistence goes through `StorageAdapter` (`storage.ts`). To add cloud sync, implement `load/save/clear` against an API and pass it to `<StoreProvider adapter={...}>`.
- Import runs through `parseAppData`, which validates every field and gives readable errors. Bump `DATA_VERSION` and add a migration there when the schema changes.
- Deleting a recipe removes it from plans; a food used by a recipe can't be deleted until it's removed from those recipes.

## Extending

- **Nutrition / costs**: add optional `nutrition` or `price` to `Food` (commented placeholders are in `types.ts`), then compute totals from `aggregateIngredients` output, which already has per-food quantities.
- **Favourites / tags**: add fields to `Recipe`, filter in `RecipesPage`.
- **Sharing**: `groceryListToText()` already produces a plain-text list.
- **AI suggestions, barcode scanning, recipe import**: add as new pages or modals that produce `Recipe` or `GroceryItem` objects and call `update()`.

## Testing

`npm test` runs the logic suite. The UI was smoke-tested end to end (plan meals → pantry → generate → add manual item → tick → regenerate → reload) at desktop and mobile widths.
