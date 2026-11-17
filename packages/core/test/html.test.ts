import { describe, expect, it } from 'vitest';

import { cleanHtml, htmlToText, parseSections } from '../src/html';
import { compareVersions, decideUpdate, type ContentManifest } from '../src/manifest';

describe('htmlToText', () => {
  it('turns paragraphs into lines and decodes entities', () => {
    expect(htmlToText('<p>حکم:&nbsp;شدید</p><p>ضعیف &amp; <b>موضوع</b></p>')).toBe('حکم: شدید\nضعیف & موضوع');
  });
  it('handles numeric entities and empty input', () => {
    expect(htmlToText('&#1606;&#x645;')).toBe('نم');
    expect(htmlToText(null)).toBe('');
  });
});

describe('cleanHtml', () => {
  it('keeps font classes, drops Mso classes, lang and mso styles', () => {
    const out = cleanHtml(
      '<p class="MsoNormal Riwayat" dir="RTL" style="mso-margin-top:0;text-align:center"><span lang="AR-SA" class="font-class-Jameel-Noori-Nastaleeq">متن</span></p>',
    );
    expect(out).toBe(
      '<p class="Riwayat" dir="RTL" style="text-align:center"><span class="font-class-Jameel-Noori-Nastaleeq">متن</span></p>',
    );
  });

  it('rewrites footnote links and unwraps bare spans and o:p', () => {
    const out = cleanHtml(
      '<p><a href="file:///D:/x/y.docx#_ftn1" name="_ftnref1"><span><span>[1]</span></span></a><o:p>&nbsp;</o:p><!--[if gte mso 9]>x<![endif]--></p>',
    );
    expect(out).toBe('<p><a href="#_ftn1" name="_ftnref1">[1]</a>&nbsp;</p>');
  });

  it('drops file links with no anchor', () => {
    expect(cleanHtml('<a href="file:///C:/a.doc">x</a>')).toBe('<a>x</a>');
  });
});

describe('parseSections', () => {
  it('parses the JSON form', () => {
    expect(parseSections('[{"heading":"h","content":"<p>c</p>"}]')).toEqual([{ heading: 'h', content: '<p>c</p>' }]);
  });
  it('wraps plain HTML', () => {
    expect(parseSections('<p>x</p>')).toEqual([{ heading: '', content: '<p>x</p>' }]);
  });
});

describe('manifest', () => {
  const m = (over: Partial<ContentManifest> = {}): ContentManifest => ({
    schema_version: 1,
    built_at: '2026-11-18T03:00:00Z',
    source_latest_updated_at: null,
    content_hash: 'h',
    snapshot: { file: 'f', bytes: 1, sha256: 'new', uncompressed_bytes: 1 },
    counts: { hadith: 1, books: 1, chapters: 1, narrators: 1 },
    min_app_version: '1.0.0',
    ...over,
  });

  it('compares versions numerically', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
  });

  it('decides', () => {
    const installed = { sha256: 'old', built_at: '2026-11-01T00:00:00Z' };
    expect(decideUpdate(m(), installed, '1.0.0').action).toBe('download');
    expect(decideUpdate(m(), { ...installed, sha256: 'new' }, '1.0.0').action).toBe('none');
    expect(decideUpdate(m({ schema_version: 2 }), installed, '1.0.0').action).toBe('app-update-required');
    expect(decideUpdate(m({ min_app_version: '1.2.0' }), installed, '1.1.9').action).toBe('app-update-required');
    expect(decideUpdate(m({ built_at: '2026-10-01T00:00:00Z' }), installed, '1.0.0').action).toBe('none');
  });
});
