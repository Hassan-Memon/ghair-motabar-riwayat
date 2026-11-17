/**
 * Builds the offline content snapshot from tehqeqatehadees.com's public JSON API.
 *
 *   npm run content:build -- [--base URL] [--out DIR] [--cache DIR] [--prev-manifest FILE]
 *
 * Polite by design: one request at a time, a pause between requests, and a raw-response
 * cache so a nightly run only fetches narrations whose `updated_at` changed (and the
 * narrators linked to them). A cold run makes about 1,350 requests.
 *
 * Output in --out: hadith-v<schema>.sqlite.gz and manifest.json. When run in GitHub Actions
 * with --prev-manifest, writes `changed=true|false` to $GITHUB_OUTPUT.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

import {
  CONTENT_SCHEMA_VERSION,
  META_KEYS,
  cleanHtml,
  createContentDb,
  htmlToText,
  insertHadith,
  insertNarrator,
  parseSections,
  type ContentManifest,
  type HadithInput,
  type NarratorInput,
} from '@tehqeqat/core';
import { NodeDb } from '@tehqeqat/core/node';

import type * as Api from './api-types';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'https://tehqeqatehadees.com/api' },
    out: { type: 'string', default: 'out' },
    cache: { type: 'string', default: '.cache' },
    'prev-manifest': { type: 'string' },
    'delay-ms': { type: 'string', default: '150' },
    'min-app-version': { type: 'string', default: '1.0.0' },
  },
});

const BASE = args.base!.replace(/\/$/, '');
const OUT = resolve(args.out!);
const CACHE = resolve(args.cache!);
const DELAY = Number(args['delay-ms']);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let requests = 0;
async function getJson<T>(path: string): Promise<T> {
  const url = `${BASE}/${path}`;
  for (let attempt = 1; ; attempt++) {
    try {
      requests++;
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'tehqeqat-offline-builder' },
        signal: AbortSignal.timeout(60_000),
      });
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !type.includes('json')) throw new Error(`${res.status} ${type} for ${url}`);
      const body = (await res.json()) as T;
      await sleep(DELAY);
      return body;
    } catch (e) {
      if (attempt >= 4) throw e;
      const wait = 2000 * 2 ** attempt;
      console.warn(`retry ${attempt} in ${wait} ms: ${(e as Error).message}`);
      await sleep(wait);
    }
  }
}

function readCache<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

const fileKey = (s: string) => createHash('sha1').update(s).digest('hex');
const enc = encodeURIComponent;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`API shape changed: ${msg}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(CACHE, 'hadith'), { recursive: true });
  mkdirSync(join(CACHE, 'narrators'), { recursive: true });
  const t0 = Date.now();

  // 1. The list of narrations (id, slug, updated_at).
  const first = await getJson<Api.ListPage>('all-hadees/1');
  assert(typeof first.total_records === 'number' && Array.isArray(first.data), 'all-hadees');
  const listed = [...first.data];
  const pages = Math.ceil(first.total_records / Math.max(1, first.data.length));
  for (let p = 2; p <= pages; p++) {
    const page = await getJson<Api.ListPage>(`all-hadees/${p}`);
    listed.push(...page.data);
  }
  const unique = new Map(listed.map((r) => [r.id, r]));
  assert(unique.size === first.total_records, `listed ${unique.size} of ${first.total_records}`);
  console.log(`list: ${unique.size} narrations in ${pages} pages`);

  // 2. Details, from cache when updated_at is unchanged.
  const details: Api.HadithDetail[] = [];
  let fetched = 0;
  for (const row of unique.values()) {
    const file = join(CACHE, 'hadith', `${fileKey(row.id)}.json`);
    const cached = readCache<{ updated_at: string; data: Api.HadithDetail }>(file);
    if (cached && cached.updated_at === row.updated_at && cached.data.slug === row.slug) {
      details.push(cached.data);
      continue;
    }
    const d = await getJson<Api.HadithDetail>(`hadees-detail/${enc(row.slug)}`);
    assert(d.id === row.id && typeof d.title === 'string', `detail ${row.slug}`);
    writeFileSync(file, JSON.stringify({ updated_at: row.updated_at, data: d }));
    details.push(d);
    if (++fetched % 50 === 0) console.log(`  details fetched: ${fetched}`);
  }
  console.log(`details: ${fetched} fetched, ${details.length - fetched} from cache`);

  // 3. Registries and small lists.
  const { books } = await getJson<{ books: Api.Book[] }>('books');
  const { chapters } = await getJson<{ chapters: Api.Chapter[] }>('chapters');
  const narratorList = await getJson<{ total: number; narrators: Api.NarratorListRow[] }>('narrators');
  const { announcements } = await getJson<{ announcements: Api.Announcement[] }>('announcements');
  const files = await getJson<Api.FileRow[]>('files');
  assert(Array.isArray(books) && Array.isArray(chapters) && Array.isArray(narratorList.narrators), 'registries');
  assert(narratorList.narrators.length === narratorList.total, 'narrators total');

  // 4. Narrator studies: refetch when the list row changed or a linked narration changed.
  const narratorHadith = new Map<string, string[]>();
  for (const d of details) {
    for (const n of d.narrators ?? []) {
      narratorHadith.set(n.slug, [...(narratorHadith.get(n.slug) ?? []), d.id]);
    }
  }
  const updatedById = new Map(details.map((d) => [d.id, d.updated_at]));
  const narratorDetails: Api.NarratorDetail[] = [];
  let nFetched = 0;
  for (const row of narratorList.narrators) {
    const linked = (narratorHadith.get(row.slug) ?? []).sort().map((id) => `${id}@${updatedById.get(id)}`);
    const key = fileKey(JSON.stringify(row) + linked.join(','));
    const file = join(CACHE, 'narrators', `${fileKey(row.slug)}.json`);
    const cached = readCache<{ key: string; data: Api.NarratorDetail }>(file);
    if (cached && cached.key === key) {
      narratorDetails.push(cached.data);
      continue;
    }
    const d = await getJson<Api.NarratorDetail>(`narrators/${enc(row.slug)}`);
    assert(d.slug === row.slug, `narrator ${row.slug}`);
    writeFileSync(file, JSON.stringify({ key, data: d }));
    narratorDetails.push(d);
    if (++nFetched % 50 === 0) console.log(`  narrators fetched: ${nFetched}`);
  }
  console.log(`narrators: ${nFetched} fetched, ${narratorDetails.length - nFetched} from cache`);

  // 5. Write the database.
  const dbPath = join(OUT, `hadith-v${CONTENT_SCHEMA_VERSION}.sqlite`);
  rmSync(dbPath, { force: true });
  const db = new NodeDb(dbPath);
  db.raw.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA page_size = 4096;');
  await createContentDb(db);
  const hash = createHash('sha256');
  const feed = (x: unknown) => hash.update(JSON.stringify(x));

  const chapterName = new Map(chapters.map((c) => [c.slug, c.name]));
  const fileUrl = new Map(files.map((f) => [f.id, f.file?.url ?? null]));

  // Stable order: the website's list order.
  const order = new Map([...unique.keys()].map((id, i) => [id, i]));
  details.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  narratorDetails.sort((a, b) => a.slug.localeCompare(b.slug));

  await db.transaction(async () => {
    for (const d of details) {
      const h: HadithInput = {
        id: d.id,
        slug: d.slug,
        book: d.book,
        chapter: d.chapter || null,
        type: d.type || null,
        title_html: cleanHtml(d.title),
        hukm_html: d.hukm ? cleanHtml(d.hukm) : null,
        sections: parseSections(d.html_content).map((s) => ({
          heading: cleanHtml(s.heading),
          content: cleanHtml(s.content),
        })),
        references_html: d.references ? cleanHtml(d.references) : null,
        narrators: (d.narrators ?? []).map((n) => ({
          slug: n.slug,
          name: n.name,
          arabic_name: n.arabic_name || null,
          start: n.start,
          end: n.end,
        })),
        related: (d.related ?? []).map((r) => r.slug),
        authored_at: d.authored_at || null,
        updated_at: d.updated_at,
      };
      feed(h);
      await insertHadith(db, h, h.chapter ? (chapterName.get(h.chapter) ?? null) : null);
    }

    for (const b of books) {
      const row = [
        b.id,
        b.name,
        JSON.stringify(b.aliases ?? []),
        b.is_series ? 1 : 0,
        b.volume_no ?? null,
        b.published_at ?? null,
        b.sort_order ?? null,
        b.description ?? null,
        (b.pdf_file_id && fileUrl.get(b.pdf_file_id)) || null,
        b.count ?? 0,
      ] as const;
      feed(row);
      await db.run(
        `INSERT INTO books (id, name, aliases_json, is_series, volume_no, published_at, sort_order, description, pdf_url, count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row,
      );
    }

    for (const c of chapters) {
      const row = [c.id, c.slug, c.name, c.parent ?? null, c.order ?? null, c.description ?? null, c.count ?? 0] as const;
      feed(row);
      await db.run(
        'INSERT INTO chapters (id, slug, name, parent, sort_order, description, count) VALUES (?, ?, ?, ?, ?, ?, ?)',
        row,
      );
    }

    for (const n of narratorDetails) {
      const input: NarratorInput = {
        id: n.id,
        slug: n.slug,
        name: n.name,
        arabic_name: n.arabic_name || null,
        aliases: n.aliases ?? [],
        death_note: n.death_note || null,
        death_year: n.death_year ?? null,
        century: n.century ?? null,
        study_count: n.study_count ?? 0,
        hadith_count: n.hadith_count ?? 0,
        excerpt: n.excerpt || null,
        book: n.book || null,
        study: n.study
          ? {
              hadith_slug: n.study.hadith.slug,
              sections: (n.study.sections ?? []).map((s) => ({
                heading: cleanHtml(s.heading),
                content: cleanHtml(s.content),
              })),
              references_html: n.study.references ? cleanHtml(n.study.references) : null,
            }
          : null,
        other_studies: (n.other_studies ?? []).map((o) => ({
          hadith_slug: o.hadith.slug,
          book: o.hadith.book,
          title_text: htmlToText(o.hadith.title),
        })),
        related: (n.related ?? []).map((r) => r.slug),
      };
      feed(input);
      await insertNarrator(db, input);
    }

    for (const a of announcements ?? []) {
      const row = [a.id, a.type, a.content, a.createdAt ? new Date(a.createdAt._seconds * 1000).toISOString() : null] as const;
      feed(row);
      await db.run('INSERT INTO announcements (id, kind, content, created_at) VALUES (?, ?, ?, ?)', row);
    }

    // Only what the reader needs; uploader ids are deliberately not copied.
    for (const f of files) {
      if (!f.file?.url) continue;
      const row = [
        f.id,
        f.file.name,
        f.file.url,
        f.image?.url ?? null,
        f.createdAt ? new Date(f.createdAt._seconds * 1000).toISOString() : null,
      ] as const;
      feed(row);
      await db.run('INSERT INTO files (id, name, url, image_url, created_at) VALUES (?, ?, ?, ?, ?)', row);
    }
  });

  const contentHash = hash.digest('hex');
  const latest = [...details.map((d) => d.updated_at), ...books.map((b) => b.updated_at ?? ''), ...chapters.map((c) => c.updated_at ?? '')]
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const counts = {
    hadith: details.length,
    books: books.length,
    chapters: chapters.length,
    narrators: narratorDetails.length,
  };
  const builtAt = new Date().toISOString();
  for (const [k, v] of [
    [META_KEYS.schemaVersion, String(CONTENT_SCHEMA_VERSION)],
    [META_KEYS.builtAt, builtAt],
    [META_KEYS.sourceLatestUpdatedAt, latest ?? ''],
    [META_KEYS.counts, JSON.stringify(counts)],
    ['content_hash', contentHash],
  ] as const) {
    await db.run('INSERT INTO meta (key, value) VALUES (?, ?)', [k, v]);
  }
  db.raw.exec("INSERT INTO hadith_fts(hadith_fts) VALUES('optimize'); INSERT INTO narrator_fts(narrator_fts) VALUES('optimize');");
  const check = await db.get<{ quick_check: string }>('PRAGMA quick_check');
  assert(check?.quick_check === 'ok', 'quick_check');
  db.raw.exec('VACUUM');
  db.close();

  // 6. Compress and describe.
  const raw = readFileSync(dbPath);
  const gz = gzipSync(raw, { level: 9 });
  const gzName = `hadith-v${CONTENT_SCHEMA_VERSION}.sqlite.gz`;
  writeFileSync(join(OUT, gzName), gz);
  const manifest: ContentManifest = {
    schema_version: CONTENT_SCHEMA_VERSION,
    built_at: builtAt,
    source_latest_updated_at: latest,
    content_hash: contentHash,
    snapshot: {
      file: gzName,
      bytes: gz.length,
      sha256: createHash('sha256').update(gz).digest('hex'),
      uncompressed_bytes: statSync(dbPath).size,
    },
    counts,
    min_app_version: args['min-app-version']!,
  };
  writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  let changed = true;
  const prevPath = args['prev-manifest'];
  if (prevPath && existsSync(prevPath)) {
    const prev = readCache<ContentManifest>(prevPath);
    changed = !prev || prev.content_hash !== contentHash || prev.schema_version !== CONTENT_SCHEMA_VERSION;
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  console.log(
    `done in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${requests} requests: ` +
      `${counts.hadith} narrations, ${counts.narrators} narrators, ${counts.books} books, ${counts.chapters} chapters; ` +
      `sqlite ${mb(manifest.snapshot.uncompressed_bytes)}, gz ${mb(gz.length)}; changed=${changed}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
