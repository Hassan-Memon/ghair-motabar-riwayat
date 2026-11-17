import type { DbAdapter } from './db';
import type { Section } from './html';

/** Read queries over the content DB. Screens call these; they never write SQL. */

export interface HadithListItem {
  slug: string;
  title_text: string;
  book: string;
  chapter: string | null;
}

export interface NarratorRef {
  slug: string;
  name: string;
  arabic_name: string | null;
  start: number;
  end: number;
}

export interface Hadith extends HadithListItem {
  id: string;
  type: string | null;
  title_html: string;
  hukm_html: string | null;
  hukm_text: string | null;
  sections: Section[];
  references_html: string | null;
  narrators: NarratorRef[];
  related: HadithListItem[];
  authored_at: string | null;
  updated_at: string;
}

interface HadithRow {
  id: string;
  slug: string;
  book: string;
  chapter: string | null;
  type: string | null;
  title_html: string;
  title_text: string;
  hukm_html: string | null;
  hukm_text: string | null;
  sections_json: string;
  references_html: string | null;
  narrators_json: string;
  related_json: string;
  authored_at: string | null;
  updated_at: string;
}

const LIST_COLS = 'slug, title_text, book, chapter';

export async function getHadith(db: DbAdapter, slug: string): Promise<Hadith | null> {
  const row = await db.get<HadithRow>('SELECT * FROM hadith WHERE slug = ?', [slug]);
  if (!row) return null;
  const relatedSlugs = JSON.parse(row.related_json) as string[];
  const related = relatedSlugs.length
    ? await db.all<HadithListItem>(
        `SELECT ${LIST_COLS} FROM hadith WHERE slug IN (${relatedSlugs.map(() => '?').join(',')})`,
        relatedSlugs,
      )
    : [];
  const order = new Map(relatedSlugs.map((s, i) => [s, i]));
  related.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
  return {
    id: row.id,
    slug: row.slug,
    book: row.book,
    chapter: row.chapter,
    type: row.type,
    title_html: row.title_html,
    title_text: row.title_text,
    hukm_html: row.hukm_html,
    hukm_text: row.hukm_text,
    sections: JSON.parse(row.sections_json) as Section[],
    references_html: row.references_html,
    narrators: JSON.parse(row.narrators_json) as NarratorRef[],
    related,
    authored_at: row.authored_at,
    updated_at: row.updated_at,
  };
}

export interface ListOptions {
  book?: string;
  chapter?: string;
  narrator?: string;
  limit?: number;
  offset?: number;
}

/** Narrations in the website's list order: by book order, then as stored. */
export async function listHadith(db: DbAdapter, opts: ListOptions = {}): Promise<HadithListItem[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
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
  params.push(opts.limit ?? 50, opts.offset ?? 0);
  return db.all<HadithListItem>(
    `SELECT h.slug, h.title_text, h.book, h.chapter FROM hadith h
     LEFT JOIN books b ON b.name = h.book
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY COALESCE(b.sort_order, 9999), h.rowid
     LIMIT ? OFFSET ?`,
    params,
  );
}

export interface Book {
  id: string;
  name: string;
  aliases: string[];
  is_series: boolean;
  volume_no: number | null;
  published_at: string | null;
  description: string | null;
  pdf_url: string | null;
  count: number;
}

export async function listBooks(db: DbAdapter): Promise<Book[]> {
  const rows = await db.all<Omit<Book, 'aliases' | 'is_series'> & { aliases_json: string; is_series: number }>(
    'SELECT * FROM books ORDER BY COALESCE(sort_order, 9999), name',
  );
  return rows.map(({ aliases_json, is_series, ...r }) => ({
    ...r,
    aliases: JSON.parse(aliases_json) as string[],
    is_series: is_series === 1,
  }));
}

export interface Chapter {
  id: string;
  slug: string;
  name: string;
  parent: string | null;
  description: string | null;
  count: number;
}

export async function listChapters(db: DbAdapter): Promise<Chapter[]> {
  return db.all<Chapter>(
    'SELECT id, slug, name, parent, description, count FROM chapters ORDER BY COALESCE(sort_order, 9999), name',
  );
}

export interface NarratorListItem {
  slug: string;
  name: string;
  arabic_name: string | null;
  death_note: string | null;
  death_year: number | null;
  study_count: number;
  hadith_count: number;
  excerpt: string | null;
}

export async function listNarrators(db: DbAdapter): Promise<NarratorListItem[]> {
  return db.all<NarratorListItem>(
    `SELECT slug, name, arabic_name, death_note, death_year, study_count, hadith_count, excerpt
     FROM narrators ORDER BY name`,
  );
}

export interface NarratorStudy {
  hadith_slug: string;
  sections: Section[];
  references_html: string | null;
}

export interface Narrator extends NarratorListItem {
  aliases: string[];
  book: string | null;
  study: NarratorStudy | null;
  other_studies: { hadith_slug: string; book: string; title_text: string }[];
  related: string[];
}

export async function getNarrator(db: DbAdapter, slug: string): Promise<Narrator | null> {
  const row = await db.get<
    NarratorListItem & {
      aliases_json: string;
      book: string | null;
      study_json: string | null;
      other_studies_json: string;
      related_json: string;
    }
  >('SELECT * FROM narrators WHERE slug = ?', [slug]);
  if (!row) return null;
  const { aliases_json, study_json, other_studies_json, related_json, ...rest } = row;
  return {
    slug: rest.slug,
    name: rest.name,
    arabic_name: rest.arabic_name,
    death_note: rest.death_note,
    death_year: rest.death_year,
    study_count: rest.study_count,
    hadith_count: rest.hadith_count,
    excerpt: rest.excerpt,
    book: rest.book,
    aliases: JSON.parse(aliases_json) as string[],
    study: study_json ? (JSON.parse(study_json) as NarratorStudy) : null,
    other_studies: JSON.parse(other_studies_json) as Narrator['other_studies'],
    related: JSON.parse(related_json) as string[],
  };
}

export async function getMeta(db: DbAdapter, key: string): Promise<string | null> {
  const r = await db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return r?.value ?? null;
}
