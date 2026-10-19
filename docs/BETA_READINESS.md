# Integrated beta readiness — 2026-10-19

PR #1, including validation correction f782f81, is merged into main at `0bb6d6f0758dd3f342a32ba7edcdbe13492393e4`. PR #2 now incorporates that main commit. The original silent-data-loss finding is resolved by strict v1 validation and raw-byte-preserving recovery; it is no longer an outstanding blocker. See [the correction and regression coverage](RECOVERY_VALIDATION_FIX.md).

Integration conflicts in `.gitignore`, README, package scripts and Vite configuration were resolved by retaining both features: persistence/Chromium tests and their output exclusions, plus the explicit `/BeeFit/` build mode and environment-file exclusions. Application and persistence code is unchanged from merged main. The portable build and hash navigation are preserved.

## Remaining release gates

- Review and explicitly merge PR #2. This integration does not merge the deployment PR, enable Pages or dispatch a release.
- A repository administrator must confirm private-repository Pages plan eligibility and enable Settings → Pages → GitHub Actions. The earlier Pages-settings API request returned 403; eligibility and enablement remain unverified.
- Configure `github-pages` environment restrictions to main and required review where supported. Manually run the workflow on main only after approval; PR/push runs validate without deploying.
- Verify the actual hosted site after deliberate publication. Local/static checks and successful CI do not establish live Pages permissions, HTTPS or availability.

## Validation and limitations

The integrated validation includes locked installation, TypeScript, all 147 unit tests, all 29 Chromium end-to-end tests, portable production build, Pages production build and artifact checks, plus a static `/BeeFit/` browser smoke check. All local checks passed: 147 unit tests and 29 Chromium tests, no failures/skips. Static hosting without SPA rewrites verified the original meal-to-grocery workflow, hash navigation, reload/backup/theme behavior and malformed-data recovery with exact raw preservation under `/BeeFit/`. A synthetic backup JSON was rejected by the artifact verifier, then removed and the three-file artifact reverified. Optional Google Fonts failed with system fallback. Results are reported in PR #2. GitHub-hosted checks must also pass for the pushed revision.

Only index.html and compiled JS/CSS under dist are publishable. The artifact verifier rejects unexpected files such as backup JSON; its file boundary check is not a comprehensive secret scanner. No application secrets or runtime browser data are included by the workflow.

Data remains local to each browser profile/device and origin; paths on the same origin do not isolate storage. Export independent backups. Recovery copies do not survive browser-data clearing. Full referential validation, transactional multi-tab synchronization, IndexedDB, general UI accessibility remediation, other browser engines and real-device coverage remain follow-up work. Existing development-tool advisories remain; the published app is static and exposes no Vite server. External Google Fonts can fail with system-font fallback. There is no PWA/offline guarantee or new nutrition/account/fitness feature.
