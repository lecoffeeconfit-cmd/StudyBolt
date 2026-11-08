import React, { useEffect } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { useLoadingMotion } from '../hooks/useLoadingMotion';
import type { AppColors } from '../theme';
import { AnimatedStudyBoltLogo } from './StudyBoltBrand';

export type LoadingVariant = 'initialLaunch' | 'documentProcessing' | 'flashcardGeneration' | 'quizGeneration' | 'studyCastGeneration' | 'aiTutorThinking' | 'screenLoading' | 'inlineLoading';

export function StudyBoltLoading({ variant = 'screenLoading', colors, message, detail, progress, compact = false, onCancel, cancelLabel = 'Cancel' }: {
  variant?: LoadingVariant;
  colors: AppColors;
  message: string;
  detail?: string;
  /** Confirmed progress only, from 0 to 1. Omit for indeterminate requests. */
  progress?: number;
  compact?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const percent = typeof progress === 'number' && Number.isFinite(progress) && progress >= 0 && progress <= 1 ? Math.round(progress * 100) : undefined;
  useEffect(() => {
    if (Platform.OS === 'ios' && !compact) AccessibilityInfo.announceForAccessibility(message);
  }, [compact, message]);

  return (
    <View style={[styles.container, compact && styles.inline]}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={message} accessibilityValue={percent === undefined ? { text: 'In progress' } : { min: 0, max: 100, now: percent }} accessibilityLiveRegion="polite" accessibilityState={{ busy: true }} aria-busy style={[styles.status, compact && styles.inline]}>
        {variant === 'initialLaunch' ? <AnimatedStudyBoltLogo /> : <LoadingArtwork variant={variant} colors={colors} compact={compact} />}
        <View style={compact ? styles.inlineCopy : styles.copy}>
          <Text style={[styles.message, compact && styles.compactMessage, { color: colors.text }]}>{message}{percent === undefined ? '' : ` · ${percent}%`}</Text>
          {detail ? <Text style={[styles.detail, { color: colors.textSecondary }]}>{detail}</Text> : null}
        </View>
        {percent !== undefined ? <View style={[styles.track, { backgroundColor: colors.border }]}><View style={{ width: `${percent}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 3 }} /></View> : null}
      </View>
      {onCancel ? <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}><Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>{cancelLabel}</Text></Pressable> : null}
    </View>
  );
}

/** Decorative motion, never a measurement of generated audio or backend work. */
export function LoadingArtwork({ variant = 'inlineLoading', colors, compact = false }: { variant?: LoadingVariant; colors: AppColors; compact?: boolean }) {
  const { phase } = useLoadingMotion();
  const simple = compact || variant === 'inlineLoading' || variant === 'screenLoading' || variant === 'aiTutorThinking';
  if (simple) return (
    <View accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dots}>
      {[0, 1, 2].map((index) => <Animated.View key={index} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, opacity: phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: index === 1 ? [0.85, 0.4, 0.85] : [0.4, 0.85, 0.4] }), transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: index === 1 ? [-1, 1] : [1, -1] }) }] }} />)}
    </View>
  );
  if (variant === 'studyCastGeneration') return (
    <View accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.art, { backgroundColor: colors.primarySoft }]}>
      <View style={styles.wave}>
        {[14, 25, 34, 22, 14].map((height, index) => <Animated.View key={index} style={{ width: 4, height, borderRadius: 3, backgroundColor: colors.primary, transform: [{ scaleY: phase.interpolate({ inputRange: [0, 1], outputRange: index % 2 ? [0.65, 1] : [1, 0.65] }) }] }} />)}
      </View>
    </View>
  );
  return (
    <View accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.art, { backgroundColor: colors.primarySoft }]}>
      <Animated.View style={[styles.paper, { borderColor: colors.border, backgroundColor: colors.card, transform: [{ rotate: '-9deg' }, { translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [1, -1] }) }] }]} />
      <Animated.View style={{ transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }}>
        <Svg width={44} height={48} viewBox="0 0 44 48" fill="none">
          <Rect x="5" y="3" width="34" height="42" rx="7" fill={colors.card} stroke={colors.primary} strokeWidth="1.5" />
          {variant === 'quizGeneration' ? <><Path d="m12 17 2 2 4-5m-6 17 2 2 4-5M23 17h8M23 31h8" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></> : <Path d="M13 15h18M13 23h15M13 31h11" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" />}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 12, alignSelf: 'stretch' },
  status: { alignItems: 'center', alignSelf: 'stretch', gap: 14 },
  copy: { alignSelf: 'stretch', alignItems: 'center', gap: 5 },
  message: { fontSize: 16, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  detail: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineCopy: { flex: 1 },
  compactMessage: { fontSize: 14, lineHeight: 21, textAlign: 'left' },
  art: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  paper: { position: 'absolute', width: 34, height: 42, borderWidth: 1, borderRadius: 7, left: 15, top: 16 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 22, height: 22 },
  track: { height: 4, alignSelf: 'stretch', borderRadius: 3, overflow: 'hidden' },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
});
