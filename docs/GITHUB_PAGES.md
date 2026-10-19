# Publish the Larder web beta with GitHub Pages

This is deployment of the existing React/TypeScript app. No account, server, nutrition feature, UI redesign or new storage system is added. The deployment PR is separate from recovery PR #1, and neither PR is merged automatically.

## Before first publication

Read [BETA_READINESS.md](BETA_READINESS.md). Resolve the reproduced silent-loss validation issue, complete independent review of recovery PR #1, and have a maintainer explicitly merge the reviewed fix. The current original main baseline is not safe to release. After that, review/merge this deployment PR and validate the combined main branch. If Vite/README/package script conflicts arise when merging the two PRs, preserve both the persistence test configuration/scripts and this Pages build mode.

The repository is currently private. GitHub Pages for a private repository requires a supporting plan (such as Pro for a personal repository, or an eligible organization plan). An administrator must confirm eligibility. The API integration returned 403 for Pages settings, so existing enablement and plan eligibility are unverified. Do not make the repository public merely to bypass an eligibility error. A website published from private source is generally public unless eligible Pages access controls are explicitly enabled; never assume repository privacy protects published assets.

## Enable Pages and run the release

1. In `ramonhenriquez/BeeFit`, open **Settings → Pages → Build and deployment**. Set **Source** to **GitHub Actions**. Repository administration access is required. If the option is unavailable, resolve the plan/organization policy first.
2. Under **Settings → Actions → General**, allow the official actions used by `.github/workflows/pages.yml`. The workflow grants only its deploy job `pages: write` and `id-token: write`. Do not add a PAT, application API key or personal credentials.
3. Under **Settings → Environments**, configure `github-pages` to allow deployment from `main` only. Add a required reviewer if supported by the plan; this is useful while beta release findings remain open. The workflow also rejects deployment from other branches.
4. After both reviewed changes are on main and beta blockers are resolved, open **Actions → Validate and deploy GitHub Pages beta → Run workflow**, choose **main**, and run it. Do not run it on a feature branch. Pushes and pull requests run validation only, not publication.
5. Check the build job: locked install, type checking, unit tests, Pages production build and artifact verification must all succeed. Only `dist/` is uploaded. The deploy job waits for build success and any environment approval, then publishes via GitHub's short-lived token/OIDC flow.
6. Use the URL shown by the successful deployment/environment. Without a custom domain, the expected address is `https://ramonhenriquez.github.io/BeeFit/`. That URL is an expected target, not a claim that this beta has been deployed or tested live.

After release, verify the dashboard, foods/recipes, planning, groceries, pantry and Settings; create disposable test data, reload, and export/import a backup. Check a direct hash URL such as `/BeeFit/#/recipes` and refresh it. Confirm browser errors and failed assets are absent except any known optional font request failures. Check the original-data recovery and failed-save flows on the combined persistence version using disposable profiles, not real user data.

## Local build verification

Use Node 24.19.0 (the workflow pins this tested version) and the committed npm lockfile:

```sh
npm ci
npm run typecheck
npm test
npm run build:pages
npm run preview -- --mode pages --host 127.0.0.1 --port 4175
```

The preview serves the build at `/BeeFit/`; visit that path, not just `/`. In PowerShell use the equivalent `npm.cmd` commands. Windows was not executed in this environment.

`npm run build` still produces the original portable single-file build. `npm run build:pages` uses Vite's `pages` mode with `base: '/BeeFit/'` and ordinary hashed JS/CSS assets. This deliberately omits the single-file plugin for the Pages mode because its recommended configuration overwrites the base with `./`. Do not enable that plugin for Pages without re-verifying output paths and inlining. The artifact check rejects missing/non-Pages asset references and unexpected output such as backup JSON, `.env` files, source maps or arbitrary public-directory copies. If new legitimate static assets are needed later, extend the allowlist deliberately and review what becomes public.

Navigation remains the existing `#/dashboard`, `#/recipes`, etc. Hash routes are handled in the browser, so GitHub Pages does not need server rewrites or a copied 404.html. Do not replace these with server-style routes in this deployment change.

When recovery PR #1 is merged, also run its documented Chromium suite against the combined code. Its existing browser harness uses root-relative test URLs; a dedicated Pages-path smoke check was executed during this deployment preparation, but the root-based recovery harness is not a substitute for production project-path checks.

## Browser data and privacy

Recipes, foods, meal plans, groceries, pantry and preferences stay in localStorage in that browser profile on that device. There are no cloud accounts or automatic synchronization. Another phone, browser or profile starts separately. Clearing browser data, private browsing behavior, device loss or storage denial can remove/prevent saves. Export JSON backups from Settings and protect those files; import explicitly on another device when needed.

Data is scoped to the **origin**, not the `/BeeFit/` path. Other apps under the same `https://ramonhenriquez.github.io` origin may share access to storage; do not treat paths as privacy boundaries. Localhost data does not automatically appear on the hosted site. Changing the domain creates another storage origin: export first. A later recovery copy remains in that same browser and does not replace an independent backup.

The workflow builds source and bundled starter foods/recipes; it does not read visitors' browsers or include their runtime data. Only compiled `dist/` files are uploaded. The build receives no application secrets or personal data, checkout credentials are not retained, and deploy permissions are isolated from PR builds. Never commit personal JSON exports, private notes, credentials, `.env` files or sensitive files in `public/` or `src/`. All compiled code and Vite `VITE_*` values used by client code are public: do not add API secrets there. `.env` patterns are ignored as an additional safeguard, not a secret scanner. Review code and artifact contents before publishing; a file-extension check cannot identify every possible secret or personal string inside allowed code.

The app currently requests Google Fonts, with system font fallbacks. It has no analytics, account backend or service worker in this deployment. Do not promise private hosting or full offline/PWA behavior.

## Troubleshooting and rollback

- **Pages 403/404 or missing Source option:** check repository administration rights, private-repository plan eligibility, Actions policy, and Pages Source. Do not solve it by adding credentials to the app.
- **Blank page or asset 404:** verify the exact case-sensitive `/BeeFit/` base, successful `build:pages`, and artifact containing `index.html` plus its referenced JS/CSS files. Do not deploy the portable build or the whole checkout.
- **CI does not publish on push:** intentional. Use Run workflow on main after the release gate; PR/feature-branch runs never publish.
- **Artifact expired:** manually rerun the workflow on main to rebuild/validate/upload a fresh artifact. It has short retention.
- **Old data missing:** verify browser/profile/origin and import a previously exported backup. There is no server copy or automatic cross-device restore.
- **Regression after release:** revert the deployment/application change through a reviewed PR, then manually run the workflow on the corrected main. Do not reset or rewrite main. Static rollback does not restore browser data; export before changes and preserve any recovery copy. No schema migration is introduced here.

## Verification limits

This preparation runs local type/unit/build checks and Chromium on the project path. It does not enable Pages, change repository visibility, dispatch a live deployment or merge either PR. GitHub-hosted build validation is reported in the PR checks. Pages deployment permissions/plan eligibility, custom domains, HTTPS propagation and the live site remain unverified until an administrator enables Pages and deliberately runs the release.
