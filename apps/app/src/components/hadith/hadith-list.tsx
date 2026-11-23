import type { ReactElement } from 'react';
import { FlatList, StyleSheet } from 'react-native';

import { ErrorState, ListSkeleton } from '@/components/ui/states';
import { useChapterNames } from '@/hooks/queries';
import { useColors } from '@/providers/app-providers';
import { maxContentWidth, space } from '@/theme/tokens';

import { HadithCard, type HadithCardItem } from './hadith-card';

/** Virtualised list of narration cards with loading, error and empty states. */
export function HadithList({
  items,
  loading,
  error,
  onRetry,
  header,
  empty,
  tokens,
  query,
}: {
  items: readonly HadithCardItem[] | undefined;
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  header?: ReactElement | null;
  empty?: ReactElement | null;
  tokens?: readonly string[];
  query?: string;
}) {
  const { colors } = useColors();
  const chapters = useChapterNames();
  const names = chapters.data ?? {};
  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
      data={items ?? []}
      keyExtractor={(i) => i.slug}
      initialNumToRender={8}
      windowSize={7}
      ListHeaderComponent={header ?? undefined}
      ListEmptyComponent={
        loading ? <ListSkeleton /> : error ? <ErrorState onRetry={onRetry} /> : (empty ?? undefined)
      }
      renderItem={({ item }) => (
        <HadithCard
          item={item}
          tokens={tokens}
          query={query}
          chapterName={item.chapter ? names[item.chapter] : undefined}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    padding: space.lg,
    gap: space.md,
    paddingBottom: space.xxl * 2,
  },
});
