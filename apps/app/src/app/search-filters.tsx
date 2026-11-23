import { router, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Chip, ScreenScroll, SectionTitle } from '@/components/ui/primitives';
import { ListSkeleton } from '@/components/ui/states';
import { setSearchFilters, useSearchFilters } from '@/features/search/filters';
import { useBooks, useChapters } from '@/hooks/queries';
import { useT } from '@/providers/app-providers';
import { space } from '@/theme/tokens';

/** Sheet: narrow search to a book and/or a chapter. */
export default function SearchFiltersScreen() {
  const { t } = useT();
  const filters = useSearchFilters();
  const books = useBooks();
  const chapters = useChapters();

  return (
    <>
      <Stack.Screen options={{ title: t('search.filters') }} />
      <ScreenScroll>
        {books.isPending || chapters.isPending ? <ListSkeleton rows={3} /> : null}
        <SectionTitle>{t('search.book')}</SectionTitle>
        <View style={styles.wrap}>
          <Chip label={t('search.allBooks')} selected={!filters.book} onPress={() => setSearchFilters({ ...filters, book: undefined })} />
          {books.data?.map((b) => (
            <Chip
              key={b.id}
              label={b.name}
              selected={filters.book === b.name}
              onPress={() => setSearchFilters({ ...filters, book: b.name })}
            />
          ))}
        </View>
        <SectionTitle>{t('search.chapter')}</SectionTitle>
        <View style={styles.wrap}>
          <Chip
            label={t('search.allChapters')}
            selected={!filters.chapter}
            onPress={() => setSearchFilters({ ...filters, chapter: undefined })}
          />
          {chapters.data?.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={filters.chapter === c.slug}
              onPress={() => setSearchFilters({ ...filters, chapter: c.slug })}
            />
          ))}
        </View>
        <Chip label={t('common.done')} selected onPress={() => router.back()} style={styles.done} />
      </ScreenScroll>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  done: { alignSelf: 'center', paddingHorizontal: space.xl },
});
