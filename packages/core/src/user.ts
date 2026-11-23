import type { DbAdapter } from './db';
import { USER_SCHEMA } from './schema';

/**
 * The user DB: bookmarks, reading history, recent searches, settings and the content-refresh
 * state. It lives in its own file and is never replaced, so installing a new content snapshot
 * can never lose a bookmark. Rows refer to narrations by slug, which is stable across snapshots.
 */

export async function initUserDb(db: DbAdapter): Promise<void> {
  await db.exec(USER_SCHEMA);
}

const nowIso = () => new Date().toISOString();

// ── bookmarks ────────────────────────────────────────────────────────────────

export async function isBookmarked(db: DbAdapter, slug: string): Promise<boolean> {
  return !!(await db.get('SELECT 1 AS x FROM bookmarks WHERE hadith_slug = ?', [slug]));
}

/** Adds or removes a bookmark; returns the new state. */
export async function toggleBookmark(db: DbAdapter, slug: string, at = nowIso()): Promise<boolean> {
  const { changes } = await db.run('DELETE FROM bookmarks WHERE hadith_slug = ?', [slug]);
  if (changes > 0) return false;
  await db.run('INSERT INTO bookmarks (hadith_slug, added_at) VALUES (?, ?)', [slug, at]);
  return true;
}

export interface UserEntry {
  slug: string;
  at: string;
}

export async function listBookmarks(db: DbAdapter): Promise<UserEntry[]> {
  return db.all<UserEntry>('SELECT hadith_slug AS slug, added_at AS at FROM bookmarks ORDER BY added_at DESC');
}

// ── history ──────────────────────────────────────────────────────────────────

export const HISTORY_LIMIT = 200;

export async function recordOpened(db: DbAdapter, slug: string, at = nowIso()): Promise<void> {
  await db.run(
    `INSERT INTO history (hadith_slug, opened_at) VALUES (?, ?)
     ON CONFLICT(hadith_slug) DO UPDATE SET opened_at = excluded.opened_at`,
    [slug, at],
  );
  await db.run(
    `DELETE FROM history WHERE hadith_slug NOT IN
       (SELECT hadith_slug FROM history ORDER BY opened_at DESC LIMIT ?)`,
    [HISTORY_LIMIT],
  );
}

export async function listHistory(db: DbAdapter, limit = HISTORY_LIMIT): Promise<UserEntry[]> {
  return db.all<UserEntry>(
    'SELECT hadith_slug AS slug, opened_at AS at FROM history ORDER BY opened_at DESC LIMIT ?',
    [limit],
  );
}

export async function clearHistory(db: DbAdapter): Promise<void> {
  await db.run('DELETE FROM history');
}

// ── recent searches ──────────────────────────────────────────────────────────

export const RECENT_SEARCH_LIMIT = 10;

export async function addRecentSearch(db: DbAdapter, query: string, at = nowIso()): Promise<void> {
  const q = query.trim().replace(/\s+/g, ' ');
  if (!q) return;
  await db.run(
    `INSERT INTO recent_searches (query, searched_at) VALUES (?, ?)
     ON CONFLICT(query) DO UPDATE SET searched_at = excluded.searched_at`,
    [q, at],
  );
  await db.run(
    `DELETE FROM recent_searches WHERE query NOT IN
       (SELECT query FROM recent_searches ORDER BY searched_at DESC LIMIT ?)`,
    [RECENT_SEARCH_LIMIT],
  );
}

export async function listRecentSearches(db: DbAdapter): Promise<string[]> {
  const rows = await db.all<{ query: string }>('SELECT query FROM recent_searches ORDER BY searched_at DESC');
  return rows.map((r) => r.query);
}

export async function clearRecentSearches(db: DbAdapter): Promise<void> {
  await db.run('DELETE FROM recent_searches');
}

// ── settings ─────────────────────────────────────────────────────────────────

export type Language = 'ur' | 'ar' | 'en';
export type ThemePref = 'system' | 'light' | 'dark';
export type UrduFont = 'mehr' | 'jameel';

export interface Settings {
  language: Language | null; // null: follow the device
  theme: ThemePref;
  urduFont: UrduFont;
  /** Reading text scale, 0.8–1.6. */
  textScale: number;
  /** Download content updates over mobile data too. */
  allowCellular: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  language: null,
  theme: 'system',
  urduFont: 'jameel',
  textScale: 1,
  allowCellular: false,
};

export const TEXT_SCALE_MIN = 0.8;
export const TEXT_SCALE_MAX = 1.6;

/** Parse stored values, ignoring anything unknown or malformed. */
export function parseSettings(rows: readonly { key: string; value: string }[]): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    switch (key) {
      case 'language':
        if (value === 'ur' || value === 'ar' || value === 'en') s.language = value;
        break;
      case 'theme':
        if (value === 'system' || value === 'light' || value === 'dark') s.theme = value;
        break;
      case 'urduFont':
        if (value === 'mehr' || value === 'jameel') s.urduFont = value;
        break;
      case 'textScale': {
        const n = Number(value);
        if (Number.isFinite(n)) s.textScale = Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, n));
        break;
      }
      case 'allowCellular':
        s.allowCellular = value === '1';
        break;
    }
  }
  return s;
}

export async function getSettings(db: DbAdapter): Promise<Settings> {
  return parseSettings(await db.all<{ key: string; value: string }>('SELECT key, value FROM settings'));
}

export async function setSetting<K extends keyof Settings>(db: DbAdapter, key: K, value: Settings[K]): Promise<void> {
  if (value === null) {
    await db.run('DELETE FROM settings WHERE key = ?', [key]);
    return;
  }
  const stored = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  await db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, stored],
  );
}

// ── content refresh state ────────────────────────────────────────────────────

export async function getState(db: DbAdapter): Promise<Record<string, string>> {
  const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM content_state');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setState(db: DbAdapter, values: Record<string, string | null>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    if (value === null) await db.run('DELETE FROM content_state WHERE key = ?', [key]);
    else {
      await db.run(
        'INSERT INTO content_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value],
      );
    }
  }
}
