import { describe, expect, it } from 'vitest';

import { normalize, normalizeWithMap, tokenize } from '../src/normalize';

// [input, expected]. Written as escapes where the difference is invisible.
const CASES: [string, string, string][] = [
  ['plain urdu unchanged', 'نماز جنازہ', 'نماز جنازہ'],
  ['zer on نمازِ', 'نمازِ', 'نماز'],
  ['tatweel', 'نمــاز', 'نماز'],
  ['arabic kaf', 'كتاب', 'کتاب'],
  ['arabic yeh', 'علي', 'علی'],
  ['alef maksura', 'موسى', 'موسی'],
  ['yeh with hamza', 'جائزہ', 'جایزہ'],
  ['decomposed yeh + hamza above', 'جائزہ', 'جایزہ'],
  ['waw with hamza', 'مؤمن', 'مومن'],
  ['alef with hamza above', 'أحمد', 'احمد'],
  ['alef with hamza below', 'إسلام', 'اسلام'],
  ['alef madda', 'آدم', 'ادم'],
  ['alef madda decomposed', 'آدم', 'ادم'],
  ['alef wasla', 'ٱلله', 'الله'.replace('ه', 'ہ')],
  ['arabic heh', 'عليه', 'علیہ'],
  ['teh marbuta', 'صلاة', 'صلاہ'],
  ['urdu teh marbuta goal', 'صلوۃ', 'صلوہ'],
  ['heh goal with hamza', 'مقدمۂ', 'مقدمہ'],
  ['heh with yeh above', 'ۀ', 'ہ'],
  ['do-chashmi heh kept', 'بھی', 'بھی'],
  ['yeh barree kept', 'کے', 'کے'],
  ['yeh barree with hamza', 'ۓ', 'ے'],
  ['full harakat arabic', 'قَالَ رَسُولُ اللَّهِ', 'قال رسول اللہ'],
  ['superscript alef', 'رحمٰن', 'رحمن'],
  ['quranic marks', 'الرَّحِيمِۚ', 'الرحیم'],
  ['urdu digits', '۱۳۸ھ', '138ھ'],
  ['arabic-indic digits', '٢٠٢٠', '2020'],
  ['ascii digits', '2020', '2020'],
  ['zwnj removed', 'کی‌وجہ', 'کیوجہ'],
  ['rlm removed', '‏حکم', 'حکم'],
  ['nbsp and runs of space', ' حکم   شدید\n\nضعیف ', 'حکم شدید ضعیف'],
  ['latin lowercased', 'Hadith ABC', 'hadith abc'],
  ['arabic presentation forms', 'ﻻ', 'لا'],
  ['mixed', 'المُقَدِّمَة', 'المقدمہ'],
  ['empty', '', ''],
];

describe('normalize', () => {
  for (const [name, input, expected] of CASES) {
    it(name, () => {
      expect(normalize(input)).toBe(expected);
    });
  }

  it('Arabic and Urdu spellings of the preface meet', () => {
    expect(normalize('المقدمة').endsWith(normalize('مقدمہ'))).toBe(true);
  });

  it('map points every output char at the original', () => {
    const input = 'قَالَ  رَسُولُ';
    const { text, map } = normalizeWithMap(input);
    expect(map).toHaveLength(text.length + 1);
    expect(map[map.length - 1]).toBe(input.length);
    // the first letter of the second word maps to the original ر
    const second = text.indexOf('ر');
    expect(input[map[second]!]).toBe('ر');
  });

  it('tokenize drops punctuation', () => {
    expect(tokenize('حکم: شدید ضعیف، بیان نہیں کر سکتے۔')).toEqual([
      'حکم',
      'شدید',
      'ضعیف',
      'بیان',
      'نہیں',
      'کر',
      'سکتے',
    ]);
  });
});
