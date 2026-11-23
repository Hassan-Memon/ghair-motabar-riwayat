import { splitForHighlight } from '@tehqeqat/core';
import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, UrduText } from '@/components/ui/primitives';
import { useColors } from '@/providers/app-providers';
import { space } from '@/theme/tokens';

export interface HadithCardItem {
  slug: string;
  title: string;
  book: string;
  chapter: string | null;
}

/** The website's result card: title (with highlights), book, chapter. */
export const HadithCard = memo(function HadithCard({
  item,
  tokens,
  chapterName,
  query,
}: {
  item: HadithCardItem;
  tokens?: readonly string[];
  chapterName?: string;
  query?: string;
}) {
  const { colors } = useColors();
  const segs = tokens?.length ? splitForHighlight(item.title, tokens) : null;
  return (
    <Card
      accessibilityLabel={item.title}
      onPress={() =>
        router.push({ pathname: '/hadith/[slug]', params: query ? { slug: item.slug, q: query } : { slug: item.slug } })
      }>
      <UrduText numberOfLines={4}>
        {segs
          ? segs.map((s, i) =>
              s.hit ? (
                <Text key={i} style={{ backgroundColor: colors.highlight, color: colors.highlightText }}>
                  {s.text}
                </Text>
              ) : (
                s.text
              ),
            )
          : item.title}
      </UrduText>
      <View style={styles.meta}>
        <Badge label={item.book} style={styles.shrink} />
        {chapterName ? <Badge label={chapterName} style={styles.shrink} /> : null}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  shrink: { flexShrink: 1 },
});
