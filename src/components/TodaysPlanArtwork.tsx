import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import type { AppColors } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function PlanBook({ colors, still, compact = false }: { colors: AppColors; still: boolean; compact?: boolean }) {
  const lift = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    lift.setValue(still ? 1 : 0);
    const motion = Animated.timing(lift, { toValue: 1, duration: 740, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    if (!still) motion.start();
    return () => motion.stop();
  }, [lift, still]);
  return <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.book, compact && { width: 34, height: 36 }]}>
    <LinearGradient colors={[colors.primarySoft, colors.card]} style={styles.bookSurface} />
    <Animated.View style={{ transform: still ? [] : [{ rotate: lift.interpolate({ inputRange: [0, 0.45, 1], outputRange: ['-6deg', '2deg', '0deg'] }) }] }}><Svg width={30} height={29} viewBox="0 0 36 34" {...(Platform.OS === 'web' ? { 'aria-hidden': true, focusable: false } : { accessible: false })}>
      <Path d="M3 7Q10 4 18 9Q26 4 33 7V29Q25 26 18 31Q11 26 3 29Z" fill={colors.primary} />
      <Path d="M6 5Q12 4 18 8Q24 4 30 5V25Q24 24 18 28Q12 24 6 25Z" fill={colors.mode === 'dark' ? '#DCE9FA' : '#FFFFFF'} />
      <Path d="M18 8V27M9 10L14 12M9 15L14 17M22 12L27 10M22 17L27 15" fill="none" stroke={colors.mode === 'dark' ? '#7497C0' : '#ADC8EC'} strokeWidth={1.5} strokeLinecap="round" />
    </Svg></Animated.View>
    <View style={[styles.bolt, { backgroundColor: colors.goldBright }]}><MaterialCommunityIcons name="lightning-bolt" color={colors.onGold} size={12} /></View>
  </View>;
}

/** Finite selection feedback; inactive pages stay quieter during a swipe. */
export function PlanClassSurface({ active, still, children }: { active: boolean; still: boolean; children: React.ReactNode }) {
  const selection = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    selection.stopAnimation();
    if (still) { selection.setValue(active ? 1 : 0); return; }
    const spring = Animated.spring(selection, { toValue: active ? 1 : 0, damping: 22, stiffness: 240, mass: 0.7, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    spring.start();
    return () => spring.stop();
  }, [active, selection, still]);
  return <Animated.View style={{ opacity: selection.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }), transform: still ? [] : [{ scale: selection.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }] }}>{children}</Animated.View>;
}

export function PlanBorderHighlight({ width, still, selection, colors }: { width: number; still: boolean; selection: string; colors: AppColors }) {
  const travel = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    travel.setValue(1);
    if (still || !width) return;
    travel.setValue(0);
    const motion = Animated.timing(travel, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    motion.start();
    return () => motion.stop();
  }, [selection, still, travel, width]);
  return <Animated.View pointerEvents="none" aria-hidden accessible={false} style={[styles.borderLight, {
    opacity: still ? 0 : travel.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.8, 0.5, 0] }),
    transform: [{ translateX: travel.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, width - 144)] }) }],
  }]}><LinearGradient colors={['transparent', colors.primary, colors.goldBright, 'transparent']} locations={[0, 0.45, 0.76, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>;
}

export function PlanReadinessRing({ value, colors, still }: { value: number | null; colors: AppColors; still: boolean }) {
  const { fontScale } = useWindowDimensions();
  const size = 56 * Math.max(1, fontScale);
  const circumference = 2 * Math.PI * 22;
  const progress = useRef(new Animated.Value(value ?? 0)).current;
  const previous = useRef(value);
  useEffect(() => {
    progress.stopAnimation();
    if (still || value === null || previous.current === null || Platform.OS === 'web') progress.setValue(value ?? 0);
    else if (previous.current !== value) Animated.timing(progress, { toValue: value, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false, isInteraction: false }).start();
    previous.current = value;
    return () => progress.stopAnimation();
  }, [progress, still, value]);
  const circleProps = { cx: 28, cy: 28, r: 22, fill: 'none', stroke: colors.primary, strokeWidth: 4, strokeLinecap: 'round' as const, strokeDasharray: circumference + ' ' + circumference, transform: 'rotate(-90 28 28)' };
  return <View accessible accessibilityRole="image" accessibilityLabel={value === null ? 'Knowledge: not assessed yet' : 'Knowledge: ' + value + '% of topics with consistent spaced recall. A practice estimate, not an exam prediction.'} style={[styles.ring, { width: size, height: size }]}>
    <Svg width={size} height={size} viewBox="0 0 56 56" {...(Platform.OS === 'web' ? { 'aria-hidden': true, focusable: false } : { accessible: false })}>
      <Circle cx={28} cy={28} r={22} fill="none" stroke={colors.border} strokeWidth={4} />
      {value !== null ? Platform.OS === 'web' ? <Circle {...circleProps} strokeDashoffset={circumference * (1 - value / 100)} /> : <AnimatedCircle {...circleProps} strokeDashoffset={progress.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] })} /> : null}
    </Svg>
    <View style={styles.ringCenter}><Text style={[styles.ringValue, { color: value === null ? colors.textMuted : colors.text }]}>{value === null ? '—' : value + '%'}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  book: { pointerEvents: 'none', width: 42, height: 42, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bookSurface: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 14, borderWidth: 1, borderColor: '#8CAEE233' },
  bolt: { position: 'absolute', right: -2, bottom: -1, width: 19, height: 19, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  borderLight: { position: 'absolute', top: 0, left: 26, width: 92, height: 1.5, borderRadius: 2 },
  ring: { width: 56, height: 56, flexShrink: 0 },
  ringCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  ringValue: { fontSize: 12, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
