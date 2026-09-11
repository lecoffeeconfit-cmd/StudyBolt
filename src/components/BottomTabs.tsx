import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStudyBolt } from '../StudyBoltContext';
import { Icon, IconName } from './ui';

export type MainTab = 'home' | 'library' | 'planner' | 'stats' | 'profile';

const TABS: Array<{ id: MainTab; label: string; icon: IconName; activeIcon: IconName }> = [
  { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home-variant' },
  { id: 'library', label: 'Library', icon: 'bookshelf', activeIcon: 'book-open-page-variant' },
  { id: 'planner', label: 'Planner', icon: 'calendar-blank-outline', activeIcon: 'calendar-check' },
  { id: 'stats', label: 'Stats', icon: 'chart-bar', activeIcon: 'chart-box' },
  { id: 'profile', label: 'Profile', icon: 'account-outline', activeIcon: 'account-circle' },
];

export function BottomTabs({ active, onChange }: { active: MainTab; onChange: (tab: MainTab) => void }) {
  const { colors } = useStudyBolt();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        {
          height: 62 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.tabBar,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [styles.tab, pressed && { opacity: 0.65 }]}
          >
            <View style={[styles.iconWrap, selected && { backgroundColor: colors.primarySoft }]}>
              <Icon name={selected ? tab.activeIcon : tab.icon} size={21} color={selected ? colors.primary : colors.textMuted} />
            </View>
            <Text style={[styles.label, { color: selected ? colors.primary : colors.textMuted }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 7,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: Platform.OS === 'ios' ? 0.05 : 0,
    shadowRadius: 14,
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 2, minHeight: 48 },
  iconWrap: { width: 35, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, fontWeight: '700' },
});
