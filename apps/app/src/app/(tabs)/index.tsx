import { addRecentSearch, clearRecentSearches } from '@tehqeqat/core';
import { router } from 'expo-router';
import { useDeferredValue, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { HadithList } from '@/components/hadith/hadith-list';
import { AppText, Card, Chip, Icon, IconButton, SectionTitle } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { TabHeader } from '@/components/ui/tab-header';
import { setSearchFilters, useSearchFilters } from '@/features/search/filters';
import {
  useAnnouncements,
  useChapterNames,
  useContentInfo,
  useInvalidateUser,
  useNarratorSearch,
  useRecentSearches,
  useSearch,
} from '@/hooks/queries';
import { useColors, useDb, useT } from '@/providers/app-providers';
import { formatDate } from '@/i18n';
import { fontFamily, lineHeightFactor, radius, space } from '@/theme/tokens';

// The website's example queries.
const EXAMPLES = ['نماز', 'روزہ', 'درود', 'جمعہ'];

export default function SearchScreen() {
  const { t, lang } = useT();
  const { colors } = useColors();
  const { user, justUpdated, dismissUpdated } = useDb();
  const [text, setText] = useState('');
  const query = useDeferredValue(text);
  const filters = useSearchFilters();
  const search = useSearch(query, filters);
  const narrators = useNarratorSearch(query);
  const info = useContentInfo();
  const recent = useRecentSearches();
  const announcements = useAnnouncements();
  const chapterNames = useChapterNames();
  const invalidateUser = useInvalidateUser();
  const active = query.trim().length > 0;

  // Remember a query once the reader pauses on it.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = setTimeout(() => {
      void addRecentSearch(user, q).then(invalidateUser);
    }, 1500);
    return () => clearTimeout(id);
  }, [query, user, invalidateUser]);

  const filterLabel = [filters.book, filters.chapter ? chapterNames.data?.[filters.chapter] : null]
    .filter(Boolean)
    .join(' · ');

  const header = (
    <View style={styles.headerStack}>
      {active ? (
        <>
          <View style={styles.filterRow}>
            <Chip
              label={filterLabel || t('search.filters')}
              selected={!!filterLabel}
              onPress={() => router.push('/search-filters')}
            />
            {filterLabel ? <Chip label={t('search.clearFilters')} onPress={() => setSearchFilters({})} /> : null}
          </View>
          {narrators.data && narrators.data.length > 0 ? (
            <View style={styles.filterRow}>
              {narrators.data.map((n) => (
                <Chip
                  key={n.slug}
                  label={n.name}
                  onPress={() => router.push({ pathname: '/narrators/[slug]', params: { slug: n.slug } })}
                />
              ))}
            </View>
          ) : null}
          {search.data && search.data.total > 0 ? (
            <AppText variant="caption" color="textSecondary">
              {search.data.level === 3 ? t('search.closeMatches') : t('search.results', { count: search.data.total })}
            </AppText>
          ) : null}
        </>
      ) : (
        <>
          {justUpdated ? (
            <Card style={{ backgroundColor: colors.primarySoft }}>
              <AppText color="primarySoftText">{t('common.updatedBanner', { date: formatDate(lang, justUpdated) })}</AppText>
              <Pressable onPress={dismissUpdated} accessibilityRole="button">
                <AppText color="primary" weight="bold">
                  {t('common.dismiss')}
                </AppText>
              </Pressable>
            </Card>
          ) : null}
          <SectionTitle>{t('search.examples')}</SectionTitle>
          <View style={styles.filterRow}>
            {EXAMPLES.map((e) => (
              <Chip key={e} label={e} onPress={() => setText(e)} />
            ))}
          </View>
          {recent.data && recent.data.length > 0 ? (
            <>
              <SectionTitle
                action={
                  <Pressable
                    onPress={() => void clearRecentSearches(user).then(invalidateUser)}
                    accessibilityRole="button"
                    hitSlop={8}>
                    <AppText variant="caption" color="primary">
                      {t('search.clearRecent')}
                    </AppText>
                  </Pressable>
                }>
                {t('search.recent')}
              </SectionTitle>
              <View style={styles.filterRow}>
                {recent.data.map((r) => (
                  <Chip key={r} label={r} onPress={() => setText(r)} />
                ))}
              </View>
            </>
          ) : null}
          {announcements.data?.map((a) => (
            <Card key={a.id} style={styles.announcement}>
              <Icon name={{ ios: 'megaphone', android: 'campaign', web: 'campaign' }} size={18} color="primary" />
              <AppText variant="caption" color="textSecondary" style={styles.flex}>
                {a.text}
              </AppText>
            </Card>
          ))}
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <TabHeader
        title={t('search.title')}
        subtitle={info.data ? t('search.offline', { count: info.data.counts.hadith }) : undefined}>
        <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
          <Icon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} color="textMuted" />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={t('search.placeholder')}
            onSubmitEditing={() => void addRecentSearch(user, text).then(invalidateUser)}
            style={[styles.input, lang === 'en' && styles.inputLatin, styles.noOutline, { color: colors.text }]}
          />
          {text ? (
            <IconButton
              icon={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
              label={t('common.close')}
              color="textMuted"
              onPress={() => setText('')}
            />
          ) : null}
        </View>
      </TabHeader>
      <HadithList
        items={active ? search.data?.hits : []}
        loading={active && search.isPending}
        error={search.error}
        onRetry={() => void search.refetch()}
        tokens={search.data?.tokens}
        query={active ? query.trim() : undefined}
        header={header}
        empty={
          active ? (
            <EmptyState
              icon={{ ios: 'text.magnifyingglass', android: 'search_off', web: 'search_off' }}
              title={t('search.noResults', { query: query.trim() })}
              hint={t('search.noResultsHint')}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerStack: { gap: space.md, marginBottom: space.xs },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    marginTop: space.sm,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.mehr,
    fontSize: 18,
    lineHeight: 18 * lineHeightFactor.mehr,
    paddingVertical: space.sm,
    writingDirection: 'rtl',
  },
  // Mehr has no Latin glyphs: an English placeholder in it loses its spaces.
  inputLatin: { fontFamily: undefined, lineHeight: undefined },
  // The field's own border shows focus; the browser outline would draw a second box inside it.
  noOutline: Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  announcement: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
