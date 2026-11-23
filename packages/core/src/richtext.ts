import { decodeEntities } from './html';

/**
 * Word HTML → blocks of styled runs, for native <Text> rendering (no DOM, no WebView).
 *
 * The research was typed in Word. Honorifics and circled numbers there are ordinary letters set
 * in a symbol font (ARBO): "l" draws «رحمہ اللہ», "1" draws ①. The font does not travel to the
 * app, so — as the website does for copying and screen readers — the letters are written out:
 * honorifics as their words, circled numbers as the Unicode circled digits. Nothing else in the
 * text is changed.
 */

export type Script = 'urdu' | 'arabic' | 'latin';

export interface Run {
  text: string;
  script: Script;
  bold?: true;
  italic?: true;
  underline?: true;
  sup?: true;
  /** `#_ftn1`: a footnote mark pointing at a reference; `#_ftnref1`: a reference pointing back. */
  href?: string;
}

export interface Block {
  runs: Run[];
  /** Anchor names in this block (`_ftn1` on a reference paragraph). */
  anchors: string[];
  /** Word's heading style (`RighHadding`) or an <h*> tag. */
  heading?: true;
}

// ARBO-DT honorifics, as read from the font's glyphs (same table as the website).
export const HONORIFICS: Readonly<Record<string, string>> = {
  l: 'رحمہ اللہ',
  r: 'رضی اللہ عنہ',
  R: 'رضی اللہ عنہا',
  q: 'رضی اللہ عنہما',
  p: 'رضی اللہ عنہم',
  e: 'علیہ السلام',
  E: 'علیہ الصلاۃ والسلام',
  f: 'علیہم السلام',
  s: 'ﷺ',
  a: 'ﷺ',
  b: 'رضی اللہ عنہ',
  n: 'رحمہم اللہ',
  m: 'رحمہما اللہ',
};

// ARBO-UW circled numbers: keys 1-0 are ①-⑩, the shifted keys continue the count.
const CIRCLED_KEYS = '1234567890!@#$%^&*()qwertyui';
const CIRCLED_VALUES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 19, 21, 22, 23, 24, 25, 26, 27, 28,
];
const circled = (n: number): string =>
  n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : String.fromCodePoint(0x3251 + n - 21);
export const CIRCLED_NUMBERS: Readonly<Record<string, string>> = Object.fromEntries(
  [...CIRCLED_KEYS].map((k, i) => [k, circled(CIRCLED_VALUES[i]!)]),
);

const HONORIFIC_CLASS = /font-class-ARBO-DT/;
const NUMBER_CLASS = /font-class-(?:ARBO-U[WB]|ARBO-AB|Arbo-1|Arbo-Number-nasir)/;
const ORNAMENT_CLASS = /font-class-(?:\d-)?(?:ARBO|Arbo)/;
const ARABIC_CLASS =
  /font-class-(?:Bashar|BasharBold|Traditional-Arabic|KFGQPC|Uthman|Arabic-Typesetting|Simplified-Arabic|Sakkal-Majalla|Lotus-Linotype|mylotus|AL-Bsher|AA-Sameer)|(?:^|\s)Arbic(?:\s|$)/;
const URDU_CLASS = /font-class-(?:Jameel|Alvi|Faiz|Gulzar|AppleExternalUIFontNastaliq)|my-font-class/;
const LATIN_CLASS = /font-class-(?:H0|Times-New-Roman|Segoe-UI|Tahoma|Arial|Roboto)/;

type Symbol = 'honorific' | 'number' | 'ornament';

function symbolOf(cls: string, tag: string): Symbol | null {
  if (HONORIFIC_CLASS.test(cls)) return 'honorific';
  if (tag !== 'span') return null; // `Arbo-1` on a paragraph is only its Word style
  if (NUMBER_CLASS.test(cls)) return 'number';
  if (ORNAMENT_CLASS.test(cls)) return 'ornament';
  return null;
}

function scriptOf(cls: string): Script | null {
  if (ARABIC_CLASS.test(cls)) return 'arabic';
  if (URDU_CLASS.test(cls)) return 'urdu';
  if (LATIN_CLASS.test(cls)) return 'latin';
  return null;
}

/** The words for a run of symbol-font letters, or '' for decoration with no text. */
export function spellSymbols(kind: Symbol, text: string): string {
  if (kind === 'honorific') {
    return [...text].map((c) => HONORIFICS[c] ?? '').filter(Boolean).join(' ');
  }
  if (kind === 'number') return [...text].map((c) => CIRCLED_NUMBERS[c] ?? '').join('');
  return '';
}

