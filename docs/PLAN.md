# Tehqeeqat-e-Hadees offline apps — plan and system design

Written 17 Nov 2026. Android, iOS and desktop (Windows, macOS, Linux) readers of
[tehqeqatehadees.com](https://tehqeqatehadees.com), with the whole collection searchable
offline. One Expo codebase. Zero running cost. The website and its backend do not change.

Read this before building anything. Each phase ends with a check that proves it worked.

---

## 1. Decision in one paragraph

Build a **read-only, offline-first** app with **Expo SDK 58 + Expo Router** that runs on
Android, iOS and the web from one codebase. The desktop app is a **Tauri 2 shell** that loads
the app's own web export, so desktop reuses every screen. Content lives on the device in a
**SQLite database with FTS5 full-text search**. That database is **built in GitHub Actions**
from the website's public JSON API, published as a **GitHub Release** (free CDN), **bundled
into every app build** so the first launch is instant and offline, and refreshed in the
background when a newer release exists. Admin stays on the website. Devices never call the
Django server except to download a PDF the user asks for, so the 1 GB droplet gets no new load.

**Why this shape.** 910 narrations (≈6–9 MB compressed) change a few times a month; a nightly
full snapshot is simpler and more robust than deltas, and needs no backend. The earlier plan's
sync API (`/api/v1/sync/*`) is not deployed and the website owner has ruled that the site does
not change for the app, so the app must work from what is public today. If that API ever ships,
it slots in as an optimisation (section 11), not a prerequisite.

## 2. Goals and non-goals

### Goals

- Everything a visitor can read on the site is readable offline from the first launch: search,
  all narrations, chapters (ابواب), books and volume hubs, narration detail with sections and
  references, narrators (روات) with their studies, the تعارف page, announcements.
- Search quality matches the website: the same Urdu/Arabic normalisation on both sides
  (ی/ي, ک/ك, ہ/ه/ۃ, آ/ا, hamza forms, diacritics, all digit forms), phrase > all-words >
  any-word ranking, highlighting in results and inside the detail page.
- Urdu typography is right: Jameel Noori Nastaleeq and Mehr Nastaliq bundled, Arabic in a naskh
  face, the site's `font-class-*` mapping honoured, Nastaliq line heights never clipped.
- Content stays current without the user doing anything: a background check at most once a day,
  a check on launch after 24 h, and pull-to-refresh.
- Native feel: platform tabs, native sheets and pickers (`@expo/ui`), dark mode, text size,
  RTL throughout, three interface languages (ur / ar / en).
- Works on a 2 GB-RAM Android phone and on Windows 10.
- Share a narration as its canonical website link.

### Non-goals (first release)

- No editing, no login, no accounts, no cloud bookmarks (bookmarks and history are on-device).
- No change to stored book text, names or digits. The app shows what the site stores.
- No analytics. Crash reporting only if the owner wants it, opt-in.
- No PWA on the website itself (owner's choice). The web export exists for the desktop shell and
  for local testing; publishing it as a website is optional (section 9).

## 3. Architecture

```
                       tehqeqatehadees.com  (unchanged)
                       public JSON: /api/all-hadees/<n>, /api/hadees-detail/<slug>,
                       /api/books, /api/chapters, /api/narrators[/<slug>],
                       /api/announcements, /api/files
                                   │  nightly, conditional (only changed slugs re-fetched)
                                   ▼
   GitHub Actions ─── packages/content: build-snapshot ─▶ hadith-v<schema>.sqlite.gz
                                                          + manifest.json
                                   │  gh release upload (tag content-YYYY-MM-DD)
                                   ▼
                       GitHub Releases  (free, cached, HTTPS)
                        │                          │
     at build time      │                          │  at run time (manifest check ≤ 1/day)
                        ▼                          ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  apps/app  —  Expo SDK 58, Expo Router, TypeScript           │
   │  bundled snapshot (assets/db/hadith.db) → expo-sqlite (FTS5) │
   │  packages/core: normalize · schema · search · richtext ·     │
   │                 snapshot installer · DbAdapter interface     │
   └───────────┬───────────────────────┬─────────────────────────┘
               │ iOS / Android          │ web export (expo export --platform web)
               ▼                        ▼
        EAS Build → stores       apps/desktop — Tauri 2 shell
        EAS Update (OTA JS)      SQLite via tauri-plugin-sql (FTS5)
                                 updater feed on GitHub Releases
```

Rules that keep this honest:

- **Everything the app knows about data goes through `@tehqeqat/core`.** Screens never write SQL
  or parse HTML. Core is pure TypeScript with no React Native imports and is tested in Node.
- **One `DbAdapter` interface, three implementations**: `expo-sqlite` (iOS/Android),
  `tauri-plugin-sql` (desktop), `node:sqlite` (tests and the snapshot builder).
- **The snapshot is the contract.** `schema_version` in the manifest; the app refuses a snapshot
  newer than it understands and shows "update the app"; it migrates older ones.
- **Devices never crawl the website.** Only the GitHub manifest and release asset, plus PDFs on
  explicit request.

## 4. Repository layout (npm workspaces)

```
hadith-search-offline-app/
├── apps/
│   ├── app/                 Expo universal app (moved from the repo root in phase 0)
│   │   ├── app.json  eas.json  metro.config.js
│   │   ├── assets/db/hadith.db        ← copied in by `npm run content:pull` before a build
│   │   ├── assets/fonts/              Jameel Noori Nastaleeq, Mehr Nastaliq, naskh face
│   │   └── src/
│   │       ├── app/                   routes only (Expo Router)
│   │       │   ├── _layout.tsx        root: fonts, SQLiteProvider, theme, query client
│   │       │   ├── (tabs)/            search · all · books · narrators · more
│   │       │   ├── hadith/[slug].tsx  books/[book].tsx  chapters/[slug].tsx
│   │       │   ├── narrators/[slug].tsx  about.tsx  bookmarks.tsx  history.tsx
│   │       │   ├── library.tsx (PDFs)  settings.tsx
│   │       │   └── +not-found.tsx
│   │       ├── components/            ui/ (tokens-driven primitives), hadith/, reader/
│   │       ├── features/              search/, reader/, sync/, library/ (hooks + stores)
│   │       ├── db/                    expoAdapter.ts, provider.tsx
│   │       ├── theme/                 tokens.ts (color, space, type, radius, motion)
│   │       └── i18n/                  setup for ur/ar/en, RTL handling
│   └── desktop/             Tauri 2 shell
│       ├── src-tauri/       Rust: tauri-plugin-sql, updater, window-state, opener
│       └── (loads ../app/dist web export; no second UI)
├── packages/
│   ├── core/                @tehqeqat/core — normalize, schema.sql, migrations, repo,
│   │                        search, richtext (Word HTML → text runs), html-clean,
│   │                        snapshot/{manifest,installer}, books (volume parser), types
│   ├── content/             @tehqeqat/content — snapshot builder (Node): crawl public API,
│   │                        clean HTML, normalise, write SQLite + FTS, gzip, manifest
│   ├── i18n/                ur.json ar.json en.json + translate()
│   └── assets/              fonts, cover, scans, logo (shared by app and desktop)
├── .github/workflows/
│   ├── ci.yml               core tests · typecheck · lint · expo export · cargo check
│   ├── content.yml          nightly snapshot → GitHub Release `content-*`
│   ├── mobile.yml           on tag mobile-v* → EAS build + submit (or hand-off artifacts)
│   └── desktop.yml          on tag desktop-v* → tauri-action, 3 OSes, signed updater feed
├── docs/PLAN.md             this file
└── AGENTS.md                keep; add the project rules from section 12
```

Why a monorepo even though the app is small: the snapshot builder, the test suite and the
desktop shell all need `core` without pulling in React Native, and Expo supports npm workspaces
(see Expo docs → Guides → Monorepos for the `metro.config.js` settings).

## 5. Content pipeline (`packages/content`)

### 5.1 Build

`npm run content:build` (also the nightly job):

1. `GET /api/all-hadees/<page>` until `total_records` are listed (≈10 pages). Each row has
   `id, slug, title, book, chapter, authored_at, updated_at`.
2. Compare with the previous snapshot's `slug → updated_at` (downloaded from the latest
   `content-*` release). Fetch `GET /api/hadees-detail/<slug>` **only for new or changed slugs**;
   drop rows whose slug disappeared. First run fetches all 910, with a 150 ms pause between
   requests. Never parallelise against this server.
3. `GET /api/books`, `/api/chapters`, `/api/narrators`, then `/api/narrators/<slug>` for each of
   the 317 narrators (same change rule using `updated_at` where present, else a content hash),
   `/api/announcements`, `/api/files`.
4. Clean the Word HTML once (`core/html-clean.ts`): keep `p, span, b, i, sup, br, a` and the
   `font-class-*`, `lang`, `dir` attributes; drop MSO classes, `o:p`, `file:///` hrefs, empty
   spans. The earlier measurement: raw 78 MB SQLite → ≈30 MB cleaned, ≈6–8 MB gzipped.
5. Write the SQLite file with `core/schema.sql` via `node:sqlite`, fill `hadith_fts` from the
   normalised text, `VACUUM`, gzip, compute sha256.
6. Write `manifest.json`:
   ```json
   { "schema_version": 1, "built_at": "2026-11-18T03:00:00Z",
     "snapshot": { "url": "...hadith-v1.sqlite.gz", "bytes": 7340032, "sha256": "...",
                   "uncompressed_bytes": 31457280 },
     "counts": { "hadith": 910, "books": 18, "chapters": 41, "narrators": 317 },
     "source_latest_updated_at": "2026-10-30T14:40:15Z", "min_app_version": "1.0.0" }
   ```
7. If nothing changed (same counts, same `source_latest_updated_at`, same content hash), do
   **not** create a release. Otherwise `gh release create content-YYYY-MM-DD` with both files
   and update the `content-latest` tag. The app reads
   `https://github.com/<owner>/<repo>/releases/download/content-latest/manifest.json`.

### 5.2 Schema (SQLite, schema_version 1)

```sql
hadith(id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, book TEXT, chapter TEXT,
       title_html TEXT, title_text TEXT, hukm_html TEXT, sections_json TEXT,
       references_html TEXT, raw_text TEXT, authored_at TEXT, updated_at TEXT);
hadith_search(id TEXT PRIMARY KEY, title TEXT, body TEXT, hukm TEXT, book TEXT, chapter TEXT);
CREATE VIRTUAL TABLE hadith_fts USING fts5(title, body, hukm, book, chapter,
       content='hadith_search', content_rowid='rowid',
       tokenize='unicode61 remove_diacritics 2');
books(id TEXT PRIMARY KEY, name TEXT UNIQUE, aliases_json TEXT, is_series INT, volume_no INT,
      published_at TEXT, sort_order INT, pdf_file_id TEXT, count INT);
chapters(id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT, parent TEXT, "order" INT,
         description TEXT, count INT);
narrators(id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT, arabic_name TEXT, aliases_json TEXT,
          death_note TEXT, death_year INT, century INT, study_count INT, hadith_count INT,
          excerpt TEXT, latest_book TEXT, study_html TEXT, study_text TEXT);
narrator_hadith(narrator_id TEXT, hadith_id TEXT, PRIMARY KEY(narrator_id, hadith_id));
announcements(id TEXT PRIMARY KEY, kind TEXT, html TEXT, active INT, created_at TEXT);
files(id TEXT PRIMARY KEY, name TEXT, url TEXT, bytes INT);
meta(key TEXT PRIMARY KEY, value TEXT);              -- schema_version, built_at, counts
-- user data lives in a SEPARATE database `user.db` so a snapshot swap never touches it:
bookmarks(hadith_id TEXT PRIMARY KEY, added_at TEXT);
history(hadith_id TEXT PRIMARY KEY, opened_at TEXT, scroll REAL);
settings(key TEXT PRIMARY KEY, value TEXT);
content_state(key TEXT PRIMARY KEY, value TEXT);     -- installed built_at, sha256, last_check
```

Two database files is the one structural lesson from the earlier design: swapping the content
file must never risk a user's bookmarks.

### 5.3 Normaliser and ranking (`core/normalize.ts`, `core/search.ts`)

NFKC → strip harakat, tatweel, zero-width → fold ك→ک, ي/ئ→ی, ؤ→و, أإآٱ→ا, ه/ة/ۃ/ۂ/ۀ→ہ →
fold Arabic-Indic and Urdu digits to ASCII → lowercase → collapse spaces. Keep the 35-case
fixture file; the test suite must pass it. `normalizeWithMap()` returns an index map so FTS
highlight offsets land on the original Nastaliq text.

Ranking: one CTE tries phrase, then all words, then any word; `bm25()` with weights
title 5, hukm 3, body 1, book 0.5; prefix match on the last token while typing; filters by book
and chapter; `snippet()` for result cards. Golden test: 50 queries exported from the live site
(`/search-hadees?q=`), top-10 slugs must match.

## 6. App design (`apps/app`)

### 6.1 Stack (SDK 58; verify each API against docs.expo.dev/versions/v58.0.0 before use)

| Need | Choice | Notes |
|---|---|---|
| Routing | Expo Router, native tabs on phone, Stack elsewhere | `expo-router` skill |
| Local DB | `expo-sqlite` | FTS5 is on by default (`enableFTS`), open the bundled file with `SQLiteProvider assetSource`, then swap to the downloaded file in the SQLite directory |
| Files/downloads | `expo-file-system` `File`/`Directory`/`Paths`, `File.downloadFileAsync` | not the legacy API |
| Background refresh | `expo-background-task` + `expo-task-manager`, `minimumInterval` 12 h | Android ≥ 15 min, iOS decides; physical device only to test |
| Network | `expo-network` | snapshot download only on Wi-Fi unless the user allows data |
| Native controls | `@expo/ui` (BottomSheet, Picker, Switch, Menu, FieldGroup) | settings, filters, font picker |
| Lists | `FlatList` / FlashList for 910-row lists | `@expo/ui List` is not virtualised |
| Fonts | `expo-font` | Jameel 10 MB TTF: load after first paint, show Mehr first (the site does the same) |
| Images | `expo-image` | cover, scans |
| State | zustand for settings/sync; TanStack Query over local DB reads | gives every screen the four states |
| i18n | `expo-localization` + `@tehqeqat/i18n` | RTL via `I18nManager`; the app is RTL-first |
| Share/links | `expo-sharing`, `expo-linking` | canonical `https://tehqeqatehadees.com/hadees-detail/<slug>` |
| Gunzip | `pako` (or `fflate`) | 7 MB → 30 MB in memory is fine; stream later if volumes grow |
| OTA | `expo-updates` via EAS Update | JS fixes without store review |

Dev loop: **development build**, not Expo Go (SQLite with a bundled asset, background task and
custom fonts need it). `npx expo run:android` locally if an Android SDK is installed, otherwise
`eas build --profile development`.

### 6.2 Screens

Tabs: **تلاش** (search, also home) · **تمام احادیث** (list + chapters switch) · **کتب** ·
**روات** · **مزید** (about, bookmarks, history, library, settings).

- **Search**: big RTL input, recent queries, example chips (same as the site's), results as
  the site's card (title with highlights, book badge, chapter). Filters sheet: book, chapter.
- **Detail**: title, book/chapter breadcrumb, حکم open on arrival (as the site), sections as
  accordions with the matched ones open, حوالہ جات closed until tapped, footnote marks jump,
  related by chapter, narrators mentioned, share, bookmark, text size, font switch, "open on
  website", "download these pages (PDF)" when the book has mapped pages.
- **All / Chapters**: two views with a switch; chapter groups with counts; one sample per chapter.
- **Books**: volumes 1–13 as numbered cards, other books after; book → its list.
- **Narrators**: letter strip, 317 cards, narrator → study rendered with RichText.
- **About**: cover, scans in a zoomable viewer, مقدمہ from the DB with contents.
- **Settings**: language, font (Jameel/Mehr), text size, theme, content refresh (Wi-Fi only,
  check now, built-at date, counts), about this app, open-source licences.
- **First launch**: no download screen at all — the bundled DB is ready. A quiet banner appears
  if a newer snapshot was installed in the background.

### 6.3 Design system

One `theme/tokens.ts`: colour (teal primary from the site, semantic surfaces for light/dark),
spacing scale (4/8/12/16/24/32 with a row < card < section rhythm), type scale with Nastaliq
line-height multipliers (≈1.9 for Jameel, 1.7 for Mehr), radius, shadow (one level), motion.
No hex outside tokens. Run the `expo-design-system` audit before each release. Avoid the
"native slop" tells: no outlines around cards on white, no stacked shadows, no emoji icons,
no spinner for content that can show a skeleton.

### 6.4 Content refresh state machine (`features/sync`)

```
launch ──► if last_check > 24h or pull-to-refresh or background task:
  GET manifest (ETag / If-None-Match; 304 → done)
  if manifest.schema_version > app's → show "update the app" once; done
  if manifest.snapshot.sha256 == installed → done
  if min_app_version > app version → done (never break an old install)
  if cellular and !allowCellular → remember, retry on Wi-Fi
  download to Paths.cache/hadith.sqlite.gz (resumable DownloadTask)
  verify sha256 → gunzip → write hadith.db.tmp → PRAGMA quick_check
  close content DB → rename → reopen → invalidate queries → toast "updated to <date>"
on any failure: keep the current DB, record error, back off (1 h, 6 h, 24 h)
```

## 7. Desktop (`apps/desktop`)

- **Tauri 2** shell loading the Expo web export (`npx expo export --platform web` → `dist/`).
  One window, remembered size, native menu, `/` focuses search, `Ctrl+K` palette, `Ctrl+B`
  bookmark, print a narration.
- **Database** (changed 23 Nov 2026): the official SQLite wasm build (`@sqlite.org/sqlite-wasm`)
  includes FTS5, so the web export itself searches (`db/databases.web.ts`) and the shell needs no
  database plugin. User data is saved to the WebView's localStorage. The original idea was
  `tauri-plugin-sql` with a `tauriAdapter.ts`; keep it in mind only if wasm proves too slow.
- **Why not expo-sqlite on web**: the SDK 58 web build ships without FTS and needs a custom
  wasm plus COOP/COEP headers. Possible, fragile; keep as a later option for a PWA.
- **Updates**: `tauri-plugin-updater` with the feed in GitHub Releases (`desktop-v*`).
  Signing key as a GitHub secret. Windows without a code-signing certificate shows a SmartScreen
  warning on first run (documented on the download page; a certificate costs money, so skipped).
  macOS notarisation uses the friend's Apple developer account at no extra cost.
- **Builds**: `tauri-apps/tauri-action` on Windows, macOS and Ubuntu runners — free for a
  public repository.

## 8. Delivery, zero-cost table

| Item | Cost | How |
|---|---|---|
| Content build and hosting | $0 | GitHub Actions nightly + GitHub Releases |
| Mobile builds | $0 | EAS Build free tier (monthly quota); if exhausted, `npx expo run:android` locally / `eas build --local` |
| OTA updates | $0 | EAS Update free tier |
| Desktop builds | $0 | GitHub Actions, public repo |
| Store accounts | $0 to you | friend's Google Play and Apple accounts; add you as a user with release rights, or hand over `.aab` / `.ipa` |
| Code signing Windows | $0 | skipped; SmartScreen warning documented |
| Crash reporting | $0 | optional, Sentry free tier, opt-in |
| Backend changes | $0 | none |

EAS: project is already linked (`extra.eas.projectId` in `app.json`). `eas.json` profiles:
`development` (dev client, internal), `preview` (APK + internal iOS), `production` (AAB + store
IPA, `autoIncrement`). Channels mirror profiles for EAS Update.

Store submission: `eas submit` needs credentials from the friend's accounts (a Google service
account JSON; an App Store Connect API key). Keep them only in EAS secrets, never in the repo.
If the friend prefers to upload by hand, `mobile.yml` attaches the artifacts to a GitHub Release
instead.

## 9. Optional: publish the web export

`expo export --platform web` can be hosted on GitHub Pages or EAS Hosting (free tier) as a
browsable version. It would need the expo-sqlite wasm FTS build (section 7) or a fallback to
in-memory search, so it is phase 6, only if wanted.

## 10. Phases, with proof at the end of each

Effort is for one developer using Claude Code; a week here means working evenings.

### Phase 0 — foundations (3–4 days)

1. Move the Expo template into `apps/app`; root `package.json` with `workspaces`; `metro.config.js`
   for the monorepo. `npx expo start` still runs.
2. `packages/core`: types, `normalize.ts` + fixture, `schema.sql`, `db/adapter.ts`, `repo.ts`,
   `search.ts`, `richtext.ts`, `html-clean.ts`, `snapshot/manifest.ts`. Vitest with `node:sqlite`.
   (The earlier branch `feat/offline-apps` in the Techwards repo has working versions of most
   of these; reuse only with Techwards' permission since that repository is theirs, otherwise
   reimplement — it is about 1,500 lines.)
3. `packages/content`: the builder from section 5.1 running locally against the live API.
4. `content.yml` nightly; first `content-*` release published by hand.

**Done when** `npm test` is green, the builder produces a snapshot under 8 MB gz with 910 rows,
and a Node script searching «نماز جنازہ» in it returns the same top-10 as the website.

### Phase 1 — app data layer (2 days)

5. `expo-sqlite` adapter; `SQLiteProvider` with the bundled `assets/db/hadith.db`; `user.db`.
6. `features/sync`: manifest check, download, verify, swap (section 6.4); background task;
   Wi-Fi rule; settings store.

**Done when** a development build on a phone searches offline on first launch, and after a new
`content-*` release the app swaps databases without losing a bookmark.

### Phase 2 — screens (5–6 days)

7. Tokens, fonts, RTL, theme, i18n.
8. Search and results; detail with RichText and highlights; all/chapters; books; narrators;
   about; bookmarks/history; library; settings; not-found.
9. Four states on every screen (loading skeleton, empty, error, content).

**Done when** an airplane-mode walkthrough of every screen passes on a low-end Android and an
iPhone, Nastaliq is not clipped anywhere, and the design-system audit reports no stray hex.

### Phase 3 — mobile release (2 days)

10. `eas.json`, app icons/splash, `expo-updates`, deep-link scheme `tehqeqat://`, share links.
11. Preview builds to the owner (Mufti sahib's team) and the friend; fix feedback.
12. Store listings (Urdu + English), screenshots, privacy policy page (the app collects nothing),
    `eas submit` or artifact hand-off.

**Done when** the app is in Play internal testing and TestFlight, and OTA update of a copy change
reaches a device.

### Phase 4 — desktop (4–5 days)

13. Tauri shell, `tauri-plugin-sql` adapter, runtime adapter switch, window state, shortcuts.
14. `desktop.yml` with updater feed; installers for Windows (NSIS), macOS (DMG), Linux (AppImage).
15. Download page (GitHub Pages, one HTML file) linking stores and installers.

**Done when** release N installs on Windows 10, searches offline, and updates itself to N+1.

### Phase 5 — polish and public release (2–3 days)

16. Announcements banner, PDF library with Wi-Fi rule and resumable downloads, print.
17. `/code-review` pass, accessibility pass (VoiceOver/TalkBack labels on cards and controls).
18. Production store release; tag `mobile-v1.0.0`, `desktop-v1.0.0`.

### Owner-dependent extras (ask, do not assume)

- Universal/App Links so `https://tehqeqatehadees.com/hadees-detail/<slug>` opens the app:
  needs `/.well-known/assetlinks.json` and `apple-app-site-association` on the website.
- "Get the app" links on the website.
- Deploying the sync API from `feat/offline-apps` (section 11).

## 11. If the sync API is ever deployed

`/api/v1/sync/manifest|changes|snapshot` from the Techwards branch would let devices pull deltas
straight from the site. Keep `core/sync` behind the same `ContentSource` interface as the
GitHub manifest source; add a `DjangoSyncSource` then. Nothing in the UI changes.

## 12. Rules for every session (copy into AGENTS.md)

- Expo SDK 58: read `https://docs.expo.dev/versions/v58.0.0/...` for any Expo API before using
  it; do not trust memory. Install with `npx expo install`.
- Never change stored content: no rewording, no renaming books, no digit changes, no labels or
  grades the research does not give.
- UI code never touches SQL or HTML parsing; that lives in `@tehqeqat/core` with tests.
- Two databases: content (replaceable) and user (never replaced).
- Every visible string goes into `ur.json`, `ar.json` and `en.json`.
- Before "done" on a visible change: run it (device or `expo start --web` + browser screenshot)
  and look at it at phone width in RTL.
- `npx tsc --noEmit`, `npx expo lint`, `npm test` green before any PR. `/code-review medium`
  before merging.
- Reply to the user in English (their terminal breaks Urdu).
- The website's server is small: the content builder is the only thing that calls it, serially,
  once a night. Devices call GitHub.

## 13. Skills to load, by phase (all free)

Already installed in this Claude Code: the **Expo plugin** (`expo:*`), **Anthropic skills**
(`anthropic-skills:*`), `code-review`, `simplify`, `browser-automation`, `run`, `security-review`.
Load the right one at the start of each step; the plugin skills carry SDK-58-correct guidance
that training data does not.

| Step | Load |
|---|---|
| Any Expo work, first thing | `expo:expo-overview` (routes to the leaf skill) |
| Phase 0 layout, monorepo | `expo:expo-project-structure`; Expo docs "Monorepos" page |
| Routing, tabs, sheets, headers | `expo:expo-router` |
| Screens, HIG styling, SF Symbols, media | `expo:expo-native-ui` + `expo:expo-ui` (check `@expo/ui` first for any control) |
| Tokens, consistency, "looks AI-made" audit | `expo:expo-design-system` (run its audit before each release) |
| Loading/empty/error states, TanStack Query | `expo:expo-data-fetching` |
| Press feedback, sheet motion, haptics | `expo:expo-animation` |
| Dev client, running on a phone | `expo:expo-dev-client`; `expo:eas-simulator` only if no local emulator and the cloud simulator is within the free tier |
| eas.json, builds, TestFlight, store metadata | `expo:eas-app-stores` |
| OTA updates, channels, "old code still shows" | `expo:eas-update`; later `expo:eas-update-insights` |
| CI/CD YAML for EAS | `expo:eas-workflows` (GitHub Actions is fine too; both free) |
| Startup speed, TTI | `expo:eas-observe` (optional) |
| Upgrading SDK later | `expo:expo-upgrade` |
| Verifying the web export / desktop UI | `browser-automation` |
| Before every PR | `code-review` (`medium`), `simplify` on the diff, `security-review` before store release |
| Something in a skill was wrong | `expo:expo-skill-feedback` |

Public skill sources worth knowing (install free from GitHub; read a skill before trusting it):
`anthropics/skills` (the `anthropic-skills:*` set already here), `expo/skills` (the Expo plugin,
already here), and `obra/superpowers` (general engineering discipline: brainstorming,
test-driven development, systematic debugging, verification before "done"). Nothing else is
needed for this project; more skills mostly add noise.

How to work with the model so each step goes well: start the step by naming the skill and the
"done when" line from this plan; give it the real device or the web export to look at; ask for
the check to be run, not described; keep PRs to one phase step each.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Nastaliq clipping on Android | line-height multipliers in tokens, test on a real low-end device in Phase 2 week 1, Mehr as fallback |
| Word HTML in native `<Text>` | clean in the builder, allow-list tags, 30 real-narration snapshot tests including the longest |
| expo-sqlite bundled asset + swap edge cases | `PRAGMA quick_check` before swap, keep previous file until reopen succeeds |
| Background task never fires on iOS | the launch check (24 h) is the real path; background is a bonus |
| EAS free quota exhausted | local builds; builds only on tags |
| Techwards changes the public API shape | builder validates shapes with zod and fails loudly; last good release stays |
| Reusing code from the Techwards branch | ask first; otherwise reimplement (small) |
| Store review (iOS) | ship Android and desktop first; the app collects no data, which simplifies review |
