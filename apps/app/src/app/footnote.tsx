import { findFootnote } from '@tehqeqat/core';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { RichText } from '@/components/hadith/rich-text';
import { ScreenScroll } from '@/components/ui/primitives';
import { EmptyState, ListSkeleton } from '@/components/ui/states';
import { useHadith, useNarrator } from '@/hooks/queries';
import { useT } from '@/providers/app-providers';

/** Sheet with one reference, opened from a footnote mark in the text. */
export default function FootnoteScreen() {
  const { slug, id, label, kind } = useLocalSearchParams<{
    slug: string;
    id: string;
    label?: string;
    kind?: 'narrator';
  }>();
  const { t } = useT();
  // The screen that opened this sheet has already loaded (and cached) its document.
  const hadith = useHadith(slug, kind !== 'narrator');
  const narrator = useNarrator(slug, kind === 'narrator');
  const doc = kind === 'narrator' ? narrator : hadith;
  const blocks = useMemo(() => (doc.data ? findFootnote(doc.data.referenceBlocks, id) : []), [doc.data, id]);

  return (
    <>
      <Stack.Screen options={{ title: label ? t('hadith.footnote', { n: label }) : t('hadith.references') }} />
      {doc.isPending ? (
        <ListSkeleton rows={1} />
      ) : blocks.length === 0 ? (
        <EmptyState icon={{ ios: 'doc.questionmark', android: 'help', web: 'help' }} title={t('common.notFound')} />
      ) : (
        <ScreenScroll>
          <RichText blocks={blocks} size={17} />
        </ScreenScroll>
      )}
    </>
  );
}
