import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NodeDb } from '../src/adapters/node';
import { getHadith, listHadith } from '../src/repo';
import { excerptAround, searchHadith, searchNarrators, splitForHighlight } from '../src/search';
import { createContentDb, insertHadith, insertNarrator, type HadithInput } from '../src/writer';

const db = new NodeDb(':memory:');

const h = (slug: string, title: string, body: string, extra: Partial<HadithInput> = {}): HadithInput => ({
  id: `id-${slug}`,
  slug,
  book: 'کتاب اول',
  chapter: 'عبادات',
  type: null,
  title_html: `<p><span class="font-class-Jameel-Noori-Nastaleeq">${title}</span></p>`,
  hukm_html: '<p>حکم: من گھڑت</p>',
  sections: [{ heading: '', content: `<p>${body}</p>` }],
  references_html: null,
  narrators: [],
  related: [],
  authored_at: '2020-03-01',
  updated_at: '2026-10-30T00:00:00Z',
  ...extra,
});

beforeAll(async () => {
  await createContentDb(db);
  await db.transaction(async () => {
    await insertHadith(db, h('janaza', 'نمازِ جنازہ کی فضیلت', 'جو شخص نماز جنازہ پڑھے'), 'عبادات');
    await insertHadith(db, h('janaza-2', 'جنازہ کے ساتھ چلنا', 'نماز کے بعد جنازہ کے ساتھ'), 'عبادات');
    await insertHadith(db, h('namaz', 'نماز کی اہمیت', 'نماز دین کا ستون ہے'), 'عبادات');
    await insertHadith(db, h('walidain', 'ماں کی نافرمانی', 'کلمہ سے محرومی', { related: ['namaz', 'janaza'], chapter: 'حقوق' }), 'حقوق');
    await insertHadith(db, h('arabic', 'المقدمة', 'قَالَ رَسُولُ اللَّهِ'), null);
    await insertNarrator(db, {
      id: 'n1',
      slug: 'aban',
      name: 'ابان بن ابی عیاش',
      arabic_name: 'أبان بن أبي عياش',
      aliases: [],
      death_note: null,
      death_year: 138,
      century: 2,
      study_count: 1,
      hadith_count: 1,
      excerpt: null,
      book: null,
      study: null,
      other_studies: [],
      related: [],
    });
  });
});

afterAll(() => db.close());

describe('searchHadith', () => {
  it('ranks the exact phrase first, regardless of diacritics', async () => {
    const r = await searchHadith(db, 'نماز جنازہ');
    expect(r.hits[0]?.slug).toBe('janaza');
    expect(r.hits[0]?.level).toBe(1);
  });

  it('falls back to all words, then any meaningful word', async () => {
    const r = await searchHadith(db, 'جنازہ نماز');
    expect(r.hits.map((x) => x.slug)).toContain('janaza-2');
    expect(r.level).toBe(2);
  });

  it('a common word alone does not widen the match', async () => {
    const r = await searchHadith(db, 'کی ستون');
    expect(r.hits.map((x) => x.slug)).toEqual(['namaz']);
  });

  it('prefix-matches the last word while typing', async () => {
    const r = await searchHadith(db, 'نافرما');
    expect(r.hits[0]?.slug).toBe('walidain');
  });

  it('Arabic spelling finds Urdu-normalised text and vice versa', async () => {
    expect((await searchHadith(db, 'مقدمہ')).hits).toHaveLength(0); // whole word differs (ال)
    expect((await searchHadith(db, 'المقدمہ')).hits[0]?.slug).toBe('arabic');
    expect((await searchHadith(db, 'رسول اللہ')).hits[0]?.slug).toBe('arabic');
  });

  it('filters by chapter', async () => {
    const r = await searchHadith(db, 'نماز', { chapter: 'حقوق' });
    expect(r.hits).toHaveLength(0);
  });

  it('empty or punctuation-only query returns nothing', async () => {
    expect((await searchHadith(db, ' ، ۔ ')).hits).toHaveLength(0);
  });
});

describe('repo', () => {
  it('getHadith returns related in stored order', async () => {
    const x = await getHadith(db, 'walidain');
    expect(x?.related.map((r) => r.slug)).toEqual(['namaz', 'janaza']);
    expect(x?.sections[0]?.content).toContain('کلمہ');
  });

  it('listHadith filters by chapter', async () => {
    expect((await listHadith(db, { chapter: 'حقوق' })).map((r) => r.slug)).toEqual(['walidain']);
  });
});

describe('narrators', () => {
  it('finds a narrator by Arabic or Urdu spelling', async () => {
    expect((await searchNarrators(db, 'ابان'))[0]?.slug).toBe('aban');
    expect((await searchNarrators(db, 'أبي عياش'))[0]?.slug).toBe('aban');
  });
});

describe('highlight', () => {
  it('marks the original text, keeping its diacritics', () => {
    const segs = splitForHighlight('قَالَ رَسُولُ اللَّهِ', ['رسول']);
    expect(segs.find((s) => s.hit)?.text).toBe('رَسُولُ');
    expect(segs.map((s) => s.text).join('')).toBe('قَالَ رَسُولُ اللَّهِ');
  });

  it('merges overlapping matches', () => {
    const segs = splitForHighlight('نماز جنازہ', ['نماز', 'نماز جنازہ']);
    expect(segs).toEqual([{ text: 'نماز جنازہ', hit: true }]);
  });

  it('excerpt is centred on the first match', () => {
    const long = `${'الف '.repeat(100)}نماز ${'ب '.repeat(100)}`;
    const e = excerptAround(long, ['نماز'], 20);
    expect(e).toContain('نماز');
    expect(e.startsWith('… ')).toBe(true);
  });
});
