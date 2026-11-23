import { clearHistory } from '@tehqeqat/core';
import { Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { HadithList } from '@/components/hadith/hadith-list';
import { AppText } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { useHistory, useInvalidateUser } from '@/hooks/queries';
import { useDb, useT } from '@/providers/app-providers';

export default function HistoryScreen() {
  const { t } = useT();
  const { user } = useDb();
  const history = useHistory();
  const invalidate = useInvalidateUser();
  const hasItems = (history.data?.length ?? 0) > 0;
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            hasItems ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => void clearHistory(user).then(invalidate)}>
                <AppText color="primary">{t('history.clear')}</AppText>
              </Pressable>
            ) : null,
        }}
      />
      <HadithList
        items={history.data}
        loading={history.isPending}
        error={history.error}
        onRetry={() => void history.refetch()}
        empty={
          <EmptyState
            icon={{ ios: 'clock', android: 'history', web: 'history' }}
            title={t('history.empty')}
            hint={t('history.emptyHint')}
          />
        }
      />
    </>
  );
}
