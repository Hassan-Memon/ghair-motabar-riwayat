import type { Language } from '@tehqeqat/core';
import { getLocales } from 'expo-localization';

import ar from './ar.json';
import en from './en.json';
import ur from './ur.json';

export type MessageKey = keyof typeof en;

const catalogs: Record<Language, Record<MessageKey, string>> = { ur, ar, en };

/**
 * Default interface language: Urdu, the site's language — most phones in Pakistan are set to
 * English, so following the device would show most readers an English app. A device set to
 * Arabic gets Arabic. Settings can choose any of the three.
 */
export function deviceLanguage(): Language {
  return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'ur';
}

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

const urduDigits = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
const arabicDigits = (s: string) => s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

/** Numbers the app itself shows (counts, dates) in the language's digits. Stored text is never touched. */
export function formatNumber(lang: Language, n: number | string): string {
  const s = String(n);
  return lang === 'ur' ? urduDigits(s) : lang === 'ar' ? arabicDigits(s) : s;
}

export function makeTranslate(lang: Language): Translate {
  const cat = catalogs[lang];
  return (key, params) => {
    let s = cat[key] ?? en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replaceAll(`{${k}}`, typeof v === 'number' ? formatNumber(lang, v) : v);
      }
    }
    return s;
  };
}

export function formatDate(lang: Language, iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const tag = lang === 'ur' ? 'ur-PK' : lang === 'ar' ? 'ar' : 'en-GB';
  try {
    return d.toLocaleDateString(tag, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return formatNumber(lang, d.toISOString().slice(0, 10));
  }
}

export { catalogs };
