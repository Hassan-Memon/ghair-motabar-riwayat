import type { Chapter } from '@tehqeqat/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { HadithList } from '@/components/hadith/hadith-list';
import { AppText, Card, SectionTitle, Segmented, UrduText } from '@/components/ui/primitives';
import { ErrorState, ListSkeleton } from '@/components/ui/states';
import { TabHeader } from '@/components/ui/tab-header';
import { useChapters, useHadithList } from '@/hooks/queries';
import { useColors, useT } from '@/providers/app-providers';
import { maxContentWidth, space } from '@/theme/tokens';

export default function AllScreen() {
  const { t } = useT();
  const { colors } = useColors();
  const [view, setView] = useState<'list' | 'chapters'>('list');
  const list = useHadithList();

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <TabHeader
        title={t('all.title')}
        subtitle={list.data ? t('all.count', { count: list.data.length }) : undefined}>
        <View style={styles.segment}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: t('all.list') },
              { value: 'chapters', label: t('all.chapters') },
            ]}
          />
        </View>
      </TabHeader>
      {view === 'list' ? (
        <HadithList items={list.data} loading={list.isPending} error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <ChapterGroups />
      )}
    </View>
  );
}

/** Chapters grouped under their parent heading, with counts (the website's ابواب view). */
function ChapterGroups() {
  const { t } = useT();
  const chapters = useChapters();
  const sections = useMemo(() => {
    const groups = new Map<string, Chapter[]>();
    for (const c of chapters.data ?? []) {
      const key = c.parent ?? '';
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return [...groups].map(([title, data]) => ({ title, data }));
  }, [chapters.data]);

  if (chapters.isPending) return <ListSkeleton />;
  if (chapters.error) return <ErrorState onRetry={() => void chapters.refetch()} />;
  return (
    <SectionList
      sections={sections}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (section.title ? <SectionTitle>{section.title}</SectionTitle> : null)}
      renderItem={({ item }) => (
        <Card
          style={styles.item}
          accessibilityLabel={item.name}
          onPress={() => router.push({ pathname: '/chapters/[slug]', params: { slug: item.slug } })}>
          <View style={styles.row}>
            <UrduText style={styles.flex}>{item.name}</UrduText>
            <AppText variant="caption" color="textSecondary">
              {t('all.count', { count: item.count })}
            </AppText>
          </View>
          {item.description ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={2}>
              {item.description}
            </AppText>
          ) : null}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  segment: { marginTop: space.sm },
  content: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: space.lg, paddingBottom: space.xxl * 2 },
  item: { marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
