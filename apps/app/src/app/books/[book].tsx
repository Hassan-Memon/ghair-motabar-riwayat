import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { openExternal } from '@/lib/open-external';
import { HadithList } from '@/components/hadith/hadith-list';
import { AppText, Button, UrduText } from '@/components/ui/primitives';
import { useBooks, useHadithList } from '@/hooks/queries';
import { useT } from '@/providers/app-providers';
import { space } from '@/theme/tokens';

export default function BookScreen() {
  const { book } = useLocalSearchParams<{ book: string }>();
  const { t } = useT();
  const list = useHadithList({ book });
  const books = useBooks();
  const info = books.data?.find((b) => b.name === book);

  return (
    <>
      <Stack.Screen options={{ title: info?.volume_no ? t('books.volume', { n: info.volume_no }) : t('books.title') }} />
      <HadithList
        items={list.data}
        loading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        header={
          <View style={styles.header}>
            <UrduText size="title">{book}</UrduText>
            {list.data ? (
              <AppText variant="caption" color="textSecondary">
                {t('books.count', { count: list.data.length })}
              </AppText>
            ) : null}
            {info?.pdf_url ? (
              <Button
                label={t('books.pdf')}
                kind="soft"
                icon={{ ios: 'doc.richtext', android: 'picture_as_pdf', web: 'picture_as_pdf' }}
                onPress={() => openExternal(info.pdf_url!)}
              />
            ) : null}
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({ header: { gap: space.sm, marginBottom: space.sm } });
