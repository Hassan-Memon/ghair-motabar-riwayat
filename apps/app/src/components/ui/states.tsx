import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View, type DimensionValue } from 'react-native';

import { useColors, useT } from '@/providers/app-providers';
import { radius, space } from '@/theme/tokens';

import { AppText, Button, Icon, type IconName } from './primitives';

export function Skeleton({ width = '100%', height = 16 }: { width?: DimensionValue; height?: number }) {
  const { colors } = useColors();
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{ width, height, borderRadius: radius.sm, backgroundColor: colors.surfaceSunken, opacity: pulse }}
    />
  );
}

/** Placeholder cards while a list loads. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  const { colors } = useColors();
  return (
    <View style={styles.list} accessibilityLabel="loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.card, { backgroundColor: colors.surface }]}>
          <Skeleton width="92%" height={18} />
          <Skeleton width="70%" height={18} />
          <Skeleton width="40%" height={12} />
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <View style={styles.center}>
      <Icon name={icon} size={40} color="textMuted" />
      <AppText variant="title" style={styles.centerText}>
        {title}
      </AppText>
      {hint ? (
        <AppText color="textSecondary" style={styles.centerText}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useT();
  return (
    <View style={styles.center}>
      <Icon name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }} size={40} color="danger" />
      <AppText variant="title" style={styles.centerText}>
        {message ?? t('common.error')}
      </AppText>
      {onRetry ? <Button label={t('common.retry')} onPress={onRetry} kind="soft" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md, padding: space.lg },
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md, flexGrow: 1 },
  centerText: { textAlign: 'center' },
});
