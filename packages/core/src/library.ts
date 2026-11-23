import type { DbAdapter } from './db';
import { richTextToPlain } from './richtext';
import { META_KEYS } from './schema';

/** Reads for the browse screens that repo.ts does not cover. */

export interface DisplayListItem {
  slug: string;
  /** Title with honorifics written out, for list rows. */
  title: string;
  book: string;
  chapter: string | null;
}

/** Narrations by slug, in the order given; slugs not in this snapshot are left out. */
export async function listHadithBySlugs(db: DbAdapter, slugs: readonly string[]): Promise<DisplayListItem[]> {
  if (slugs.length === 0) return [];
  const out: DisplayListItem[] = [];
  // SQLite's default variable limit is 999 on older builds; stay well under it.
  for (let i = 0; i < slugs.length; i += 400) {
    const chunk = slugs.slice(i, i + 400);
    const rows = await db.all<{ slug: string; title_html: string; book: string; chapter: string | null }>(
      `SELECT slug, title_html, book, chapter FROM hadith WHERE slug IN (${chunk.map(() => '?').join(',')})`,
      chunk,
    );
    out.push(...rows.map(toDisplay));
  }
  const order = new Map(slugs.map((s, i) => [s, i]));
  return out.sort((a, b) => order.get(a.slug)! - order.get(b.slug)!);
}

function toDisplay(r: { slug: string; title_html: string; book: string; chapter: string | null }): DisplayListItem {
  return { slug: r.slug, title: richTextToPlain(r.title_html), book: r.book, chapter: r.chapter };
}

export interface DisplayListOptions {
  book?: string;
  chapter?: string;
  narrator?: string;
}

/** Every narration matching the filter, in the website's order, ready for a virtualised list. */
export async function listHadithForDisplay(db: DbAdapter, opts: DisplayListOptions = {}): Promise<DisplayListItem[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (opts.book) {
    where.push('h.book = ?');
    params.push(opts.book);
  }
  if (opts.chapter) {
    where.push('h.chapter = ?');
    params.push(opts.chapter);
  }
  if (opts.narrator) {
    where.push('h.id IN (SELECT hadith_id FROM hadith_narrators WHERE narrator_slug = ?)');
    params.push(opts.narrator);
  }
  const rows = await db.all<{ slug: string; title_html: string; book: string; chapter: string | null }>(
    `SELECT h.slug, h.title_html, h.book, h.chapter FROM hadith h
     LEFT JOIN books b ON b.name = h.book
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY COALESCE(b.sort_order, 9999), h.rowid`,
    params,
  );
  return rows.map(toDisplay);
}

export async function getChapterBySlug(
  db: DbAdapter,
  slug: string,
): Promise<{ slug: string; name: string; parent: string | null; description: string | null; count: number } | null> {
  return (
    (await db.get<{ slug: string; name: string; parent: string | null; description: string | null; count: number }>(
      'SELECT slug, name, parent, description, count FROM chapters WHERE slug = ?',
      [slug],
    )) ?? null
  );
}

/** chapter slug → name, for badges on list rows. */
export async function chapterNames(db: DbAdapter): Promise<Record<string, string>> {
  const rows = await db.all<{ slug: string; name: string }>('SELECT slug, name FROM chapters');
  return Object.fromEntries(rows.map((r) => [r.slug, r.name]));
}

export interface Announcement {
  id: string;
  kind: string;
  text: string;
}

export async function listAnnouncements(db: DbAdapter): Promise<Announcement[]> {
  const rows = await db.all<{ id: string; kind: string; content: string }>(
    'SELECT id, kind, content FROM announcements ORDER BY created_at DESC',
  );
  return rows.map((r) => ({ id: r.id, kind: r.kind, text: richTextToPlain(r.content) })).filter((a) => a.text);
}

export interface LibraryFile {
  id: string;
  name: string;
  url: string;
  image_url: string | null;
}

export async function listFiles(db: DbAdapter): Promise<LibraryFile[]> {
  return db.all<LibraryFile>('SELECT id, name, url, image_url FROM files ORDER BY created_at DESC, name');
}

export interface ContentInfo {
  schemaVersion: number;
  builtAt: string | null;
  counts: { hadith: number; books: number; chapters: number; narrators: number };
}

export async function getContentInfo(db: DbAdapter): Promise<ContentInfo> {
  const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM meta');
  const meta = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  let counts = { hadith: 0, books: 0, chapters: 0, narrators: 0 };
  try {
    counts = { ...counts, ...(JSON.parse(meta[META_KEYS.counts] ?? '{}') as Partial<typeof counts>) };
  } catch {
    // keep zeros
  }
  return {
    schemaVersion: parseInt(meta[META_KEYS.schemaVersion] ?? '0', 10) || 0,
    builtAt: meta[META_KEYS.builtAt] ?? null,
    counts,
  };
}

/** Canonical website link for sharing a narration. */
export function hadithWebUrl(slug: string): string {
  return `https://tehqeqatehadees.com/hadees-detail/${encodeURIComponent(slug)}`;
}

export function narratorWebUrl(slug: string): string {
  return `https://tehqeqatehadees.com/narrators/${encodeURIComponent(slug)}`;
}
