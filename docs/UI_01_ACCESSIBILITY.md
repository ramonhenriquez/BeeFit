# BeeFit Beta v0.2 accessibility integration

This change follows merged branding PR #3 and targets `main` at
`684665db124a830f8bd4067eea5c38a6b5798767`. PRs #1 (recovery-safe persistence),
#2 (Pages preparation), and #3 (branding/themes) were already merged when inspected.

## Findings and changes

- **B10:** danger-button text used white by default, with a separate override only
  for explicit dark mode. Following a dark device therefore rendered white on pink
  at **2.41:1**. A shared `--on-beet` token now follows the same explicit/system
  mode rules as the danger background. Text contrast is **6.72:1 light** and
  **7.90:1 dark**, including confirmation dialogs and the recovery screen.
- **B20:** text/search/number inputs, selects and textareas used the decorative
  `--line` token for boundaries. Dedicated normal and hover control-border tokens
  now exceed **3:1** against the control fill and surrounding app surfaces. Error
  and focus colors are also checked. Decorative dividers retain their original
  colors. Custom pantry switches use a visible track and contrasting thumb in
  both checked and unchecked states.
- **Clean Cut dark mode:** its light preset declarations overrode dark-mode
  accent tokens, leaving selected navigation at **1.05:1**. Explicit and system
  dark overrides restore its existing green dark palette and raise selected
  navigation text to **10.64:1**. The other three preset palettes are retained.

## Automated coverage

- 25 new unit tests read actual CSS declarations for all four presets in light
  and dark mode. They check danger/primary button text (including primary hover),
  body/muted/error/navigation text, field boundaries and focus colors, plus known
  WCAG contrast reference values. Vitest CSS processing is enabled so raw CSS
  imports contain the source under test.
- 24 browser cases cover **4 presets × 3 display preferences × 2 device schemes**.
  This includes explicit light on a dark device, explicit dark on a light device,
  and system mode without a `data-theme` attribute. Checks use computed styles on
  real controls: danger and primary text, hover states, confirmation dialogs,
  search/text/number/select/textarea boundaries, validation errors, focus outlines,
  pantry tracks/thumbs, accessible names, theme selection and reload persistence.
- One browser case changes every preset and display preference through Settings,
  verifies reload persistence and live device-scheme changes, and checks that meal
  data changes only in the existing `settings.theme` field.
- Eight browser cases cover recovery-screen contrast in every preset and device
  scheme, and exact preservation of damaged saved bytes and the previous copy
  after cancelling reset.
- Existing grocery, validation, persistence and feature regression tests are kept.
  They cover recipe/food CRUD, planning, grocery/pantry edits, valid backup restore,
  malformed imports, saved-copy protection and recovery/save failures.
- CI now installs Chromium and runs the complete browser suite before building
  and verifying the Pages artifact. Publication remains manual-only from `main`.

These are targeted WCAG AA contrast and regression checks, not a complete
accessibility audit. They do not replace screen-reader, keyboard-navigation,
mobile-device or other-browser review. Browser color assertions use reduced-motion
mode to measure settled colors rather than intermediate animation frames.

## Compatibility and release boundaries

The application remains React/TypeScript with hash navigation, a shared React
store and the existing recovery-safe local-storage persistence session. Runtime
changes are limited to CSS. The BeeFit name, muscular bee SVG, theme cards, meal
schema/version, backup serialization and recovery implementation are unchanged.
Keys remain `larder:data:v1`, `larder:recovery:v1` and the separate optional
`beefit:appearance:v1`; no migration is introduced. Matrix tests also assert that
inspection and cancelled edits leave stored meal JSON and backup bytes unchanged.

No Firebase Authentication, profiles, friends, sharing, automatic merge or
deployment is included.

## Validation

Validated on 2026-10-22:

- TypeScript: passed.
- Unit tests: **172 passed** (147 existing + 25 accessibility tests).
- Chromium: **62 passed** (29 existing + 33 accessibility/regression cases),
  with no failures or skips in the final full run.
- Portable production build: passed.
- Pages production build and artifact verification: passed; `/BeeFit/` paths and
  all three expected site files verified.
- `git diff --check`: passed.

GitHub-hosted CI results are separate from these local checks. Run locally with:

```sh
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build:pages
```

In the development execution environment, browser tests use the installed
Chromium through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`.
