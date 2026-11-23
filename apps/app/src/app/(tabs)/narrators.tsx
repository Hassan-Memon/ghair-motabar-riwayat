import { normalize, type NarratorListItem } from '@tehqeqat/core';
import { router } from 'expo-router';
import { memo, useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Card, Chip, UrduText } from '@/components/ui/primitives';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { TabHeader } from '@/components/ui/tab-header';
import { useNarrators } from '@/hooks/queries';
import { formatNumber } from '@/i18n';
import { useColors, useT } from '@/providers/app-providers';
import { fontFamily, lineHeightFactor, maxContentWidth, radius, space } from '@/theme/tokens';

const firstLetter = (name: string) => normalize(name).charAt(0);

export default function NarratorsScreen() {
  const { t, lang } = useT();
  const { colors } = useColors();
  const narrators = useNarrators();
  const [filter, setFilter] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const deferred = useDeferredValue(filter);

  const letters = useMemo(() => {
    const set = new Set((narrators.data ?? []).map((n) => firstLetter(n.name)).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'ur'));
  }, [narrators.data]);

  const items = useMemo(() => {
    const q = normalize(deferred.trim());
    return (narrators.data ?? []).filter((n) => {
      if (letter && firstLetter(n.name) !== letter) return false;
      if (!q) return true;
      return normalize(n.name).includes(q) || (n.arabic_name ? normalize(n.arabic_name).includes(q) : false);
    });
  }, [narrators.data, deferred, letter]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <TabHeader title={t('narrators.title')} subtitle={narrators.data ? formatNumber(lang, narrators.data.length) : undefined}>
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder={t('narrators.filter')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('narrators.filter')}
          style={[
            styles.input,
            lang === 'en' && styles.inputLatin,
            styles.noOutline,
            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.separator },
          ]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.letters}>
          <Chip label={t('narrators.all')} selected={!letter} onPress={() => setLetter(null)} />
          {letters.map((l) => (
            <Chip key={l} label={l} selected={letter === l} onPress={() => setLetter(letter === l ? null : l)} />
          ))}
        </ScrollView>
      </TabHeader>
      {narrators.isPending ? (
        <ListSkeleton />
      ) : narrators.error ? (
        <ErrorState onRetry={() => void narrators.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.slug}
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          initialNumToRender={10}
          renderItem={({ item }) => <NarratorCard n={item} />}
          ListEmptyComponent={
            <EmptyState icon={{ ios: 'person.crop.circle.badge.questionmark', android: 'person_search', web: 'person_search' }} title={t('search.noResults', { query: filter })} />
          }
        />
      )}
    </View>
  );
}

const NarratorCard = memo(function NarratorCard({ n }: { n: NarratorListItem }) {
  const { t } = useT();
  return (
    <Card accessibilityLabel={n.name} onPress={() => router.push({ pathname: '/narrators/[slug]', params: { slug: n.slug } })}>
      <UrduText>{n.name}</UrduText>
      {n.arabic_name ? (
        <AppText variant="caption" color="textSecondary" style={{ fontFamily: fontFamily.arabic }}>
          {n.arabic_name}
        </AppText>
      ) : null}
      <View style={styles.meta}>
        {n.death_note ? (
          <AppText variant="caption" color="textMuted">
            {n.death_note}
          </AppText>
        ) : null}
        <AppText variant="caption" color="textMuted">
          {t('narrators.studies', { count: n.study_count })}
        </AppText>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  input: {
    marginTop: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontFamily: fontFamily.mehr,
    fontSize: 17,
    lineHeight: 17 * lineHeightFactor.mehr,
    writingDirection: 'rtl',
  },
  inputLatin: { fontFamily: undefined, lineHeight: undefined },
  // The field's own border shows focus; the browser outline would draw a second box inside it.
  noOutline: Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  letters: { gap: space.xs, paddingVertical: space.sm },
  content: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 },
  meta: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
});
