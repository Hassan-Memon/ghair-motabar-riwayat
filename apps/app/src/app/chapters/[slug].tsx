import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HadithList } from '@/components/hadith/hadith-list';
import { AppText, UrduText } from '@/components/ui/primitives';
import { useChapter, useHadithList } from '@/hooks/queries';
import { useT } from '@/providers/app-providers';
import { space } from '@/theme/tokens';

export default function ChapterScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useT();
  const chapter = useChapter(slug);
  const list = useHadithList({ chapter: slug });

  return (
    <>
      <Stack.Screen options={{ title: chapter.data?.parent ?? t('all.chapters') }} />
      <HadithList
        items={list.data}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        header={
          chapter.data ? (
            <View style={styles.header}>
              <UrduText size="title">{chapter.data.name}</UrduText>
              {chapter.data.description ? (
                <AppText color="textSecondary">{chapter.data.description}</AppText>
              ) : null}
              <AppText variant="caption" color="textMuted">
                {t('all.count', { count: chapter.data.count })}
              </AppText>
            </View>
          ) : null
        }
      />
    </>
  );
}

const styles = StyleSheet.create({ header: { gap: space.sm, marginBottom: space.sm } });
