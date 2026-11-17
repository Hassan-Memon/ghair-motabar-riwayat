# Ghair Motabar Riwayat (غیر معتبر روایات)

Offline reader for Android, iOS and desktop of [tehqeqatehadees.com](https://tehqeqatehadees.com): the research of Mufti Tariq Amir Khan on unreliable narrations, from the book series «غیر معتبر روایات کا فنی جائزہ». Every narration, chapter, book and narrator is searchable with no connection, and kept current automatically.

Read-only: the content is authored on the website. This app never changes it.

## How it works

A nightly job builds one SQLite database (with full-text search) from the website's public API and publishes it. Each app build ships the latest copy, so the first launch works offline; the app then checks for a newer copy at most once a day. Design, decisions and phases: [`docs/PLAN.md`](docs/PLAN.md).

| Path | What |
|---|---|
| `apps/app` | Expo (SDK 58) app for Android, iOS and web; Expo Router |
| `packages/core` | `@tehqeqat/core`: Urdu/Arabic normaliser, database schema, search, HTML cleaning |
| `packages/content` | Builds the content snapshot from the website's API |
| `docs/PLAN.md` | Plan and system design |

## Develop

Node 22+ and npm.

```bash
npm install
npm test                # core tests
npm run typecheck
npm run lint
npm start               # Expo dev server (apps/app)
npm run content:build   # build the snapshot locally (~10 min cold, ~1 min warm)
```

Work on a branch, open a pull request to `main`; CI must pass. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`, `chore:`). Project rules for people and coding agents: [`AGENTS.md`](AGENTS.md).

## Licence

All rights reserved, until a licence is chosen. The research text belongs to its author and is shown as published on tehqeqatehadees.com.
