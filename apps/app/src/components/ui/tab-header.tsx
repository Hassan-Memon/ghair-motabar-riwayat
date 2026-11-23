import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/providers/app-providers';
import { maxContentWidth, space } from '@/theme/tokens';

import { AppText } from './primitives';

/** Large title for tab screens, which have no navigation header. */
export function TabHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useColors();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.md, backgroundColor: colors.background }]}>
      <View style={styles.inner}>
        <AppText variant="headline" weight="bold" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  inner: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', gap: space.xs },
});