interface Frame {
  tag: string;
  script?: Script;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  sup?: boolean;
  href?: string;
  symbol?: Symbol;
}

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'blockquote']);
const VOID_TAGS = new Set(['br', 'img', 'hr', 'meta', 'link', 'input', 'col', 'wbr']);
const TOKEN = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9:]*)((?:\s+[^\s=>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|[^<]+|</g;

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? '') : undefined;
}

export function parseRichText(html: string | null | undefined, baseScript: Script = 'urdu'): Block[] {
  if (!html) return [];
  const blocks: Block[] = [];
  let current: Block = { runs: [], anchors: [] };
  const stack: Frame[] = [{ tag: '#root', script: baseScript }];
  let symbolText: { kind: Symbol; text: string; depth: number } | null = null;

  const top = (): Frame & { script: Script } => {
    const f: Frame & { script: Script } = { tag: '', script: baseScript };
    for (const s of stack) {
      if (s.script) f.script = s.script;
      if (s.bold) f.bold = true;
      if (s.italic) f.italic = true;
      if (s.underline) f.underline = true;
      if (s.sup) f.sup = true;
      if (s.href) f.href = s.href;
    }
    return f;
  };

  const push = (text: string, override?: Script) => {
    if (!text) return;
    const f = top();
    const run: Run = { text, script: override ?? f.script };
    if (f.bold) run.bold = true;
    if (f.italic) run.italic = true;
    if (f.underline) run.underline = true;
    if (f.sup) run.sup = true;
    if (f.href) run.href = f.href;
    const prev = current.runs[current.runs.length - 1];
    if (
      prev &&
      prev.script === run.script &&
      prev.bold === run.bold &&
      prev.italic === run.italic &&
      prev.underline === run.underline &&
      prev.sup === run.sup &&
      prev.href === run.href
    ) {
      prev.text += text;
    } else {
      current.runs.push(run);
    }
  };

  const endBlock = () => {
    // Trim whitespace at the edges of the block; Word leaves newlines inside paragraphs.
    const runs = current.runs;
    if (runs.length) {
      runs[0]!.text = runs[0]!.text.replace(/^\s+/, '');
      const last = runs[runs.length - 1]!;
      last.text = last.text.replace(/\s+$/, '');
    }
    current.runs = runs.filter((r) => r.text.length > 0);
    if (current.runs.length > 0 || current.anchors.length > 0) blocks.push(current);
    current = { runs: [], anchors: [] };
  };

  for (const m of html.matchAll(TOKEN)) {
    const tok = m[0];
    if (tok.startsWith('<!--')) continue;
    const tagName = m[1]?.toLowerCase();
    if (!tagName) {
      const text = decodeEntities(tok === '<' ? '<' : tok)
        .replace(/ /g, ' ')
        .replace(/[ \t\r\n]+/g, ' ');
      if (symbolText) symbolText.text += text;
      else push(text);
      continue;
    }
    const closing = tok.startsWith('</');
    if (tagName === 'br') {
      if (!symbolText) push('\n');
      continue;
    }
    if (closing) {
      // Pop to the matching tag (Word HTML is mostly well-formed; tolerate strays).
      let i = stack.length - 1;
      while (i > 0 && stack[i]!.tag !== tagName) i--;
      if (i === 0) continue;
      if (symbolText && i <= symbolText.depth) {
        const words = spellSymbols(symbolText.kind, symbolText.text.trim());
        symbolText = null;
        stack.length = i;
        if (words) push(` ${words} `, 'urdu');
        if (BLOCK_TAGS.has(tagName)) endBlock();
        continue;
      }
      stack.length = i;
      if (BLOCK_TAGS.has(tagName)) endBlock();
      continue;
    }
    if (VOID_TAGS.has(tagName)) continue;
    const attrs = m[2] ?? '';
    if (BLOCK_TAGS.has(tagName) && !symbolText) {
      endBlock();
    }
    const cls = attr(attrs, 'class') ?? '';
    const frame: Frame = { tag: tagName };
    const sc = scriptOf(cls);
    if (sc) frame.script = sc;
    if (tagName === 'b' || tagName === 'strong' || /BasharBold/.test(cls)) frame.bold = true;
    if (tagName === 'i' || tagName === 'em') frame.italic = true;
    if (tagName === 'u' || tagName === 'ins') frame.underline = true;
    if (tagName === 'sup') frame.sup = true;
    if (/^h[1-6]$/.test(tagName) || /RighHadding/.test(cls)) current.heading = true;
    if (tagName === 'a') {
      const href = attr(attrs, 'href');
      if (href && /^(#|https?:)/.test(href)) frame.href = href;
      const name = attr(attrs, 'name') ?? attr(attrs, 'id');
      if (name) current.anchors.push(name);
    }
    if (!symbolText) {
      const sym = symbolOf(cls, tagName);
      if (sym) symbolText = { kind: sym, text: '', depth: stack.length };
    }
    stack.push(frame);
  }
  endBlock();
  // Collapse spaces left where a symbol was spelled next to existing spaces.
  for (const b of blocks) {
    for (const r of b.runs) r.text = r.text.replace(/ {2,}/g, ' ');
  }
  return blocks;
}

/** One-line display text of a small fragment (a title or a حکم), with honorifics written out. */
export function richTextToPlain(html: string | null | undefined): string {
  return parseRichText(html)
    .map((b) => b.runs.map((r) => r.text).join(''))
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

/** Footnote id from a mark's href: `#_ftn3` → `_ftn3`. Null for links that are not footnotes. */
export function footnoteTarget(href: string | undefined): string | null {
  const m = href ? /^#(_ftn\d+)$/.exec(href) : null;
  return m ? m[1]! : null;
}

/** The reference blocks for one footnote id, from parsed references. */
export function findFootnote(references: readonly Block[], id: string): Block[] {
  const start = references.findIndex((b) => b.anchors.includes(id));
  if (start < 0) return [];
  const out = [references[start]!];
  // A long reference can run over several paragraphs until the next footnote anchor.
  for (let i = start + 1; i < references.length; i++) {
    const b = references[i]!;
    if (b.anchors.some((a) => /^_ftn\d+$/.test(a))) break;
    out.push(b);
  }
  return out;
}
