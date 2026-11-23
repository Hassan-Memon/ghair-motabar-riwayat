import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui/primitives';
import type { MessageKey } from '@/i18n';
import { useColors, useT } from '@/providers/app-providers';
import { maxContentWidth, space } from '@/theme/tokens';

/** Web and desktop: a bottom tab bar like the phone apps (native tabs render as a top pill on web). */
const TABS: { name: string; href: '/' | '/all' | '/books' | '/narrators' | '/more'; label: MessageKey; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'tabs.search', icon: { web: 'search' } },
  { name: 'all', href: '/all', label: 'tabs.all', icon: { web: 'list' } },
  { name: 'books', href: '/books', label: 'tabs.books', icon: { web: 'library_books' } },
  { name: 'narrators', href: '/narrators', label: 'tabs.narrators', icon: { web: 'groups' } },
  { name: 'more', href: '/more', label: 'tabs.more', icon: { web: 'more_horiz' } },
];

export default function WebTabsLayout() {
  const { t } = useT();
  const { colors } = useColors();
  return (
    <Tabs style={styles.flex}>
      <TabSlot style={styles.flex} />
      <TabList asChild>
        <View style={StyleSheet.flatten([styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.separator }])}>
          <View style={styles.inner}>
            {TABS.map((tab) => (
              <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
                <TabButton icon={tab.icon} label={t(tab.label)} />
              </TabTrigger>
            ))}
          </View>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ isFocused, icon, label, ...props }: TabTriggerSlotProps & { icon: IconName; label: string }) {
  const color = isFocused ? 'primary' : 'textSecondary';
  return (
    <Pressable {...(props as PressableProps)} accessibilityRole="tab" accessibilityLabel={label} style={styles.tab}>
      <Icon name={icon} size={22} color={color} />
      <AppText variant="caption" color={color} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'center' },
  inner: { flexDirection: 'row', width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', paddingTop: space.xs, paddingBottom: space.xs, gap: 0 },
});
