import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, I18nManager, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Icon } from './ui';
import type { IconName } from './ui';

export type MainTab = 'home' | 'library' | 'planner' | 'discover' | 'stats' | 'profile';

type TabDefinition = { id: MainTab; label: string; icon: IconName; activeIcon: IconName };

const TABS: TabDefinition[] = [
  { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home-variant' },
  { id: 'library', label: 'Library', icon: 'bookshelf', activeIcon: 'book-open-page-variant' },
  { id: 'planner', label: 'Planner', icon: 'calendar-blank-outline', activeIcon: 'calendar-check' },
  { id: 'stats', label: 'Stats', icon: 'chart-bar', activeIcon: 'chart-box' },
  { id: 'discover', label: 'Discover', icon: 'compass-outline', activeIcon: 'compass' },
  { id: 'profile', label: 'Settings', icon: 'cog-outline', activeIcon: 'cog' },
];

export const BOTTOM_TAB_BAR_HEIGHT = 66;

export function bottomTabBarTop(bottomInset: number): number {
  return BOTTOM_TAB_BAR_HEIGHT + Math.max(bottomInset, 12);
}

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function BottomTabs({ active, onChange }: { active: MainTab; onChange: (tab: MainTab) => void }) {
  const { colors } = useStudyBolt();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const activeIndex = TABS.findIndex((tab) => tab.id === active);
  const position = useRef(new Animated.Value(activeIndex)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const tabWidth = trackWidth / TABS.length;

  useEffect(() => {
    position.stopAnimation();
    if (reducedMotion) {
      position.setValue(activeIndex);
      return;
    }
    const animation = Animated.spring(position, {
      toValue: activeIndex,
      damping: 25,
      stiffness: 300,
      mass: 0.9,
      overshootClamping: true,
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [activeIndex, position, reducedMotion]);

  const translateX = position.interpolate({
    inputRange: [0, TABS.length - 1],
    outputRange: I18nManager.isRTL ? [trackWidth - tabWidth, 0] : [0, trackWidth - tabWidth],
  });

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          height: bottomTabBarTop(insets.bottom) + 22,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingLeft: Math.max(insets.left, 12),
          paddingRight: Math.max(insets.right, 12),
        },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        accessible={false}
        colors={[`${colors.background}00`, `${colors.background}EB`, colors.background]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Main navigation"
        style={[
          styles.bar,
          {
            backgroundColor: colors.tabBar,
            borderColor: colors.mode === 'dark' ? `${colors.primary}26` : colors.border,
            shadowColor: colors.shadow,
            shadowOpacity: colors.mode === 'dark' ? 0.3 : 0.12,
          },
        ]}
      >
        <View style={styles.track} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
          {trackWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              accessible={false}
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.selection, { width: tabWidth - 4, transform: [{ translateX }] }]}
            >
              <LinearGradient
                colors={[colors.primarySoft, `${colors.primary}12`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.selectionFill, { borderColor: `${colors.primary}16` }]}
              />
            </Animated.View>
          ) : null}
          {TABS.map((tab) => (
            <TabButton key={tab.id} tab={tab} selected={tab.id === active} reducedMotion={reducedMotion} onChange={onChange} />
          ))}
        </View>
      </View>
    </View>
  );
}

function TabButton({ tab, selected, reducedMotion, onChange }: {
  tab: TabDefinition;
  selected: boolean;
  reducedMotion: boolean;
  onChange: (tab: MainTab) => void;
}) {
  const { colors } = useStudyBolt();
  const selection = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    selection.stopAnimation();
    if (reducedMotion) {
      selection.setValue(selected ? 1 : 0);
      return;
    }
    const animation = Animated.spring(selection, {
      toValue: selected ? 1 : 0,
      damping: 18,
      stiffness: 260,
      mass: 0.7,
      overshootClamping: true,
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, selected, selection]);

  useEffect(() => {
    if (reducedMotion) {
      press.stopAnimation();
      press.setValue(0);
    }
    return () => press.stopAnimation();
  }, [press, reducedMotion]);

  const animatePress = (pressed: boolean) => {
    if (reducedMotion) return;
    Animated.spring(press, {
      toValue: pressed ? 1 : 0,
      damping: 20,
      stiffness: 450,
      mass: 0.5,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected }}
      aria-selected={selected}
      onPress={() => {
        if (selected) return;
        if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
        onChange(tab.id);
      }}
      onPressIn={() => animatePress(true)}
      onPressOut={() => animatePress(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={(event) => {
        // Web browsers distinguish keyboard focus from a mouse/touch press.
        const target = event.currentTarget as unknown as { matches?: (selector: string) => boolean };
        setFocused(Platform.OS !== 'web' || target.matches?.(':focus-visible') === true);
      }}
      onBlur={() => setFocused(false)}
      style={styles.tab}
    >
      <View
        pointerEvents="none"
        style={[
          styles.interactionSurface,
          {
            backgroundColor: hovered && !selected ? colors.cardStrong : 'transparent',
            borderColor: focused ? colors.primary : 'transparent',
          },
        ]}
      />
      <Animated.View style={[styles.tabContent, { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] }) }] }]}>
        <Animated.View
          accessible={false}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.icon,
            {
              transform: [
                { translateY: selection.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
                { scale: selection.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
              ],
            },
          ]}
        >
          <Animated.View style={[styles.iconLayer, { opacity: selection.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
            <Icon name={tab.icon} size={23} color={colors.textSecondary} />
          </Animated.View>
          <Animated.View style={[styles.iconLayer, { opacity: selection }]}>
            <Icon name={tab.activeIcon} size={23} color={colors.primary} />
          </Animated.View>
        </Animated.View>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
          style={[styles.label, { color: selected ? colors.primary : colors.textSecondary, fontWeight: selected ? '700' : '500' }]}
        >
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 20,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    maxWidth: 520,
    height: BOTTOM_TAB_BAR_HEIGHT,
    padding: 6,
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
    elevation: 12,
  },
  track: { flex: 1, flexDirection: 'row' },
  selection: { position: 'absolute', left: 2, top: 0, bottom: 0 },
  selectionFill: { flex: 1, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 48, borderRadius: 19, justifyContent: 'center' },
  interactionSurface: { position: 'absolute', left: 2, right: 2, top: 0, bottom: 0, borderRadius: 19, borderWidth: 2 },
  tabContent: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  icon: { width: 26, height: 26 },
  iconLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, lineHeight: 13, letterSpacing: 0.05 },
});
