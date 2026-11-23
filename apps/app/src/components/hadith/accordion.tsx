import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, UrduText } from '@/components/ui/primitives';
import { useColors } from '@/providers/app-providers';
import { elevation, radius, space } from '@/theme/tokens';

/** A titled section that opens and closes; closed sections do not render their body. */
export function Accordion({
  title,
  urduTitle,
  initiallyOpen = false,
  children,
}: {
  title?: string;
  urduTitle?: string;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const { colors, dark } = useColors();
  const label = urduTitle ?? title ?? '';
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface }, !dark && elevation.card]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
        style={({ pressed }) => [styles.header, pressed && { backgroundColor: colors.surfaceSunken }]}>
        <View style={styles.flex}>
          {urduTitle ? (
            <UrduText color="primary">{urduTitle}</UrduText>
          ) : (
            <AppText color="primary" weight="bold">
              {title}
            </AppText>
          )}
        </View>
        <Icon
          name={
            open
              ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
              : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
          }
          size={16}
          color="textSecondary"
        />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  flex: { flex: 1 },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg },
});
