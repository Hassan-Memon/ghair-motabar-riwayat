import * as Font from 'expo-font';
import { useEffect, useSyncExternalStore } from 'react';

import { fontFamily } from './tokens';

/** Small faces needed for the first paint. */
export const startupFonts = {
  [fontFamily.mehr]: require('@/assets/fonts/MehrNastaliq.ttf'),
  [fontFamily.arabic]: require('@/assets/fonts/Bashar.ttf'),
  [fontFamily.arabicFallback]: require('@/assets/fonts/NotoNaskhArabic.ttf'),
};

/*
 * Jameel Noori is 10 MB (ligature glyphs; it cannot be subset). It loads after the first paint,
 * and text reads in Mehr until it is ready — the website does the same.
 */
let jameelReady = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function loadJameel() {
  loading ??= Font.loadAsync({ [fontFamily.jameel]: require('@/assets/fonts/JameelNooriNastaleeq.ttf') })
    .then(() => {
      jameelReady = true;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      loading = null; // stay on Mehr
    });
  return loading;
}

export function useJameelReady(wanted: boolean): boolean {
  useEffect(() => {
    if (wanted) void loadJameel();
  }, [wanted]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => jameelReady,
    () => jameelReady,
  );
}
