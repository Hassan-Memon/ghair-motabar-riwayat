import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useColors } from '@/providers/app-providers';
import { elevation, maxContentWidth, radius, space, type ColorName } from '@/theme/tokens';
import { useTypography, type TypeVariant } from '@/theme/typography';

// ── text ─────────────────────────────────────────────────────────────────────

export function AppText({
  variant = 'body',
  color = 'text',
  weight,
  style,
  ...rest
}: TextProps & { variant?: TypeVariant; color?: ColorName; weight?: 'bold' }) {
  const { colors } = useColors();
  const { ui } = useTypography();
  return (
    <Text
      {...rest}
      style={[ui(variant), { color: colors[color], writingDirection: 'rtl' }, weight && styles.bold, style]}
    />
  );
}

/** Urdu content text (titles, excerpts) in the reader's chosen Nastaliq face. */
export function UrduText({
  size = 'body',
  scaled = false,
  color = 'text',
  style,
  ...rest
}: TextProps & { size?: TypeVariant; scaled?: boolean; color?: ColorName }) {
  const { colors } = useColors();
  const t = useTypography();
  const fontSize = scaled ? t.scaled(size) : t.scaled(size) / t.textScale;
  return <Text {...rest} style={[t.script('urdu', fontSize), styles.urdu, { color: colors[color] }, style]} />;
}

// ── icons ────────────────────────────────────────────────────────────────────

export type IconName = SymbolViewProps['name'];

export function Icon({ name, size = 22, color = 'text' }: { name: IconName; size?: number; color?: ColorName }) {
  const { colors } = useColors();
  return <SymbolView name={name} size={size} tintColor={colors[color]} resizeMode="scaleAspectFit" />;
}

// ── layout ───────────────────────────────────────────────────────────────────

/** Scrollable screen body, centred and capped in width on tablets and desktop. */
export function ScreenScroll({ children, contentContainerStyle, ...rest }: ScrollViewProps & { children: ReactNode }) {
  const { colors } = useColors();
  return (
    <ScrollView
      {...rest}
      style={[{ backgroundColor: colors.background }, rest.style]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors, dark } = useColors();
  const base = [styles.card, { backgroundColor: colors.surface }, !dark && elevation.card, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="caption" color="textSecondary" weight="bold" accessibilityRole="header">
        {children}
      </AppText>
      {action}
    </View>
  );
}

/** A tappable row in a grouped list (More, Settings). */
export function ListRow({
  icon,
  label,
  detail,
  onPress,
  last,
  trailing,
}: {
  icon?: IconName;
  label: string;
  detail?: string;
  onPress?: () => void;
  last?: boolean;
  trailing?: ReactNode;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSunken }]}>
      {icon ? <Icon name={icon} size={20} color="primary" /> : null}
      <View style={[styles.rowBody, !last && { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <View style={styles.flex}>
          <AppText>{label}</AppText>
          {detail ? (
            <AppText variant="caption" color="textSecondary">
              {detail}
            </AppText>
          ) : null}
        </View>
        {trailing ??
          (onPress ? <Icon name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={14} color="textMuted" /> : null)}
      </View>
    </Pressable>
  );
}

export function Group({ children }: { children: ReactNode }) {
  const { colors } = useColors();
  return <View style={[styles.group, { backgroundColor: colors.surface }]}>{children}</View>;
}

// ── controls ─────────────────────────────────────────────────────────────────

export function Chip({ label, selected, onPress, style }: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? colors.primary : colors.primarySoft },
        pressed && styles.pressed,
        style,
      ]}>
      <AppText variant="caption" color={selected ? 'primaryText' : 'primarySoftText'}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Badge({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useColors();
  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceSunken }, style]}>
      <AppText variant="caption" color="textSecondary" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const { colors } = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceSunken }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: colors.surface }]}>
            <AppText variant="caption" color={on ? 'text' : 'textSecondary'} weight={on ? 'bold' : undefined}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Button({ label, onPress, icon, kind = 'primary', disabled }: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  kind?: 'primary' | 'soft';
  disabled?: boolean;
}) {
  const { colors } = useColors();
  const fg: ColorName = kind === 'primary' ? 'primaryText' : 'primarySoftText';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: kind === 'primary' ? colors.primary : colors.primarySoft },
        (pressed || disabled) && styles.pressed,
      ]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <AppText color={fg} weight="bold">
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color = 'primary' }: PressableProps & {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: ColorName;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Icon name={icon} size={22} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' } as TextStyle,
  urdu: { writingDirection: 'rtl', paddingTop: 2 },
  flex: { flex: 1 },
  screenContent: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    padding: space.lg,
    gap: space.lg,
    paddingBottom: space.xxl * 2,
  },
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  pressed: { opacity: 0.6 },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xs,
    marginTop: space.sm,
  },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingStart: space.lg, gap: space.md, minHeight: 52 },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingEnd: space.lg,
    alignSelf: 'stretch',
  },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill },
  badge: { paddingHorizontal: space.sm, paddingVertical: space.xxs, borderRadius: radius.sm, maxWidth: '100%' },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: space.xxs + 1 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: space.xs + 2, borderRadius: radius.md - 2 },
  button: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  iconButton: { padding: space.xs },
});
