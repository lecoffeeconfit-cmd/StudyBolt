import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, I18nManager, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStudyBolt } from '../StudyBoltContext';
import { isCommunitySharingEnabled } from '../config/community';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { StudyTabGlyph } from './StudyBoltGlyphs';

export type MainTab = 'home' | 'library' | 'planner' | 'discover' | 'stats' | 'profile';

type TabDefinition = { id: MainTab; label: string };

const COMMUNITY_TABS: TabDefinition[] = isCommunitySharingEnabled
  ? [{ id: 'discover', label: 'Discover' }]
  : [];

const TABS: TabDefinition[] = [
  { id: 'home', label: 'Home' },
  { id: 'library', label: 'Library' },
  { id: 'planner', label: 'Planner' },
  { id: 'stats', label: 'Stats' },
  ...COMMUNITY_TABS,
  { id: 'profile', label: 'Settings' },
];

export const BOTTOM_TAB_BAR_HEIGHT = 66;

export function bottomTabBarTop(bottomInset: number): number {
  return BOTTOM_TAB_BAR_HEIGHT + Math.max(bottomInset, 12);
}

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function BottomTabs({ active, onChange }: { active: MainTab; onChange: (tab: MainTab) => void }) {
  const { colors } = useStudyBolt();
  const neon = colors.neon?.navigation;
  const selectedPalette = neon?.tabs[active];
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const activeIndex = TABS.findIndex((tab) => tab.id === active);
  const position = useRef(new Animated.Value(activeIndex)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const tabWidth = trackWidth / TABS.length;
  // The optional sixth tab needs more room for its label at large text sizes on narrow phones.
  const labelScaleLimit = COMMUNITY_TABS.length && tabWidth > 0
    ? Math.min(1.2, Math.max(1, (tabWidth - 2) / 45))
    : 1.2;

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
            borderColor: neon?.edge ?? colors.border,
            shadowColor: colors.shadow,
            shadowOpacity: colors.mode === 'dark' ? 0.3 : 0.12,
          },
        ]}
      >
        {neon ? (
          <View pointerEvents="none" aria-hidden style={[StyleSheet.absoluteFill, styles.neonSurface]}>
            <LinearGradient colors={neon.surface} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={neon.rim}
              locations={[0, 0.18, 0.5, 0.82, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.neonRim}
            />
          </View>
        ) : null}
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
                colors={selectedPalette?.selection ?? [colors.primarySoft, `${colors.primary}12`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.selectionFill, { borderColor: selectedPalette?.edge ?? `${colors.primary}16` }]}
              >
                {selectedPalette ? <View style={[styles.selectionMarker, { backgroundColor: selectedPalette.active }]} /> : null}
              </LinearGradient>
            </Animated.View>
          ) : null}
          {TABS.map((tab) => (
            <TabButton key={tab.id} tab={tab} selected={tab.id === active} reducedMotion={reducedMotion} labelScaleLimit={labelScaleLimit} onChange={onChange} />
          ))}
        </View>
      </View>
    </View>
  );
}

function TabButton({ tab, selected, reducedMotion, labelScaleLimit, onChange }: {
  tab: TabDefinition;
  selected: boolean;
  reducedMotion: boolean;
  labelScaleLimit: number;
  onChange: (tab: MainTab) => void;
}) {
  const { colors } = useStudyBolt();
  const palette = colors.neon?.navigation.tabs[tab.id];
  const glyphs = palette ?? colors.night?.navigation;
  const glyph = selected ? glyphs?.activeGlyph : glyphs?.inactiveGlyph;
  const foreground = selected ? palette?.active ?? colors.primary : palette?.inactive ?? colors.textSecondary;
  const press = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activation, setActivation] = useState(0);

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
      onPressIn={() => {
        animatePress(true);
        if (tab.id === 'profile' && !reducedMotion) setActivation((value) => value + 1);
      }}
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
            borderColor: focused ? palette?.active ?? colors.primary : 'transparent',
          },
        ]}
      />
      <Animated.View style={[styles.tabContent, { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] }) }] }]}>
        <View
          accessible={false}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.icon}
        >
          {selected && palette ? <View style={[styles.iconHalo, { backgroundColor: palette.halo }]} /> : null}
          <StudyTabGlyph
            name={tab.id}
            size={27}
            active={selected}
            color={foreground}
            accent={glyph?.detail ?? colors.goldBright}
            tones={glyph}
            reducedMotion={reducedMotion}
            mode={colors.mode}
            interacting={hovered || focused}
            activation={activation}
          />
        </View>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={labelScaleLimit}
          style={[styles.label, { color: foreground, fontWeight: selected ? '700' : '500' }]}
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
  neonSurface: { borderRadius: 25, overflow: 'hidden' },
  neonRim: { position: 'absolute', top: 0, left: 14, right: 14, height: 1 },
  track: { flex: 1, flexDirection: 'row' },
  selection: { position: 'absolute', left: 2, top: 0, bottom: 0 },
  selectionFill: { flex: 1, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth },
  selectionMarker: { alignSelf: 'center', position: 'absolute', top: 1, width: 13, height: 2, borderRadius: 1 },
  tab: { flex: 1, minHeight: 48, borderRadius: 19, justifyContent: 'center' },
  interactionSurface: { position: 'absolute', left: 2, right: 2, top: 0, bottom: 0, borderRadius: 19, borderWidth: 2 },
  tabContent: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  icon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  iconHalo: { position: 'absolute', width: 30, height: 30, borderRadius: 15 },
  label: { fontSize: 10, lineHeight: 13, letterSpacing: 0.05 },
});
