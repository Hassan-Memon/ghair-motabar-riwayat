/**
 * SQLite schemas. Two files on the device:
 *  - content DB: built by @tehqeqat/content, shipped in the app and replaced whole when a
 *    newer snapshot is installed. Read-only in the app.
 *  - user DB: bookmarks, history, settings. Never replaced, so a content swap cannot lose them.
 *
 * Bump CONTENT_SCHEMA_VERSION whenever a column the app reads changes. The app refuses a
 * snapshot whose version is newer than the one it was built with.
 */

export const CONTENT_SCHEMA_VERSION = 1;

export const CONTENT_SCHEMA = `
CREATE TABLE hadith (
  rowid INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  book TEXT NOT NULL,
  chapter TEXT,
  type TEXT,
  title_html TEXT NOT NULL,
  title_text TEXT NOT NULL,
  hukm_html TEXT,
  hukm_text TEXT,
  sections_json TEXT NOT NULL,      -- [{"heading": html, "content": html}]
  references_html TEXT,
  narrators_json TEXT NOT NULL,     -- [{"slug","name","arabic_name","start","end"}]
  related_json TEXT NOT NULL,       -- ["slug", ...] in the website's order
  authored_at TEXT,
  updated_at TEXT NOT NULL,
  body_chars INTEGER NOT NULL
);
CREATE INDEX hadith_book ON hadith(book);
CREATE INDEX hadith_chapter ON hadith(chapter);

-- Contentless FTS: only the index is stored. Rows are inserted with rowid = hadith.rowid.
-- The snapshot is rebuilt whole, so rows are never deleted on a device.
CREATE VIRTUAL TABLE hadith_fts USING fts5(
  title, body, hukm, book, chapter,
  content='', tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  aliases_json TEXT NOT NULL,
  is_series INTEGER NOT NULL,
  volume_no INTEGER,
  published_at TEXT,
  sort_order INTEGER,
  description TEXT,
  pdf_url TEXT,
  count INTEGER NOT NULL
);

CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent TEXT,
  sort_order INTEGER,
  description TEXT,
  count INTEGER NOT NULL
);

CREATE TABLE narrators (
  rowid INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  arabic_name TEXT,
  aliases_json TEXT NOT NULL,
  death_note TEXT,
  death_year INTEGER,
  century INTEGER,
  study_count INTEGER NOT NULL,
  hadith_count INTEGER NOT NULL,
  excerpt TEXT,
  book TEXT,
  study_json TEXT,                  -- the latest study: {hadith_slug, sections, references_html}
  other_studies_json TEXT NOT NULL, -- [{hadith_slug, book, title_text}]
  related_json TEXT NOT NULL        -- ["slug", ...]
);

CREATE VIRTUAL TABLE narrator_fts USING fts5(
  name, arabic_name, aliases,
  content='', tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE hadith_narrators (
  hadith_id TEXT NOT NULL,
  narrator_slug TEXT NOT NULL,
  PRIMARY KEY (hadith_id, narrator_slug)
);
CREATE INDEX hadith_narrators_narrator ON hadith_narrators(narrator_slug);

CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT
);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT,
  created_at TEXT
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export const USER_SCHEMA_VERSION = 1;

export const USER_SCHEMA = `
CREATE TABLE IF NOT EXISTS bookmarks (hadith_slug TEXT PRIMARY KEY, added_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS history (
  hadith_slug TEXT PRIMARY KEY, opened_at TEXT NOT NULL, scroll REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS history_opened ON history(opened_at);
CREATE TABLE IF NOT EXISTS recent_searches (query TEXT PRIMARY KEY, searched_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS content_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

/** Keys stored in the content DB's `meta` table. */
export const META_KEYS = {
  schemaVersion: 'schema_version',
  builtAt: 'built_at',
  sourceLatestUpdatedAt: 'source_latest_updated_at',
  counts: 'counts',
} as const;
