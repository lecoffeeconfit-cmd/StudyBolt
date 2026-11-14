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

export function PlanReadinessRing({ value, colors, accent, still }: { value: number | null; colors: AppColors; accent: string; still: boolean }) {
  const { fontScale } = useWindowDimensions();
  const size = 56 * Math.min(1.35, Math.max(1, fontScale));
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
  const circleProps = { cx: 28, cy: 28, r: 22, fill: 'none', stroke: accent, strokeWidth: 4, strokeLinecap: 'round' as const, strokeDasharray: circumference + ' ' + circumference, transform: 'rotate(-90 28 28)' };
  return <View accessible accessibilityRole="image" accessibilityLabel={value === null ? 'Knowledge: not assessed yet' : 'Knowledge: ' + value + '% of topics with consistent spaced recall. A practice estimate, not an exam prediction.'} style={[styles.ring, { width: size, height: size }]}>
    <Svg width={size} height={size} viewBox="0 0 56 56" {...(Platform.OS === 'web' ? { 'aria-hidden': true, focusable: false } : { accessible: false })}>
      <Circle cx={28} cy={28} r={22} fill="none" stroke={colors.border} strokeWidth={4} />
      {value !== null ? Platform.OS === 'web' ? <Circle {...circleProps} strokeDashoffset={circumference * (1 - value / 100)} /> : <AnimatedCircle {...circleProps} strokeDashoffset={progress.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] })} /> : null}
    </Svg>
    <View style={styles.ringCenter}><Text maxFontSizeMultiplier={1.6} style={[styles.ringValue, { color: value === null ? colors.textMuted : colors.text }]}>{value === null ? '—' : value + '%'}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  book: { pointerEvents: 'none', width: 42, height: 42, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bookSurface: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 14, borderWidth: 1, borderColor: '#8CAEE233' },
  bolt: { position: 'absolute', right: -2, bottom: -1, width: 19, height: 19, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 56, height: 56, flexShrink: 0 },
  ringCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  ringValue: { fontSize: 12, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
