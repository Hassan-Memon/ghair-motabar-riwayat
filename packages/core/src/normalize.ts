/**
 * Urdu/Arabic search normaliser. The same function runs on the stored text (when the
 * snapshot is built) and on what the reader types, so spelling variants meet in the middle.
 *
 * Rules, in order, applied per code point:
 *  1. NFKC (presentation forms → base letters, ﷺ → its words).
 *  2. Drop harakat, Quranic marks, tatweel, zero-width and bidi control characters.
 *  3. Fold letter variants: ك→ک, ي/ى/ئ→ی, ۓ→ے, ؤ→و, أ/إ/آ/ٱ→ا, ه/ة/ۃ/ۂ/ۀ→ہ.
 *  4. Fold Arabic-Indic and Urdu digits to ASCII.
 *  5. Lowercase; any run of whitespace becomes one space; trim.
 *
 * Working per code point (not on the whole string) is safe because every composed form
 * NFKC could build across two code points (آ, ئ, ۂ, …) folds to the same base letter as its
 * parts once marks are dropped. It also lets `normalizeWithMap` point every output
 * character back at the original text, so highlights land on the real Nastaliq text.
 */

const DROP = new Set<number>();
const addRange = (a: number, b: number) => {
  for (let c = a; c <= b; c++) DROP.add(c);
};
addRange(0x0610, 0x061a); // Arabic signs above/below
addRange(0x064b, 0x065f); // harakat, hamza above/below
DROP.add(0x0670); // superscript alef
addRange(0x06d6, 0x06dc); // Quranic annotation
addRange(0x06df, 0x06e4);
addRange(0x06e7, 0x06e8);
addRange(0x06ea, 0x06ed);
DROP.add(0x0640); // tatweel
addRange(0x200b, 0x200f); // zero-width, LRM, RLM
addRange(0x202a, 0x202e); // bidi embedding
addRange(0x2066, 0x2069); // bidi isolates
DROP.add(0x061c); // Arabic letter mark
DROP.add(0xfeff); // BOM

const FOLD: Record<string, string> = {
  'ك': 'ک',
  'ي': 'ی',
  'ى': 'ی',
  'ئ': 'ی',
  'ۓ': 'ے',
  'ؤ': 'و',
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ٱ': 'ا',
  'ه': 'ہ',
  'ة': 'ہ',
  'ۃ': 'ہ',
  'ۂ': 'ہ',
  'ۀ': 'ہ',
};

function foldChar(ch: string): string {
  const cp = ch.codePointAt(0)!;
  if (DROP.has(cp)) return '';
  if (cp >= 0x0660 && cp <= 0x0669) return String(cp - 0x0660);
  if (cp >= 0x06f0 && cp <= 0x06f9) return String(cp - 0x06f0);
  const f = FOLD[ch];
  if (f !== undefined) return f;
  if (/\s/u.test(ch)) return ' ';
  return ch.toLowerCase();
}

export interface NormalizedWithMap {
  /** The normalised text. */
  text: string;
  /** `map[i]` is the UTF-16 index in the original string of `text[i]`. Length is `text.length + 1`; the last entry is the original length. */
  map: number[];
}

export function normalizeWithMap(input: string): NormalizedWithMap {
  let text = '';
  const map: number[] = [];
  let lastWasSpace = true; // trims leading space
  let i = 0;
  for (const cp of input) {
    const pieces = cp.normalize('NFKC');
    for (const p of pieces) {
      const out = foldChar(p);
      for (const o of out) {
        if (o === ' ') {
          if (lastWasSpace) continue;
          lastWasSpace = true;
        } else {
          lastWasSpace = false;
        }
        for (let k = 0; k < o.length; k++) {
          text += o[k];
          map.push(i);
        }
      }
    }
    i += cp.length;
  }
  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    map.pop();
  }
  map.push(input.length);
  return { text, map };
}

export function normalize(input: string): string {
  return normalizeWithMap(input).text;
}

/** Split normalised text into search tokens: runs of letters, numbers and joined marks. */
export function tokenize(input: string): string[] {
  return normalize(input)
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter((t) => t.length > 0);
}
