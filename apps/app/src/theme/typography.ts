import type { Script } from '@tehqeqat/core';
import { useMemo } from 'react';
import type { TextStyle } from 'react-native';

import { useJameelReady } from './fonts';
import { fontFamily, lineHeightFactor, typeScale } from './tokens';
import { useSettings, useT } from '@/providers/app-providers';

export type TypeVariant = keyof typeof typeScale;

/**
 * Font and line height per script, for the reader's chosen Urdu face and text scale.
 * `reading` text follows the scale; interface text uses a fixed size.
 */
export function useTypography() {
  const { settings } = useSettings();
  const { lang } = useT();
  const jameel = useJameelReady(settings.urduFont === 'jameel');
  const urdu = settings.urduFont === 'jameel' && jameel ? 'jameel' : 'mehr';

  return useMemo(() => {
    const scaled = (v: TypeVariant) => typeScale[v] * settings.textScale;

    /** Style for a run of content text in a script. */
    const script = (s: Script, size: number): TextStyle => {
      if (s === 'arabic') {
        return { fontFamily: fontFamily.arabic, fontSize: size * 1.05, lineHeight: size * 1.05 * lineHeightFactor.arabic };
      }
      if (s === 'latin') return { fontSize: size * 0.85 };
      return {
        fontFamily: fontFamily[urdu],
        fontSize: size,
        lineHeight: size * lineHeightFactor[urdu],
      };
    };

    /** Interface text in the interface language. */
    const ui = (v: TypeVariant): TextStyle => {
      const size = typeScale[v];
      if (lang === 'en') return { fontSize: size, lineHeight: size * lineHeightFactor.ui };
      if (lang === 'ar') {
        return { fontFamily: fontFamily.arabicFallback, fontSize: size, lineHeight: size * lineHeightFactor.arabic };
      }
      // Mehr is the lighter Nastaliq face and reads well at interface sizes.
      return { fontFamily: fontFamily.mehr, fontSize: size, lineHeight: size * lineHeightFactor.mehr };
    };

    return { urdu, scaled, script, ui, textScale: settings.textScale };
  }, [urdu, settings.textScale, lang]);
}
