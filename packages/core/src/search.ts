import type { DbAdapter } from './db';
import { normalizeWithMap, tokenize } from './normalize';

/**
 * Offline search, modelled on the website's: try the exact phrase, then all the words, then
 * any of the meaningful words, and stop at the first level that finds enough. A level that
 * finds fewer than MIN_HITS still shows its rows first, followed by the next level's.
 */

const MIN_HITS = 3;

/** Words that appear in almost every narration; they never decide a match on their own. */
const STOPWORDS = new Set(
  [
    'کا', 'کی', 'کے', 'کو', 'میں', 'سے', 'نے', 'پر', 'اور', 'ہے', 'ہیں', 'تھا', 'تھے', 'تھی',
    'یہ', 'وہ', 'جو', 'کہ', 'بھی', 'تو', 'ہی', 'اس', 'ان', 'ایک', 'کر', 'کیا', 'گیا',
    'فی', 'من', 'علی', 'عن', 'الی', 'ما', 'لا', 'ان', 'او', 'ثم',
  ].map((w) => tokenize(w)[0]!),
);

export type MatchLevel = 1 | 2 | 3; // 1 phrase, 2 all words, 3 any meaningful word

export interface SearchOptions {
  limit?: number;
  offset?: number;
  book?: string;
  chapter?: string;
}

export interface SearchHit {
  slug: string;
  title_text: string;
  book: string;
  chapter: string | null;
  level: MatchLevel;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  /** The strongest level that produced rows; 3 means "close matches". */
  level: MatchLevel | null;
  tokens: string[];
}

const quote = (t: string) => `"${t.replace(/"/g, '""')}"`;

/** FTS5 MATCH expressions for each level, or null when a level does not apply. */
export function buildMatchExpressions(query: string): { tokens: string[]; levels: [MatchLevel, string][] } {
  const tokens = tokenize(query);
  if (tokens.length === 0) return { tokens, levels: [] };
  const levels: [MatchLevel, string][] = [];
  const last = tokens.length - 1;
  if (tokens.length > 1) levels.push([1, quote(tokens.join(' '))]);
  // All words; the last one as a prefix so results come while typing.
  levels.push([2, tokens.map((t, i) => (i === last ? `${quote(t)}*` : quote(t))).join(' AND ')]);
  const meaningful = tokens.filter((t) => !STOPWORDS.has(t));
  if (tokens.length > 1 && meaningful.length > 0) {
    levels.push([3, meaningful.map(quote).join(' OR ')]);
  }
  return { tokens, levels };
}

export async function searchHadith(db: DbAdapter, query: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const { tokens, levels } = buildMatchExpressions(query);
  if (levels.length === 0) return { hits: [], total: 0, level: null, tokens };

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const filters: string[] = [];
  const filterParams: string[] = [];
  if (opts.book) {
    filters.push('h.book = ?');
    filterParams.push(opts.book);
  }
  if (opts.chapter) {
    filters.push('h.chapter = ?');
    filterParams.push(opts.chapter);
  }
  const where = filters.length ? `AND ${filters.join(' AND ')}` : '';

  // One ranked query per level, strongest first; stop once enough rows are found.
  // (bm25() cannot be used inside a UNION, so levels are merged here.)
  const ranked: { rowid: number; level: MatchLevel }[] = [];
  const seen = new Set<number>();
  let firstLevel: MatchLevel | null = null;
  for (const [level, expr] of levels) {
    const rows = await db.all<{ rowid: number }>(
      `SELECT h.rowid AS rowid FROM hadith_fts JOIN hadith h ON h.rowid = hadith_fts.rowid
       WHERE hadith_fts MATCH ? ${where}
       ORDER BY bm25(hadith_fts, 5.0, 1.0, 3.0, 0.5, 0.5), h.rowid`,
      [expr, ...filterParams],
    );
    for (const r of rows) {
      if (seen.has(r.rowid)) continue;
      seen.add(r.rowid);
      ranked.push({ rowid: r.rowid, level });
    }
    if (ranked.length > 0 && firstLevel === null) firstLevel = level;
    if (ranked.length >= MIN_HITS) break;
  }

  const page = ranked.slice(offset, offset + limit);
  if (page.length === 0) return { hits: [], total: ranked.length, level: firstLevel, tokens };
  const rows = await db.all<Omit<SearchHit, 'level'> & { rowid: number }>(
    `SELECT rowid, slug, title_text, book, chapter FROM hadith WHERE rowid IN (${page.map(() => '?').join(',')})`,
    page.map((p) => p.rowid),
  );
  const byRowid = new Map(rows.map((r) => [r.rowid, r]));
  const hits = page.map((p) => {
    const { rowid: _rowid, ...r } = byRowid.get(p.rowid)!;
    return { ...r, level: p.level };
  });
  return { hits, total: ranked.length, level: firstLevel, tokens };
}

export interface NarratorHit {
  slug: string;
  name: string;
  arabic_name: string | null;
}

export async function searchNarrators(db: DbAdapter, query: string, limit = 10): Promise<NarratorHit[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const last = tokens.length - 1;
  const expr = tokens.map((t, i) => (i === last ? `${quote(t)}*` : quote(t))).join(' AND ');
  return db.all<NarratorHit>(
    `SELECT n.slug, n.name, n.arabic_name FROM narrator_fts f JOIN narrators n ON n.rowid = f.rowid
     WHERE narrator_fts MATCH ? ORDER BY bm25(narrator_fts), n.hadith_count DESC LIMIT ?`,
    [expr, limit],
  );
}

export interface Segment {
  text: string;
  hit: boolean;
}

/**
 * Split original text into highlighted and plain segments for the given search tokens.
 * Matching runs on the normalised text; ranges map back to the original, so the reader sees
 * their own text with its diacritics, only marked.
 */
export function splitForHighlight(original: string, tokens: readonly string[]): Segment[] {
  if (!original) return [];
  const toks = tokens.filter((t) => t.length > 0);
  if (toks.length === 0) return [{ text: original, hit: false }];
  const { text, map } = normalizeWithMap(original);
  const ranges: [number, number][] = [];
  for (const t of toks) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(t, from);
      if (at < 0) break;
      ranges.push([map[at]!, map[at + t.length]!]);
      from = at + t.length;
    }
  }
  if (ranges.length === 0) return [{ text: original, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const prev = merged[merged.length - 1];
    if (prev && r[0] <= prev[1]) prev[1] = Math.max(prev[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const out: Segment[] = [];
  let pos = 0;
  for (const [a, b] of merged) {
    if (a > pos) out.push({ text: original.slice(pos, a), hit: false });
    out.push({ text: original.slice(a, b), hit: true });
    pos = b;
  }
  if (pos < original.length) out.push({ text: original.slice(pos), hit: false });
  return out;
}

/** A short window of `original` around the first match, for result cards. */
export function excerptAround(original: string, tokens: readonly string[], radius = 90): string {
  const { text, map } = normalizeWithMap(original);
  let at = -1;
  for (const t of tokens) {
    const i = text.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return original.slice(0, radius * 2).trim();
  const center = map[at]!;
  const start = Math.max(0, center - radius);
  const end = Math.min(original.length, center + radius);
  // Widen to word boundaries so a word is never cut in half.
  const s = start === 0 ? 0 : original.lastIndexOf(' ', start) + 1;
  const eSpace = original.indexOf(' ', end);
  const e = eSpace < 0 ? original.length : eSpace;
  return `${s > 0 ? '… ' : ''}${original.slice(s, e).trim()}${e < original.length ? ' …' : ''}`;
}
