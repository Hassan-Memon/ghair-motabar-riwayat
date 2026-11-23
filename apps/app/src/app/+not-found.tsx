import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { useT } from '@/providers/app-providers';
import { space } from '@/theme/tokens';

export default function NotFound() {
  const { t } = useT();
  return (
    <View style={styles.wrap}>
      <EmptyState icon={{ ios: 'questionmark.circle', android: 'help', web: 'help' }} title={t('common.notFound')} />
      <Button label={t('common.goHome')} onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.lg } });
