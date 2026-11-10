import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
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
    <Animated.View style={{ transform: still ? [] : [{ rotate: lift.interpolate({ inputRange: [0, 0.45, 1], outputRange: ['-6deg', '2deg', '0deg'] }) }] }}><MaterialCommunityIcons name="book-open-page-variant" color={colors.primary} size={27} /></Animated.View>
    <View style={[styles.bolt, { backgroundColor: colors.goldBright }]}><MaterialCommunityIcons name="lightning-bolt" color={colors.onGold} size={12} /></View>
  </View>;
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
    transform: [{ translateX: travel.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, width - 138)] }) }],
  }]}><LinearGradient colors={['transparent', colors.goldBright, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>;
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
    else Animated.timing(progress, { toValue: value, duration: 320, useNativeDriver: false, isInteraction: false }).start();
    previous.current = value;
    return () => progress.stopAnimation();
  }, [progress, still, value]);
  const circleProps = { cx: 28, cy: 28, r: 22, fill: 'none', stroke: colors.primary, strokeWidth: 4, strokeLinecap: 'round' as const, strokeDasharray: circumference + ' ' + circumference, transform: 'rotate(-90 28 28)' };
  return <View accessible accessibilityRole="image" accessibilityLabel={value === null ? 'Knowledge readiness: not assessed yet' : 'Knowledge readiness: ' + value + '% of topics with consistent spaced recall'} style={[styles.ring, { width: size, height: size }]}>
    <Svg width={size} height={size} viewBox="0 0 56 56" {...(Platform.OS === 'web' ? { 'aria-hidden': true, focusable: false } : { accessible: false })}>
      <Circle cx={28} cy={28} r={22} fill="none" stroke={colors.border} strokeWidth={4} />
      {value !== null ? Platform.OS === 'web' ? <Circle {...circleProps} strokeDashoffset={circumference * (1 - value / 100)} /> : <AnimatedCircle {...circleProps} strokeDashoffset={progress.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] })} /> : null}
    </Svg>
    <View style={styles.ringCenter}><Text style={[styles.ringValue, { color: value === null ? colors.textMuted : colors.text }]}>{value === null ? '—' : value + '%'}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  book: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bookSurface: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 14, borderWidth: 1, borderColor: '#8CAEE233' },
  bolt: { position: 'absolute', right: -2, bottom: -1, width: 19, height: 19, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  borderLight: { position: 'absolute', top: 0, left: 26, width: 86, height: 2, borderRadius: 2 },
  ring: { width: 56, height: 56, flexShrink: 0 },
  ringCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  ringValue: { fontSize: 12, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
