import { Host, Slider, Switch } from '@expo/ui';
import { getState, STATE_KEYS, TEXT_SCALE_MAX, TEXT_SCALE_MIN, type Language } from '@tehqeqat/core';
import Constants from 'expo-constants';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Group, ListRow, ScreenScroll, SectionTitle, Segmented, UrduText } from '@/components/ui/primitives';
import type { RefreshResult } from '@/features/content/refresh';
import { useContentInfo } from '@/hooks/queries';
import { formatDate, type MessageKey } from '@/i18n';
import { useColors, useDb, useSettings, useT } from '@/providers/app-providers';
import { space } from '@/theme/tokens';

const RESULT_MESSAGE: Record<RefreshResult, MessageKey> = {
  skipped: 'settings.upToDate',
  current: 'settings.upToDate',
  staged: 'settings.updated',
  'waiting-wifi': 'settings.waitingWifi',
  'app-update': 'settings.appUpdate',
  failed: 'settings.checkFailed',
};

export default function SettingsScreen() {
  const { t, lang } = useT();
  const { dark } = useColors();
  const { settings, update } = useSettings();
  const { supportsRefresh, checkNow, user } = useDb();
  const info = useContentInfo();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onCheck = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const r = await checkNow();
      const state = await getState(user);
      setMessage(t(RESULT_MESSAGE[r], { date: formatDate(lang, state[STATE_KEYS.installedBuiltAt] ?? null) }));
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScreenScroll>
      <SectionTitle>{t('settings.language')}</SectionTitle>
      <Segmented<'system' | Language>
        value={settings.language ?? 'system'}
        onChange={(v) => update('language', v === 'system' ? null : v)}
        options={[
          { value: 'system', label: t('settings.languageSystem') },
          { value: 'ur', label: 'اردو' },
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
        ]}
      />

      <SectionTitle>{t('settings.theme')}</SectionTitle>
      <Segmented
        value={settings.theme}
        onChange={(v) => update('theme', v)}
        options={[
          { value: 'system', label: t('settings.themeSystem') },
          { value: 'light', label: t('settings.themeLight') },
          { value: 'dark', label: t('settings.themeDark') },
        ]}
      />

      <SectionTitle>{t('settings.font')}</SectionTitle>
      <Segmented
        value={settings.urduFont}
        onChange={(v) => update('urduFont', v)}
        options={[
          { value: 'jameel', label: t('settings.fontJameel') },
          { value: 'mehr', label: t('settings.fontMehr') },
        ]}
      />

      <SectionTitle>{t('settings.textSize')}</SectionTitle>
      <Card>
        <UrduText scaled size="reading">
          {t('settings.preview')}
        </UrduText>
        <Host matchContents={{ vertical: true }} colorScheme={dark ? 'dark' : 'light'} style={styles.host}>
          <Slider
            value={settings.textScale}
            min={TEXT_SCALE_MIN}
            max={TEXT_SCALE_MAX}
            step={0.1}
            onValueChange={(v) => update('textScale', Math.round(v * 10) / 10)}
          />
        </Host>
      </Card>

      <SectionTitle>{t('settings.content')}</SectionTitle>
      <Group>
        <ListRow label={t('settings.builtAt')} detail={formatDate(lang, info.data?.builtAt ?? null)} />
        <ListRow
          label={info.data ? t('settings.counts', info.data.counts) : '—'}
          last={!supportsRefresh}
        />
        {supportsRefresh ? (
          <ListRow
            label={t('settings.allowCellular')}
            last
            trailing={
              <Host matchContents colorScheme={dark ? 'dark' : 'light'}>
                <Switch value={settings.allowCellular} onValueChange={(v) => update('allowCellular', v)} />
              </Host>
            }
          />
        ) : null}
      </Group>
      {supportsRefresh ? (
        <View style={styles.check}>
          <Button
            label={checking ? t('settings.checking') : t('settings.checkNow')}
            onPress={() => void onCheck()}
            disabled={checking}
            kind="soft"
          />
          {message ? (
            <AppText variant="caption" color="textSecondary" style={styles.center}>
              {message}
            </AppText>
          ) : null}
        </View>
      ) : (
        <AppText variant="caption" color="textMuted">
          {t('settings.notOnWeb')}
        </AppText>
      )}

      <SectionTitle>{t('settings.app')}</SectionTitle>
      <Group>
        <ListRow label={t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })} last />
      </Group>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  host: { width: '100%' },
  check: { gap: space.sm },
  center: { textAlign: 'center' },
});
