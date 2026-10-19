# PR #1: reject damaged data without silent losses

This correction stays on `feat/recovery-safe-persistence`. It does not change the data version, storage keys, persistence API, calculations, navigation or UI. IndexedDB/Dexie and migrations remain deferred. PR #2 is not changed or merged by this correction.

## Root cause and fix

The previous parser returned null for malformed meal selections, filtered them out, generated missing IDs, clamped servings and replaced missing/wrong collections with empty/default values. The persistence session treated that parse as a successful load; an unrelated theme edit could then overwrite the original saved data with missing records.

`src/lib/storage.ts` now requires valid quick and weekly selection records, including nonblank IDs/references and finite positive numeric servings. Both arrays must actually be arrays. Every weekday and meal slot must be present with the correct shape; unsupported weekday/slot keys fail validation instead of disappearing. The same no-repair rule applies to the existing v1 food, recipe, grocery, pantry and settings fields, including optional values when supplied. Unsupported fields fail rather than being silently discarded. Valid values, including positive fractional servings, explicit false flags, zero pantry amounts and optional text, are retained unchanged.

Parsing throws `ImportError` on malformed data. The existing persistence session then enters recovery, retains the exact raw saved string and blocks ordinary updates/saves. Initial reads, retry, lifecycle flush and reload do not rewrite it. Original-text export and explicitly confirmed backup restore/reset remain available. A malformed imported backup is rejected before confirmation/replacement. There is no automatic data repair or migration; users retain their original data for deliberate recovery. Complete backups produced by the original v1 app continue to work. Previously tolerated partial/malformed backups now stop at recovery, which is intentional.

This is schema/field validation, not complete relational validation: duplicate IDs, missing cross-entity references, transactionally synchronized tabs and future schema migrations remain separate work. Do not claim those problems are solved here.

## Regression coverage

- `src/lib/storage.test.ts`: malformed quick/weekly records (including valid and damaged records in one list), wrong/missing collection types, invalid/missing week objects/days/slots/settings, unsupported fields, and other previously defaulted/filtered values. Each damaged-load case verifies recovery, exact original bytes, no storage writes and rejection of an attempted unrelated theme update—even after retrying the load.
- Positive unit fixtures round-trip populated valid v1 data and confirm that an unrelated valid save retains every meal and other field. Error messages identify the damaged selection path. Nonfinite direct numeric inputs are rejected.
- `e2e/persistence.spec.ts`: browser recovery for malformed selections/collections, no editable placeholder defaults, raw export, reload/retry/lifecycle preservation, rejection of damaged imports without replacing a valid open plan, and valid populated backup restore followed by unrelated edits.
- `e2e/original-features.spec.ts`: original food/recipe editing and deletion, search/filtering, recipe duplication and plan cleanup, quick generation, grocery editing/clearing, file backup/restore, weekly repeat/replace/servings/remove/clear, pantry units/stock/zero/removal and food-in-use deletion protection.
- All existing grocery/calculation and persistence regression tests are retained unchanged.

## Release gates

PR #1 was merged into main at `0bb6d6f0758dd3f342a32ba7edcdbe13492393e4`. The deployment branch now incorporates that main revision, with conflicts resolved while preserving persistence and Pages configuration. Integrated validation is recorded in [BETA_READINESS.md](BETA_READINESS.md) and PR #2. PR #2 still requires review and an explicit merge decision; no merge or deployment is performed by this integration.

Pages eligibility/settings for the private repository and actual publication remain unverified. These tests use Linux and Chromium with synthetic data and injected storage failures; Windows, other browser engines, real mobile devices and actual quota exhaustion are not certified. Existing tooling-security and UI-accessibility limitations remain separate from this focused fix. No live deployment was requested or performed.

## Verification on 2026-10-19

Linux, Node 24.19.0, Chromium 154.0.8037.57:

- Frozen `npm ci` succeeded with unchanged dependency declarations/lockfile.
- `npm run typecheck` passed.
- `npm test`: all 147 tests passed (24 original grocery, 21 existing persistence, 102 new validation regressions); none failed or skipped.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`: production build passed and all 29 Chromium tests passed, none failed or skipped. This retains the previous 12 tests and adds 14 damaged-data/compatibility cases plus 3 broad original-feature regressions.
- `git diff --check` passed.

These are local execution results, not independent approval or a live Pages deployment. Deployment-path integration was deferred in PR #1 and is now covered by the integrated PR #2 validation.
