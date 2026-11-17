/**
 * The research text is Word-exported HTML. These helpers work with regular expressions
 * (no DOM), so they run the same in Node, React Native and the desktop WebView.
 */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  zwnj: '\u200c',
  zwj: '\u200d',
  lrm: '\u200e',
  rlm: '\u200f',
  shy: '',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Plain text of an HTML fragment: block ends become newlines, runs of blank lines collapse. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  const text = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Shrink Word HTML without changing what is shown:
 *  - drop comments (including Word's conditional comments) and `<o:p>` wrappers
 *  - point footnote links at their anchor (`file:///D:/…#_ftn1` → `#_ftn1`); drop other file: links
 *  - drop `Mso*` classes, `lang` attributes and `mso-*` style declarations
 *  - unwrap `<span>` elements left with no attributes
 * Font classes (`font-class-*`), the site's own classes and `dir` are kept.
 */
export function cleanHtml(html: string | null | undefined): string {
  if (!html) return '';
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[if [^\]]*\]>|<!\[endif\]>/gi, '')
    .replace(/<\/?o:p>/gi, '')
    .replace(/\shref="file:[^"#]*#([^"]*)"/gi, ' href="#$1"')
    .replace(/\shref="file:[^"]*"/gi, '')
    .replace(/\slang="[^"]*"/gi, '');

  s = s.replace(/\sclass="([^"]*)"/gi, (_m, cls: string) => {
    const kept = cls.split(/\s+/).filter((c) => c && !/^Mso/i.test(c));
    return kept.length ? ` class="${kept.join(' ')}"` : '';
  });

  s = s.replace(/\sstyle="([^"]*)"/gi, (_m, style: string) => {
    const kept = style
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d && !/^mso-/i.test(d));
    return kept.length ? ` style="${kept.join(';')}"` : '';
  });

  // Unwrap attribute-less spans, innermost first, until nothing changes.
  for (let i = 0; i < 20; i++) {
    const next = s.replace(/<span>((?:(?!<\/?span\b)[\s\S])*)<\/span>/gi, '$1');
    if (next === s) break;
    s = next;
  }
  return s.replace(/[ \t]{2,}/g, ' ');
}

export interface Section {
  heading: string;
  content: string;
}

/** `html_content` on the API is a JSON string of `[{heading, content}]`; older rows are plain HTML. */
export function parseSections(htmlContent: string | null | undefined): Section[] {
  if (!htmlContent) return [];
  const t = htmlContent.trim();
  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t) as unknown;
      if (Array.isArray(arr)) {
        return arr.map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return {
            heading: typeof o.heading === 'string' ? o.heading : '',
            content: typeof o.content === 'string' ? o.content : '',
          };
        });
      }
    } catch {
      // fall through: treat as plain HTML
    }
  }
  return [{ heading: '', content: htmlContent }];
}
