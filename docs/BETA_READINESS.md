# Beta readiness review — 2026-10-19

Scope: recovery-safe persistence PR #1 at c83ffd740302b35e9efb930d3910c09bac8d869b, plus a separate GitHub Pages deployment proposal. No persistence, application UI, navigation or calculation code is changed by the deployment PR. No merge or live publication is authorized automatically by this work.

## Must resolve before publishing

1. **P1: Some invalid saved records silently disappear after an unrelated edit.** `src/lib/storage.ts`'s `selection()` returns null for malformed records and `selections()` silently filters them; `parseAppData()` can also substitute empty collections/default fields. `PersistenceSession.read()` treats that parse as successful. The later save overwrites the original bytes with the normalized, incomplete result. This bypasses the recovery screen despite PR #1's protections for thrown errors.

   Executed synthetic reproduction on PR #1: start with `createDefaultData()`, add a quick meal `{id:'meal', recipeId:data.recipes[0].id, servings:'3'}` (a string, not a number), and serialize it. Construct `PersistenceSession` with that raw value: status is `saved`, while the parsed quick meal has been dropped. Change only theme to dark and save: the stored quick meal count changes from 1 to 0. No recovery error occurs.

   Required fix belongs in the persistence PR or a focused follow-up before beta: invalid records must trigger explicit recovery, not silent omission. Retain original bytes; provide useful validation errors. Add regressions for malformed quick and weekly selections, wrong collection types and other silently defaulted data, and verify that an unrelated edit cannot erase the original. Do not invent a migration or automatically coerce damaged data. Valid v1 records must continue to load.

2. **PR #1 still needs independent review, fixes and an explicit merge decision.** The GitHub review query showed it OPEN, with no submitted reviews. Do not publish the current main baseline: it still has the original corrupt-load/default-overwrite behavior. The deployment PR is based on main and intentionally does not duplicate or merge PR #1. Revalidate the combined main branch after the independently reviewed persistence fix is merged.

3. **Confirm Pages eligibility and access before releasing.** The repository is private (verified through the GitHub repository API). The integration cannot inspect Pages settings: HTTP 403, `Resource not accessible by integration`. A repository administrator must confirm the plan supports Pages for a private repository and enable Actions-based Pages. Private source does not generally imply a private website; expect a public site unless an eligible access-control feature is deliberately configured. Do not change repository visibility as a workaround without a separate decision.

## Verified recovery behavior

On PR #1, application type checking, all 45 unit tests (24 existing plus 21 persistence regressions), the production build and all 12 production Chromium tests passed again. Tested cases include thrown parse errors, newer versions, exact raw export, denied reads, write/backup quota failures, confirmed restore/reset, cancelled reset, durable save warnings, retry of latest work and the food→recipe→planner→pantry→grocery flow. Passing those tests does not cover the silent-normalization defect above. Tests used Linux and system Chromium; failure conditions were injected.

## Beta limitations that do not require a rebuild

- Data is local to a browser profile and origin, without accounts or device synchronization. Users need explicit JSON exports; browser clearing/device loss can remove it. The retained recovery copy shares that risk.
- Full transactional multi-tab synchronization, complete referential validation, IndexedDB migrations, real-device coverage and general UI accessibility remediation remain separate work. Do not describe them as implemented.
- Grocery rounding and purchased-state-on-regeneration retain existing behavior. No nutrition or clinical accuracy claims are made.
- Existing Vite/Vitest advisories concern development/test tooling; the site serves static build output and no Vite server. Keep tooling loopback-only and triage upgrades separately. The deployment workflow exposes no application secrets or write token to PR builds.
- Google Fonts requests remain external, with system fallback fonts when blocked. There is no PWA/service worker or guaranteed offline web support.

## Release gate

Resolve the data-loss finding, complete independent review of PR #1 and merge it only by an explicit reviewer/maintainer decision. Review the separate deployment PR, enable Pages, and rerun all checks on combined main. Then a maintainer may deliberately run the deployment workflow on main. Neither creating nor merging the deployment PR publishes by itself: push/PR events validate only; `workflow_dispatch` on main publishes after successful checks. Configure a required reviewer for the `github-pages` environment when the plan supports it. The workflow cannot determine whether human review findings have been resolved.

## Deployment-branch validation

The separate deployment branch is based on the unchanged original main source, so its existing unit suite has 24 tests, not PR #1's 45. A clean `npm ci`, standalone type check, all 24 tests and `npm run build:pages` passed. A negative artifact check rejected an injected synthetic `dist/backup.json`; after removal, exactly index.html plus its hashed JS/CSS assets passed verification.

A separate Chromium smoke harness served the compiled artifact at `/BeeFit/` using a plain static server with no SPA fallback. It verified custom food/recipe creation, Monday planning at three servings, 50 g pantry subtraction from 300 g required (250 g groceries), manual item/check-state preservation through regeneration and reload, pasted JSON restore, direct hash navigation across all seven pages, and light/dark theme changes. All seven pages had no document-level horizontal overflow at 1440/390/320 px in the sampled state. No uncaught page errors or failed local assets were observed. Optional Google Fonts requests were blocked; system fonts were used. The existing modal focus-escape accessibility defect remains; this is not a WCAG or real-device certification. No application source was modified in this deployment branch.

This technical re-review does not constitute the requested independent approval of PR #1. No Pages deployment was run. The workflow YAML was parsed locally and the official action version SHAs checked against upstream GitHub metadata. Consult the deployment PR checks for current GitHub-hosted validation results; a successful build check is not evidence that a live Pages deployment has run.
