import type { DbAdapter } from './db';
import { htmlToText, type Section } from './html';
import { normalize } from './normalize';
import type { NarratorRef, NarratorStudy } from './repo';
import { CONTENT_SCHEMA } from './schema';

/**
 * Writes the content DB. Used by the snapshot builder and by tests; the app never writes
 * content. All text that goes into FTS is normalised here, the same way queries are.
 */

export async function createContentDb(db: DbAdapter): Promise<void> {
  await db.exec(CONTENT_SCHEMA);
}

export interface HadithInput {
  id: string;
  slug: string;
  book: string;
  chapter: string | null;
  type: string | null;
  title_html: string;
  hukm_html: string | null;
  sections: Section[];
  references_html: string | null;
  narrators: NarratorRef[];
  related: string[];
  authored_at: string | null;
  updated_at: string;
}

export async function insertHadith(db: DbAdapter, h: HadithInput, chapterName: string | null): Promise<void> {
  const titleText = htmlToText(h.title_html);
  const hukmText = htmlToText(h.hukm_html);
  const body = h.sections.map((s) => `${htmlToText(s.heading)}\n${htmlToText(s.content)}`).join('\n');
  await db.run(
    `INSERT INTO hadith (id, slug, book, chapter, type, title_html, title_text, hukm_html, hukm_text,
       sections_json, references_html, narrators_json, related_json, authored_at, updated_at, body_chars)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      h.id,
      h.slug,
      h.book,
      h.chapter,
      h.type,
      h.title_html,
      titleText,
      h.hukm_html,
      hukmText || null,
      JSON.stringify(h.sections),
      h.references_html,
      JSON.stringify(h.narrators),
      JSON.stringify(h.related),
      h.authored_at,
      h.updated_at,
      body.length,
    ],
  );
  const row = await db.get<{ rowid: number }>('SELECT rowid FROM hadith WHERE id = ?', [h.id]);
  await db.run('INSERT INTO hadith_fts (rowid, title, body, hukm, book, chapter) VALUES (?, ?, ?, ?, ?, ?)', [
    row!.rowid,
    normalize(titleText),
    normalize(body),
    normalize(hukmText),
    normalize(h.book),
    normalize(chapterName ?? ''),
  ]);
  for (const n of h.narrators) {
    await db.run('INSERT OR IGNORE INTO hadith_narrators (hadith_id, narrator_slug) VALUES (?, ?)', [h.id, n.slug]);
  }
}

export interface NarratorInput {
  id: string;
  slug: string;
  name: string;
  arabic_name: string | null;
  aliases: string[];
  death_note: string | null;
  death_year: number | null;
  century: number | null;
  study_count: number;
  hadith_count: number;
  excerpt: string | null;
  book: string | null;
  study: NarratorStudy | null;
  other_studies: { hadith_slug: string; book: string; title_text: string }[];
  related: string[];
}

export async function insertNarrator(db: DbAdapter, n: NarratorInput): Promise<void> {
  await db.run(
    `INSERT INTO narrators (id, slug, name, arabic_name, aliases_json, death_note, death_year, century,
       study_count, hadith_count, excerpt, book, study_json, other_studies_json, related_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      n.id,
      n.slug,
      n.name,
      n.arabic_name,
      JSON.stringify(n.aliases),
      n.death_note,
      n.death_year,
      n.century,
      n.study_count,
      n.hadith_count,
      n.excerpt,
      n.book,
      n.study ? JSON.stringify(n.study) : null,
      JSON.stringify(n.other_studies),
      JSON.stringify(n.related),
    ],
  );
  const row = await db.get<{ rowid: number }>('SELECT rowid FROM narrators WHERE id = ?', [n.id]);
  await db.run('INSERT INTO narrator_fts (rowid, name, arabic_name, aliases) VALUES (?, ?, ?, ?)', [
    row!.rowid,
    normalize(n.name),
    normalize(n.arabic_name ?? ''),
    normalize(n.aliases.join(' ')),
  ]);
}
