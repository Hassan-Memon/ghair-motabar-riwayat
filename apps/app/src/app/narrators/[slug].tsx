import { narratorWebUrl } from '@tehqeqat/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { openExternal } from '@/lib/open-external';
import { Accordion } from '@/components/hadith/accordion';
import { HadithCard } from '@/components/hadith/hadith-card';
import { RichText } from '@/components/hadith/rich-text';
import { AppText, Button, Card, Chip, ScreenScroll, SectionTitle, UrduText } from '@/components/ui/primitives';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { useHadithList, useNarrator } from '@/hooks/queries';
import { useT } from '@/providers/app-providers';
import { fontFamily, space } from '@/theme/tokens';

export default function NarratorScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useT();
  const narrator = useNarrator(slug);
  const narrations = useHadithList({ narrator: slug });
  const n = narrator.data;
  const onFootnote = (id: string, label: string) =>
    router.push({ pathname: '/footnote', params: { slug, id, label, kind: 'narrator' } });

  return (
    <>
      <Stack.Screen options={{ title: t('narrators.title') }} />
      {narrator.isPending ? (
        <ListSkeleton rows={3} />
      ) : narrator.error ? (
        <ErrorState onRetry={() => void narrator.refetch()} />
      ) : !n ? (
        <EmptyState icon={{ ios: 'person.crop.circle.badge.questionmark', android: 'person_search', web: 'person_search' }} title={t('common.notFound')} />
      ) : (
        <ScreenScroll>
          <Card>
            <UrduText size="headline">{n.name}</UrduText>
            {n.arabic_name ? (
              <AppText style={{ fontFamily: fontFamily.arabic }} variant="title" color="textSecondary">
                {n.arabic_name}
              </AppText>
            ) : null}
            {n.death_note ? (
              <AppText color="textSecondary">
                {t('narrators.died')}: {n.death_note}
              </AppText>
            ) : null}
            <AppText variant="caption" color="textMuted">
              {t('narrators.studies', { count: n.study_count })}
            </AppText>
          </Card>

          {n.studyBlocks.length > 0 ? (
            <>
              <SectionTitle>{t('narrators.study')}</SectionTitle>
              {n.studyBlocks.map((s, i) => (
                <Accordion
                  key={i}
                  urduTitle={s.heading || undefined}
                  title={s.heading ? undefined : t('hadith.section', { n: i + 1 })}
                  initiallyOpen={i === 0}>
                  <RichText blocks={s.blocks} onFootnote={onFootnote} />
                </Accordion>
              ))}
              {n.referenceBlocks.length > 0 ? (
                <Accordion title={t('hadith.references')}>
                  <RichText blocks={n.referenceBlocks} size={16} />
                </Accordion>
              ) : null}
            </>
          ) : null}

          {narrations.data && narrations.data.length > 0 ? (
            <>
              <SectionTitle>{t('narrators.narrations', { count: narrations.data.length })}</SectionTitle>
              {narrations.data.map((h) => (
                <HadithCard key={h.slug} item={h} />
              ))}
            </>
          ) : null}

          {n.relatedNarrators.length > 0 ? (
            <>
              <SectionTitle>{t('narrators.related')}</SectionTitle>
              <View style={styles.wrap}>
                {n.relatedNarrators.map((r) => (
                  <Chip
                    key={r.slug}
                    label={r.name}
                    onPress={() => router.push({ pathname: '/narrators/[slug]', params: { slug: r.slug } })}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Button
            label={t('hadith.openWebsite')}
            kind="soft"
            icon={{ ios: 'safari', android: 'open_in_new', web: 'open_in_new' }}
            onPress={() => openExternal(narratorWebUrl(n.slug))}
          />
        </ScreenScroll>
      )}
    </>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm } });
