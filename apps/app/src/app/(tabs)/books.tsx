import type { Book } from '@tehqeqat/core';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, ScreenScroll, SectionTitle, UrduText } from '@/components/ui/primitives';
import { ErrorState, ListSkeleton } from '@/components/ui/states';
import { TabHeader } from '@/components/ui/tab-header';
import { useBooks } from '@/hooks/queries';
import { useColors, useT } from '@/providers/app-providers';
import { formatNumber } from '@/i18n';
import { radius, space } from '@/theme/tokens';

export default function BooksScreen() {
  const { t } = useT();
  const { colors } = useColors();
  const books = useBooks();
  const series = books.data?.filter((b) => b.is_series) ?? [];
  const other = books.data?.filter((b) => !b.is_series) ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <TabHeader title={t('books.title')} />
      {books.isPending ? (
        <ListSkeleton />
      ) : books.error ? (
        <ErrorState onRetry={() => void books.refetch()} />
      ) : (
        <ScreenScroll>
          <SectionTitle>{t('books.series')}</SectionTitle>
          <View style={styles.grid}>
            {series.map((b) => (
              <VolumeCard key={b.id} book={b} />
            ))}
          </View>
          {other.length > 0 ? <SectionTitle>{t('books.other')}</SectionTitle> : null}
          {other.map((b) => (
            <Card key={b.id} accessibilityLabel={b.name} onPress={() => openBook(b)}>
              <UrduText>{b.name}</UrduText>
              <AppText variant="caption" color="textSecondary">
                {t('books.count', { count: b.count })}
              </AppText>
            </Card>
          ))}
        </ScreenScroll>
      )}
    </View>
  );
}

function openBook(b: Book) {
  router.push({ pathname: '/books/[book]', params: { book: b.name } });
}

/** Numbered card for a volume of the series. */
function VolumeCard({ book }: { book: Book }) {
  const { t, lang } = useT();
  const { colors } = useColors();
  return (
    <Card style={styles.volume} accessibilityLabel={book.name} onPress={() => openBook(book)}>
      <View style={[styles.number, { backgroundColor: colors.primarySoft }]}>
        <AppText variant="title" weight="bold" color="primarySoftText">
          {formatNumber(lang, book.volume_no ?? '')}
        </AppText>
      </View>
      <UrduText color="textSecondary" numberOfLines={1}>
        {/* The part's name as the book title gives it, e.g. «حصہ اول». */}
        {/\(([^)]+)\)/.exec(book.name)?.[1] ?? t('books.volume', { n: book.volume_no ?? 0 })}
      </UrduText>
      <AppText variant="caption" color="textMuted">
        {t('books.count', { count: book.count })}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  volume: { width: '30%', flexGrow: 1, alignItems: 'center', minWidth: 96 },
  number: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
