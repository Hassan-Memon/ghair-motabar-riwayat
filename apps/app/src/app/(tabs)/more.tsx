import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Group, ListRow, ScreenScroll } from '@/components/ui/primitives';
import { TabHeader } from '@/components/ui/tab-header';
import { useColors, useT } from '@/providers/app-providers';

export default function MoreScreen() {
  const { t } = useT();
  const { colors } = useColors();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <TabHeader title={t('more.title')} />
      <ScreenScroll>
        <Group>
          <ListRow
            icon={{ ios: 'bookmark', android: 'bookmark', web: 'bookmark' }}
            label={t('more.bookmarks')}
            onPress={() => router.push('/bookmarks')}
          />
          <ListRow
            icon={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }}
            label={t('more.history')}
            onPress={() => router.push('/history')}
          />
          <ListRow
            icon={{ ios: 'doc.richtext', android: 'picture_as_pdf', web: 'picture_as_pdf' }}
            label={t('more.library')}
            onPress={() => router.push('/library')}
            last
          />
        </Group>
        <Group>
          <ListRow
            icon={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
            label={t('more.settings')}
            onPress={() => router.push('/settings')}
          />
          <ListRow
            icon={{ ios: 'info.circle', android: 'info', web: 'info' }}
            label={t('more.about')}
            onPress={() => router.push('/about')}
            last
          />
        </Group>
      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
