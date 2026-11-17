/**
 * Compares offline search on a built snapshot with the website's search, query by query.
 *
 *   npx tsx src/compare.ts [--db out/hadith-v1.sqlite] [--base URL]
 *
 * Prints, per query: overlap of the top 10, and whether both put the same narration first.
 * Makes one request per query, one at a time.
 */
import { parseArgs } from 'node:util';

import { searchHadith } from '@tehqeqat/core';
import { NodeDb } from '@tehqeqat/core/node';

const QUERIES = [
  'نماز جنازہ',
  'مقدمہ',
  'والدین',
  'درود شریف',
  'جمعہ',
  'رمضان',
  'شب برات',
  'ماں کی نافرمانی',
  'کلمہ طیبہ',
  'علم حاصل کرو',
  'صدقہ',
  'حضرت علی',
  'جنت',
  'سورۃ یس',
  'عاشورہ',
  'بڑھیا کا کچرا پھینکنا',
  'ابان بن ابی عیاش',
  'من گھڑت',
  'قرآن',
  'نور محمدی',
];

const { values: args } = parseArgs({
  options: {
    db: { type: 'string', default: 'out/hadith-v1.sqlite' },
    base: { type: 'string', default: 'https://tehqeqatehadees.com/api' },
  },
});

async function siteTop10(q: string): Promise<{ slugs: string[]; total: number }> {
  const url = `${args.base}/search-hadees?search_keyword=${encodeURIComponent(q)}&page=1`;
  const res = await fetch(url, { headers: { 'user-agent': 'tehqeqat-offline-builder' } });
  const body = (await res.json()) as { total_records: number; data: { slug: string }[] };
  await new Promise((r) => setTimeout(r, 300));
  return { slugs: body.data.slice(0, 10).map((d) => d.slug), total: body.total_records };
}

async function main() {
  const db = new NodeDb(args.db!);
  let sameFirst = 0;
  let overlapSum = 0;
  for (const q of QUERIES) {
    const site = await siteTop10(q);
    const local = await searchHadith(db, q, { limit: 10 });
    const mine = local.hits.map((h) => h.slug);
    const overlap = mine.filter((s) => site.slugs.includes(s)).length;
    const denom = Math.min(10, site.slugs.length, Math.max(mine.length, 1));
    const first = mine[0] !== undefined && mine[0] === site.slugs[0];
    if (first) sameFirst++;
    overlapSum += denom ? overlap / denom : 1;
    console.log(
      `${first ? '=' : ' '} ${String(overlap).padStart(2)}/${denom}  site ${String(site.total).padStart(3)}  app ${String(local.total).padStart(3)} (L${local.level ?? '-'})  ${q}`,
    );
  }
  console.log(
    `\nsame first result: ${sameFirst}/${QUERIES.length}; mean top-10 overlap: ${((overlapSum / QUERIES.length) * 100).toFixed(0)}%`,
  );
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
