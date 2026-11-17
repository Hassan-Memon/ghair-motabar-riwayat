# Progress

Where the work stands, what was learned, and exactly where to pick up. Update this file at the end of every working session, in the same PR as the work. The plan itself is [`PLAN.md`](PLAN.md).

## Status — 17 Nov 2026

| Phase | State |
|---|---|
| 0 · Foundations | **Done** (PR #1) |
| 1 · App data layer | Next |
| 2 · Screens | Not started |
| 3 · Mobile release | Not started |
| 4 · Desktop | Not started |
| 5 · Polish and public release | Not started |

## Phase 0 — what exists

- **Repository**: `Hassan-Memon/ghair-motabar-riwayat`, public. `main` is protected: changes go through a pull request, the CI job `check` must pass, the branch must be up to date and conversations resolved; this applies to admins too; no force pushes or deletion. Dependabot alerts, security fixes and weekly updates (Expo SDK packages excluded), secret scanning with push protection, private vulnerability reporting.
- **Workspace** (npm): `apps/app` (Expo SDK 58, Expo Router, EAS project `1f3462b3-43cf-4f54-950c-23cf13b6385d`, owner `hassan-memons-team`), `packages/core`, `packages/content`.
- **`@tehqeqat/core`** (60 tests): normaliser with index map (`normalize`, `normalizeWithMap`, `tokenize`); schemas (`CONTENT_SCHEMA` v1, `USER_SCHEMA`); `DbAdapter` interface and a `node:sqlite` adapter (`@tehqeqat/core/node`); search (`searchHadith`, `searchNarrators`, `splitForHighlight`, `excerptAround`); reads (`getHadith`, `listHadith`, `listBooks`, `listChapters`, `listNarrators`, `getNarrator`, `getMeta`); writer for the builder; `cleanHtml`, `htmlToText`, `parseSections`; manifest helpers (`decideUpdate`, `compareVersions`).
- **`@tehqeqat/content`**: `npm run content:build` builds the snapshot from the site's public JSON (`/api/all-hadees/<n>`, `/api/hadees-detail/<slug>`, `/api/books`, `/api/chapters`, `/api/narrators[/<slug>]`, `/api/announcements`, `/api/files`). Serial, 150 ms pause, raw responses cached in `packages/content/.cache`. `npm --workspace packages/content run compare` checks offline search against the site.
- **Workflows**: `ci.yml` (tests, typecheck, lint on every PR); `content.yml` (nightly 03:00 PKT and on demand: builds, and when the content hash changed publishes `content-latest` plus a dated `content-YYYYMMDD-HHMM` release).
- **Published snapshot** (first run 17 Nov): https://github.com/Hassan-Memon/ghair-motabar-riwayat/releases/download/content-latest/manifest.json — 910 narrations, 317 narrators, 16 books, 69 chapters; 7.5 MB gzipped, 42 MB SQLite. A cold build makes 1,323 requests in about 11–13 minutes; a warm one about 110.

## What was learned

- **The sync API in the website repo is not deployed** (`/api/v1/sync/*` → 404), and the website does not change for the app. The app depends only on the public `/api/*` JSON (not `/api/v1/*`, which serves HTML).
- **Expo SDK 58** (from the versioned docs): `expo-sqlite` has FTS5 on iOS/Android by default (`enableFTS`) and opens a pre-made file with `SQLiteProvider assetSource`; its web build has no FTS without a custom wasm and COOP/COEP headers, hence Tauri + `tauri-plugin-sql` for desktop. `expo-background-task`: Android minimum 15 min, iOS decides, not on simulators or web. `expo-file-system`: `File`/`Directory`/`Paths`, `File.downloadFileAsync`; no web support. Monorepos need no Metro config since SDK 52.
- **Search quality**: on 20 queries the offline search and the site share 71% of the top 10 on average and the same first result 7 times. Where they differ the site misses spelling variants the app folds (`نورِ`, `سورۃ`/`سورۂ`); checked by hand, so the site's order is not the target.
- **SQLite `bm25()` cannot be used inside a `UNION`**: search ranks each level in its own query and merges in TypeScript.
- **`node:sqlite`** (Node 22.22, SQLite 3.51) has FTS5; it prints an experimental warning, which is harmless.
- **`expo-env.d.ts` is gitignored**, so CI could not see Expo's ambient types; `apps/app/src/types/expo.d.ts` carries the same reference.

## Known issues to handle later

- **Symbol-font honorific**: titles store `r` (and similar) where the site shows «رضی اللہ عنہ» through a symbol font. Phase 2's text rendering must map these as the website does (see the website repo, honorifics read aloud and copied as words).
- **Database size on device**: 42 MB. Dropping duplicated plain-text columns or storing sections compressed can bring it near 30 MB. Optional.
- **"Latest" release label**: GitHub marked `content-latest` as the repository's Latest release despite `--latest=false`. Fix before desktop releases, whose updater relies on the Latest release.
- **Dated content releases accumulate** (at most one per night with changes). Add pruning (keep 30) when it matters.
- **Template screens** in `apps/app/src` are still the create-expo-app demo; Phase 2 replaces them.

## Next: Phase 1 — app data layer

Branch `feat/phase-1-data` off `main`. Load `expo:expo-overview`, then `expo:expo-data-fetching`; read the SDK 58 pages for `expo-sqlite`, `expo-file-system`, `expo-background-task`, `expo-network` before writing code.

1. `npx expo install expo-sqlite expo-file-system expo-background-task expo-task-manager expo-network expo-crypto`; add `@tehqeqat/core` as a dependency of `apps/app`; `fflate` or `pako` for gunzip.
2. `npm run content:pull` (new root script): download `content-latest`, verify sha256, gunzip to `apps/app/assets/db/hadith.db` (gitignored). Metro must treat `.db` as an asset (`metro.config.js`: `assetExts.push('db')`).
3. `apps/app/src/db/expoAdapter.ts`: `DbAdapter` over `expo-sqlite`; `SQLiteProvider` for the content DB from the bundled asset; a second connection for `user.db` with `USER_SCHEMA`.
4. `apps/app/src/features/content/`: manifest check (ETag, at most once a day, plus pull-to-refresh), `decideUpdate`, download with `File.downloadFileAsync` (Wi-Fi only unless allowed), sha256, gunzip, `PRAGMA quick_check`, close, swap, reopen; back-off on errors; background task with a 12 h minimum interval.
5. Temporary debug screen: count of narrations and a search box using `searchHadith`, to prove it on a device.

**Done when** a development build on a phone searches offline on first launch, and after a new `content-*` release the app swaps databases without losing a bookmark.

Building for a phone: the PC has no Android SDK. Use `eas build --profile development --platform android` (free tier) or install Android Studio for `npx expo run:android`. iOS needs the friend's Apple account added to EAS.

## Decisions on record

- Expo for Android, iOS and web; Tauri 2 shell around the web export for desktop.
- Content from the public API via a nightly GitHub Action; GitHub Releases as the free CDN; snapshot bundled in each app build.
- Two databases on the device: content (replaced whole) and user (never replaced).
- Zero running cost. Windows code signing skipped for now (SmartScreen warning documented).
- Repository public (owner's choice); it was created fresh so it never contained the owner's older private project history. Never merge history from other repositories into it.
- No licence chosen yet: all rights reserved.
