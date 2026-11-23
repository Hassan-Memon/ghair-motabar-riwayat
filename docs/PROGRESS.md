# Progress

Where the work stands, what was learned, and exactly where to pick up. Update this file at the end of every working session, in the same PR as the work. The plan itself is [`PLAN.md`](PLAN.md).

## Status — 23 Nov 2026

| Phase | State |
|---|---|
| 0 · Foundations | **Done** (PR #1) |
| 1 · App data layer | **Code done**, needs a device check |
| 2 · Screens | **Code done**, checked on web at phone width; needs a device walkthrough |
| 3 · Mobile release | Config done (`eas.json`, OTA, scheme, privacy page); builds and store steps need accounts |
| 4 · Desktop | Shell and workflow done; updater and a Windows 10 install test remain |
| 5 · Polish and public release | Not started (announcements banner and PDF library already in) |

## What exists now

### `@tehqeqat/core` additions (78 tests in total, 18 new)
- `richtext.ts`: Word HTML → blocks of styled runs for native `<Text>` (no WebView). Fonts by `font-class-*` (Urdu / Arabic / Latin), bold, italic, underline, superscript, footnote links and anchors, Word heading paragraphs. ARBO symbol-font letters are written out exactly as the website does for copy and screen readers: honorifics as words (`l` → «رحمہ اللہ»), circled numbers as ①…㉘. `findFootnote()` finds a reference by its `_ftnN` anchor. Checked against all 910 narrations: 12,320 footnote marks, every one resolves.
- `user.ts`: bookmarks, history (200), recent searches (10), settings with defaults and validation, `content_state`.
- `sync.ts`: refresh rules — check at most every 24 h unless asked, back-off 1 h / 6 h / 24 h, retry when waiting for Wi-Fi.
- `library.ts`: display titles (honorifics spelled), lists by slugs/book/chapter/narrator, chapter, announcements, files, content info, canonical website links.

### `npm run content:pull`
Downloads `content-latest` from GitHub Releases, checks the sha256, writes `apps/app/assets/db/hadith.db` (bundled in native builds) and `apps/app/public/db/hadith.db` (web export and desktop). `--from-dir packages/content/out` uses a local build. EAS builds run it through `eas-build-post-install`.

### App (`apps/app`)
- **Data layer** (`src/db`, `src/features/content`): iOS/Android open `hadith.db` (copied from the bundled asset on first launch) and `user.db` with expo-sqlite. Refresh: manifest from GitHub (ETag), `decideUpdate`, Wi-Fi rule, `File.downloadFileAsync`, sha256 with `file.digest`, gunzip with fflate, write `hadith.next.db`, `PRAGMA quick_check` + schema + row count, then swap (previous file kept until the new one is in place) and invalidate all queries; a banner says the collection was updated. Launch check 2 s after first paint; background task every ≥ 12 h stages the file for the next launch. After an app update, a newer bundled snapshot replaces an older downloaded one (compared by `built_at`). Web/desktop use the official SQLite wasm build (it has FTS5): content loaded from `/db/hadith.db`, user DB in memory and saved to localStorage.
- **Screens**: tabs تلاش · تمام احادیث · کتب · روات · مزید; narration detail (title, book/chapter links, حکم, sections as accordions with matched ones open, footnote sheet, references, text size, narrators, related, share, bookmark, open on website); search filters sheet (book, chapter); book, chapter and narrator pages; bookmarks, history, library (PDFs), settings, about, not-found. Every list has loading skeleton, empty and error states.
- **Design**: `src/theme/tokens.ts` (website teal, light/dark), fonts converted from the website's woff2 to TTF (Mehr first, Jameel loads after first paint, Bashar for Arabic, Noto Naskh fallback), Nastaliq line-height factors, RTL forced on native (`expo-localization` plugin `forcesRTL`) and `dir=rtl` on web.
- **i18n**: `src/i18n/{ur,ar,en}.json`. Default interface language is Urdu (Arabic on an Arabic device); Settings switches.
- **Release config**: `eas.json` (development / preview APK / production with autoIncrement, channels), `expo-updates` (`runtimeVersion` = app version), scheme `tehqeqat`, bundle id `com.tehqeqatehadees.app` (**confirm with the owner before the first store upload; it cannot change later**). `docs/privacy.md` for the store listings.

### Desktop (`apps/desktop`)
Tauri 2 shell around `apps/app/dist` (the web export). Plugins: opener (links and PDFs open in the system browser through `src/lib/open-external.web.ts`) and window-state. Strict CSP (no eval; wasm allowed). `npm --workspace apps/desktop run build` exports the web app first. `.github/workflows/desktop.yml` builds NSIS/DMG/AppImage on a `desktop-v*` tag into a draft release.

### Workflows
`mobile.yml`: `mobile-v*` tag → `eas build --platform all` (needs the `EXPO_TOKEN` secret). `desktop.yml` as above. `ci.yml` unchanged (tests, typecheck, lint).

## Verified in this session
- `npm test` (78), `npm run typecheck`, `npm run lint` green.
- `expo export --platform android --platform ios` bundles (3.6 MB Hermes each, snapshot and fonts as assets).
- Web at 390 px, RTL, every screen: no console errors. Search «نماز جنازہ» / «کلمہ» / «جمعہ» with highlights; filter by volume; open narration; bookmark; footnote sheet; bookmarks and history lists; dark theme and English persist across reloads.
- Web export served with the desktop CSP at 1100 px: loads, searches, no CSP violations.
- `cargo build` of the desktop shell compiles (debug exe built; window not opened here).

## Not verified (needs hardware or accounts)
- **Nothing has run on a phone yet.** Needs a development build: `cd apps/app && npx eas-cli@latest build --profile development --platform android` (free tier), then `npx expo start`. Check: first launch offline, Nastaliq not clipped, formSheet footnotes, `@expo/ui` Slider/Switch in Settings, a content swap keeps bookmarks (publish a new `content-*` release or point `RELEASE_BASE` at a test release).
- The background task (physical device only).
- The desktop window itself (built, not opened on Windows 10 here).

## Changes from the plan
- **Desktop uses SQLite wasm in the page, not `tauri-plugin-sql`.** The official `@sqlite.org/sqlite-wasm` build includes FTS5, so the web export searches on its own; the shell needs no database code and the web export works in any browser too (PLAN 9 becomes free).
- **Honorific glyphs are spelled as words** instead of shipping the ARBO symbol fonts.
- Interface defaults to Urdu rather than the device language (most phones here are set to English).
- No zustand: settings live in the user DB behind a React context; TanStack Query for reads.

## Known issues to handle later
- **Desktop updater**: `tauri-plugin-updater` needs a signing key pair (private key as a GitHub secret). Not set up; desktop users reinstall for now. Desktop content arrives with new app versions only.
- **Web user data** is in localStorage (fine for the desktop shell; a browser clearing site data clears bookmarks).
- **Footnote sheet** on web is a full page (formSheet is native only).
- **Database size on device**: 44 MB (unchanged; see the Phase 0 note on dropping duplicated text columns).
- **"Latest" release label** and **dated content releases pruning**: unchanged from Phase 0.
- `@expo/ui` Slider on web is the browser's range input, left-to-right.

## Next
1. Development build on an Android phone; airplane-mode walkthrough of every screen (PLAN phase 2 "done when"); fix what the device shows.
2. Content swap test on the device (keep a bookmark, publish a test release).
3. Owner confirms app name, bundle id `com.tehqeqatehadees.app`, icon (still the Expo template icon — needs real artwork) and splash.
4. Google Play: everything that does not need the account is ready in [`play-store.md`](play-store.md) (listing text in Urdu and English, Data safety and content rating answers, unneeded Android permissions removed, `eas submit` to internal testing as a draft). Meanwhile share `eas build --profile preview` APKs with testers. When the friend is back: create the app in Play Console, service account key, upload, and (new personal account) 12 testers for 14 days before production.
5. Desktop: updater keys, `desktop-v1.0.0` tag, install on Windows 10, download page.

## Decisions on record

- Expo for Android, iOS and web; Tauri 2 shell around the web export for desktop.
- Content from the public API via a nightly GitHub Action; GitHub Releases as the free CDN; snapshot bundled in each app build.
- Two databases on the device: content (replaced whole) and user (never replaced).
- Zero running cost. Windows code signing skipped for now (SmartScreen warning documented).
- Repository public (owner's choice); it was created fresh so it never contained the owner's older private project history. Never merge history from other repositories into it.
- No licence chosen yet: all rights reserved.
- Desktop search runs on SQLite wasm (FTS5) inside the web export (23 Nov 2026).
