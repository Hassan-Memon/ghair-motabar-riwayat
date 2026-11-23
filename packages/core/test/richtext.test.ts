import { describe, expect, it } from 'vitest';

import { CIRCLED_NUMBERS, findFootnote, footnoteTarget, parseRichText, richTextToPlain } from '../src/richtext';

describe('parseRichText', () => {
  it('spells ARBO honorifics as words and keeps the rest unchanged', () => {
    const html =
      '<p><span dir="RTL" class="font-class-Jameel-Noori-Nastaleeq">حضرت عائشہ </span><span class="font-class-ARBO-DT-1">R</span><span dir="RTL"></span> سے</p>';
    expect(richTextToPlain(html)).toBe('حضرت عائشہ رضی اللہ عنہا سے');
  });

  it('writes circled numbers as Unicode circled digits', () => {
    expect(CIRCLED_NUMBERS['1']).toBe('①');
    expect(CIRCLED_NUMBERS['0']).toBe('⑩');
    expect(CIRCLED_NUMBERS['(']).toBe('⑳'); // the font swaps 19 and 20
    expect(CIRCLED_NUMBERS[')']).toBe('⑲');
    expect(CIRCLED_NUMBERS['q']).toBe('㉑');
    const blocks = parseRichText('<p>شرط <span class="font-class-ARBO-UW">2</span> یہ ہے</p>');
    expect(blocks[0]!.runs.map((r) => r.text).join('')).toContain('②');
  });

  it('does not treat a paragraph with Arbo-1 style as a symbol', () => {
    expect(richTextToPlain('<p class="font-class-Arbo-1">عام متن</p>')).toBe('عام متن');
  });

  it('marks scripts, bold, superscript and footnote links', () => {
    const blocks = parseRichText(
      '<p dir="RTL">اردو <span class="font-class-Bashar">عربي</span> <b>جلی</b><a href="#_ftn1" name="_ftnref1"><sup>[1]</sup></a></p>',
    );
    expect(blocks).toHaveLength(1);
    const runs = blocks[0]!.runs;
    expect(runs.find((r) => r.text === 'عربي')!.script).toBe('arabic');
    expect(runs.find((r) => r.text === 'جلی')!.bold).toBe(true);
    const mark = runs.find((r) => r.text === '[1]')!;
    expect(mark.sup).toBe(true);
    expect(footnoteTarget(mark.href)).toBe('_ftn1');
    expect(blocks[0]!.anchors).toEqual(['_ftnref1']);
  });

  it('splits paragraphs, keeps <br> as a newline and drops empty blocks', () => {
    const blocks = parseRichText('<p>ایک<br>دو</p><p> </p><p><span></span></p><p>تین</p>');
    expect(blocks.map((b) => b.runs.map((r) => r.text).join(''))).toEqual(['ایک\nدو', 'تین']);
  });

  it('decodes entities and collapses Word line breaks inside a paragraph', () => {
    expect(richTextToPlain('<p>کلمہ\nسے&nbsp;محرومی &amp; ہے</p>')).toBe('کلمہ سے محرومی & ہے');
  });

  it('finds a footnote and its continuation paragraphs', () => {
    const refs = parseRichText(
      '<p><a href="#_ftnref1" name="_ftn1">[1]</a> اول</p><p>جاری</p><p><a href="#_ftnref2" name="_ftn2">[2]</a> دوم</p>',
    );
    expect(findFootnote(refs, '_ftn1')).toHaveLength(2);
    expect(findFootnote(refs, '_ftn2')).toHaveLength(1);
    expect(findFootnote(refs, '_ftn9')).toEqual([]);
  });

  it('marks Word heading paragraphs', () => {
    expect(parseRichText('<p class="RighHadding">عنوان</p>')[0]!.heading).toBe(true);
  });

  it('returns nothing for empty input', () => {
    expect(parseRichText(null)).toEqual([]);
    expect(richTextToPlain('')).toBe('');
  });
});
