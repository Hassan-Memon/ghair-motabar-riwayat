import {
  DEFAULT_SETTINGS,
  getSettings,
  getState,
  setSetting,
  setState,
  STATE_KEYS,
  type DbAdapter,
  type Language,
  type Settings,
} from '@tehqeqat/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { applyStagedContent, openDatabases, supportsContentRefresh, type Databases } from '@/db/databases';
import { registerContentTask } from '@/features/content/backgroundTask';
import { refreshContent, type RefreshResult } from '@/features/content/refresh';
import { deviceLanguage, makeTranslate, type Translate } from '@/i18n';
import { palette, type Colors } from '@/theme/tokens';

// ── databases ────────────────────────────────────────────────────────────────

interface DbContextValue {
  content: DbAdapter;
  user: DbAdapter;
  /** Bumps when a new content snapshot is swapped in; part of every content query key. */
  generation: number;
  supportsRefresh: boolean;
  checkNow(): Promise<RefreshResult>;
  /** Built-at date of a snapshot installed since the user last dismissed the banner. */
  justUpdated: string | null;
  dismissUpdated(): void;
}

const DbContext = createContext<DbContextValue | null>(null);

export function useDb(): DbContextValue {
  const v = use(DbContext);
  if (!v) throw new Error('useDb outside AppProviders');
  return v;
}

// ── settings, language, theme ────────────────────────────────────────────────

interface SettingsContextValue {
  settings: Settings;
  update<K extends keyof Settings>(key: K, value: Settings[K]): void;
}

const SettingsContext = createContext<SettingsContextValue>({ settings: DEFAULT_SETTINGS, update: () => {} });

export function useSettings() {
  return use(SettingsContext);
}

export function useT(): { t: Translate; lang: Language } {
  const { settings } = useSettings();
  const lang = settings.language ?? deviceLanguage();
  return useMemo(() => ({ t: makeTranslate(lang), lang }), [lang]);
}

export function useColors(): { colors: Colors; dark: boolean } {
  const { settings } = useSettings();
  const system = useColorScheme();
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && system === 'dark');
  return { colors: dark ? palette.dark : palette.light, dark };
}

// ── provider ─────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, gcTime: 10 * 60 * 1000, retry: 1 } },
});

type Phase = { state: 'loading' } | { state: 'error'; error: Error } | { state: 'ready'; dbs: Databases };

export function AppProviders({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: (p: { error: Error | null; retry: () => void }) => ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [generation, setGeneration] = useState(0);
  const [justUpdated, setJustUpdated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    openDatabases()
      .then(async (dbs) => {
        const [s, state] = await Promise.all([getSettings(dbs.user), getState(dbs.user)]);
        if (cancelled) return;
        setSettings(s);
        setJustUpdated(state[STATE_KEYS.justUpdated] ?? null);
        setPhase({ state: 'ready', dbs });
      })
      .catch((error: unknown) => {
        if (!cancelled) setPhase({ state: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const dbs = phase.state === 'ready' ? phase.dbs : null;

  const runRefresh = useCallback(async (trigger: 'launch' | 'manual'): Promise<RefreshResult> => {
    if (!dbs || !supportsContentRefresh) return 'skipped';
    const result = await refreshContent(dbs.user, trigger);
    if (result === 'staged') {
      try {
        await applyStagedContent(dbs);
        const state = await getState(dbs.user);
        setJustUpdated(state[STATE_KEYS.justUpdated] ?? null);
        setGeneration((g) => g + 1);
        await queryClient.invalidateQueries();
      } catch {
        // the staged file is applied on the next launch instead
      }
    }
    return result;
  }, [dbs]);

  // Launch check (at most once a day, see core/sync) and the background task.
  useEffect(() => {
    if (!dbs) return;
    // After the first screen has painted: reading comes first, the network second.
    const id = setTimeout(() => {
      void runRefresh('launch');
      void registerContentTask();
    }, 2000);
    return () => clearTimeout(id);
  }, [dbs, runRefresh]);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    if (dbs) void setSetting(dbs.user, key, value);
  }, [dbs]);

  const dismissUpdated = useCallback(() => {
    setJustUpdated(null);
    if (dbs) void setState(dbs.user, { [STATE_KEYS.justUpdated]: null });
  }, [dbs]);

  const settingsValue = useMemo(() => ({ settings, update }), [settings, update]);
  const dbValue = useMemo<DbContextValue | null>(
    () =>
      dbs
        ? {
            content: dbs.content,
            user: dbs.user,
            generation,
            supportsRefresh: supportsContentRefresh,
            checkNow: () => runRefresh('manual'),
            justUpdated,
            dismissUpdated,
          }
        : null,
    // dbs.content is replaced in place on a swap, which bumps generation.
    [dbs, generation, justUpdated, runRefresh, dismissUpdated],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsContext value={settingsValue}>
        {dbValue ? (
          <DbContext value={dbValue}>{children}</DbContext>
        ) : (
          fallback({
            error: phase.state === 'error' ? phase.error : null,
            retry: () => {
              setPhase({ state: 'loading' });
              setAttempt((a) => a + 1);
            },
          })
        )}
      </SettingsContext>
    </QueryClientProvider>
  );
}
