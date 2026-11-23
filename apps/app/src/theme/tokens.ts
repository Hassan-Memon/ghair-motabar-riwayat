/**
 * The one source of visual values. No colour, size or font name appears outside this file.
 * Primary is the website's teal (oklch hue 213.8), converted to sRGB.
 */

export const palette = {
  light: {
    background: '#F6F8F9',
    surface: '#FFFFFF',
    surfaceSunken: '#EEF2F4',
    text: '#1B1F22',
    textSecondary: '#5B6670',
    textMuted: '#87929B',
    separator: '#E2E7EA',
    primary: '#00728F',
    primaryText: '#FFFFFF',
    primarySoft: '#E3F4F9',
    primarySoftText: '#005A71',
    highlight: '#FFE9A8',
    highlightText: '#1B1F22',
    danger: '#B42318',
    overlay: 'rgba(16, 24, 32, 0.45)',
  },
  dark: {
    background: '#0E1215',
    surface: '#171C20',
    surfaceSunken: '#1F262B',
    text: '#ECEFF1',
    textSecondary: '#A9B3BA',
    textMuted: '#7A858D',
    separator: '#2A3238',
    primary: '#4FC2E3',
    primaryText: '#04252F',
    primarySoft: '#123643',
    primarySoftText: '#9FE1F3',
    highlight: '#6B5310',
    highlightText: '#FFF6DA',
    danger: '#F97066',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export type ColorName = keyof (typeof palette)['light'];
export type Colors = Record<ColorName, string>;

/** Spacing rhythm: row < card < section. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Font families as registered with expo-font (see fonts.ts). */
export const fontFamily = {
  jameel: 'JameelNooriNastaleeq',
  mehr: 'MehrNastaliq',
  arabic: 'Bashar',
  arabicFallback: 'NotoNaskhArabic',
} as const;

/**
 * Nastaliq stacks its letters high and low, so it needs far more line height than Latin
 * text; too little and Android clips the top of the first line.
 */
export const lineHeightFactor = { jameel: 1.95, mehr: 1.8, arabic: 1.7, ui: 1.5 } as const;

/** Base sizes before the reader's text scale. */
export const typeScale = {
  caption: 14,
  body: 16,
  reading: 19,
  title: 20,
  headline: 24,
  display: 30,
} as const;

export const motion = { fast: 120, normal: 220 } as const;

/** One shadow level for raised surfaces on light backgrounds. */
export const elevation = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

/** Content never stretches wider than this on tablets and desktop. */
export const maxContentWidth = 760;
