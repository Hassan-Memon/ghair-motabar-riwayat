import { hadithWebUrl, normalize, recordOpened, tokenize, toggleBookmark, type Block } from '@tehqeqat/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { openExternal } from '@/lib/open-external';
import { Accordion } from '@/components/hadith/accordion';
import { HadithCard } from '@/components/hadith/hadith-card';
import { RichText } from '@/components/hadith/rich-text';
import { AppText, Badge, Button, Card, Chip, IconButton, ScreenScroll, SectionTitle } from '@/components/ui/primitives';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { useChapterNames, useHadith, useInvalidateUser, useIsBookmarked } from '@/hooks/queries';
import { useDb, useSettings, useT } from '@/providers/app-providers';
import { space, typeScale } from '@/theme/tokens';
import { TEXT_SCALE_MAX, TEXT_SCALE_MIN } from '@tehqeqat/core';

const plain = (blocks: readonly Block[]) => blocks.map((b) => b.runs.map((r) => r.text).join('')).join('\n');

export default function HadithScreen() {
  const { slug, q } = useLocalSearchParams<{ slug: string; q?: string }>();
  const { t } = useT();
  const { user } = useDb();
  const { settings, update } = useSettings();
  const hadith = useHadith(slug);
  const bookmarked = useIsBookmarked(slug);
  const chapterNames = useChapterNames();
  const invalidateUser = useInvalidateUser();
  const tokens = useMemo(() => (q ? tokenize(q) : []), [q]);

  useEffect(() => {
    if (hadith.data) void recordOpened(user, slug).then(invalidateUser);
  }, [hadith.data, user, slug, invalidateUser]);

  const openSections = useMemo(() => {
    const secs = hadith.data?.sectionBlocks ?? [];
    if (tokens.length === 0) return secs.map((_, i) => i === 0);
    const matched = secs.map((s) => {
      const text = normalize(`${s.heading}\n${plain(s.blocks)}`);
      return tokens.some((tok) => text.includes(tok));
    });
    return matched.some(Boolean) ? matched : secs.map((_, i) => i === 0);
  }, [hadith.data, tokens]);

  const share = () => {
    const h = hadith.data;
    if (!h) return;
    const url = hadithWebUrl(h.slug);
    void Share.share({ message: `${h.title}\n${url}`, url, title: h.title });
  };

  const toggle = async () => {
    await toggleBookmark(user, slug);
    await invalidateUser();
  };

  const scaleBy = (d: number) => {
    const next = Math.round(Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, settings.textScale + d)) * 10) / 10;
    update('textScale', next);
  };

  const h = hadith.data;
  const onFootnote = (id: string, label: string) =>
    router.push({ pathname: '/footnote', params: { slug, id, label } });

  return (
    <>
      <Stack.Screen
        options={{
          title: h?.type ?? '',
          headerRight: () =>
            h ? (
              <View style={styles.headerActions}>
                <IconButton
                  icon={
                    bookmarked.data
                      ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }
                      : { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }
                  }
                  label={bookmarked.data ? t('hadith.bookmarked') : t('hadith.bookmark')}
                  onPress={() => void toggle()}
                />
                <IconButton
                  icon={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                  label={t('hadith.share')}
                  onPress={share}
                />
              </View>
            ) : null,
        }}
      />
      {hadith.isPending ? (
        <ListSkeleton rows={3} />
      ) : hadith.error ? (
        <ErrorState onRetry={() => void hadith.refetch()} />
      ) : !h ? (
        <EmptyState icon={{ ios: 'doc.questionmark', android: 'help', web: 'help' }} title={t('hadith.notFound')} />
      ) : (
        <ScreenScroll>
          <RichText blocks={h.titleBlocks} tokens={tokens} size={typeScale.title + 2} />
          <View style={styles.badges}>
            <Pressable onPress={() => router.push({ pathname: '/books/[book]', params: { book: h.book } })} accessibilityRole="link">
              <Badge label={h.book} />
            </Pressable>
            {h.chapter ? (
              <Pressable
                onPress={() => router.push({ pathname: '/chapters/[slug]', params: { slug: h.chapter! } })}
                accessibilityRole="link">
                <Badge label={chapterNames.data?.[h.chapter] ?? h.chapter} />
              </Pressable>
            ) : null}
          </View>

          {h.hukmBlocks.length > 0 ? (
            <Card>
              <AppText variant="caption" color="primary" weight="bold">
                {t('hadith.hukm')}
              </AppText>
              <RichText blocks={h.hukmBlocks} tokens={tokens} onFootnote={onFootnote} />
            </Card>
          ) : null}

          {h.sectionBlocks.map((s, i) => (
            <Accordion
              key={`${slug}-${i}`}
              urduTitle={s.heading || undefined}
              title={s.heading ? undefined : t('hadith.section', { n: i + 1 })}
              initiallyOpen={openSections[i]}>
              <RichText blocks={s.blocks} tokens={tokens} onFootnote={onFootnote} />
            </Accordion>
          ))}

          {h.referenceBlocks.length > 0 ? (
            <Accordion title={t('hadith.references')}>
              <RichText blocks={h.referenceBlocks} size={16} />
            </Accordion>
          ) : null}

          <View style={styles.tools}>
            <AppText variant="caption" color="textSecondary">
              {t('hadith.textSize')}
            </AppText>
            <Chip label="−" onPress={() => scaleBy(-0.1)} />
            <Chip label="+" onPress={() => scaleBy(0.1)} />
          </View>

          {h.narrators.length > 0 ? (
            <>
              <SectionTitle>{t('hadith.narrators')}</SectionTitle>
              <View style={styles.badges}>
                {h.narrators.map((n) => (
                  <Chip
                    key={n.slug}
                    label={n.name}
                    onPress={() => router.push({ pathname: '/narrators/[slug]', params: { slug: n.slug } })}
                  />
                ))}
              </View>
            </>
          ) : null}

          {h.relatedTitles.length > 0 ? (
            <>
              <SectionTitle>{t('hadith.related')}</SectionTitle>
              {h.relatedTitles.map((r) => (
                <HadithCard key={r.slug} item={r} chapterName={r.chapter ? chapterNames.data?.[r.chapter] : undefined} />
              ))}
            </>
          ) : null}

          <Button
            label={t('hadith.openWebsite')}
            kind="soft"
            icon={{ ios: 'safari', android: 'open_in_new', web: 'open_in_new' }}
            onPress={() => openExternal(hadithWebUrl(h.slug))}
          />
        </ScreenScroll>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: space.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tools: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center' },
});
