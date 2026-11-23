import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { openExternal } from '@/lib/open-external';
import { AppText, Card, ScreenScroll } from '@/components/ui/primitives';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { useFiles } from '@/hooks/queries';
import { useColors, useT } from '@/providers/app-providers';
import { radius, space } from '@/theme/tokens';

/** The website's PDF files. They are on the website's storage and open online. */
export default function LibraryScreen() {
  const { t } = useT();
  const { colors } = useColors();
  const files = useFiles();
  if (files.isPending) return <ListSkeleton />;
  if (files.error) return <ErrorState onRetry={() => void files.refetch()} />;
  return (
    <ScreenScroll>
      <AppText variant="caption" color="textSecondary">
        {t('library.hint')}
      </AppText>
      {files.data.length === 0 ? (
        <EmptyState icon={{ ios: 'doc', android: 'description', web: 'description' }} title={t('library.empty')} />
      ) : null}
      {files.data.map((f) => (
        <Card key={f.id} style={styles.row} accessibilityLabel={f.name} onPress={() => openExternal(f.url)}>
          {f.image_url ? (
            <Image
              source={{ uri: f.image_url }}
              style={[styles.cover, { backgroundColor: colors.surfaceSunken }]}
              contentFit="cover"
              accessible={false}
            />
          ) : (
            <View style={[styles.cover, { backgroundColor: colors.surfaceSunken }]} />
          )}
          <AppText style={styles.flex}>{f.name.replace(/\.pdf$/i, '')}</AppText>
        </Card>
      ))}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cover: { width: 52, height: 72, borderRadius: radius.sm },
  flex: { flex: 1 },
});
