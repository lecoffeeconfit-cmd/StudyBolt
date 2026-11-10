import React, { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppColors } from '../theme';
import { AnimatedStudyBoltLogo } from './StudyBoltBrand';
import { LoadingArtwork } from './StudyBoltLoadingArtwork';
export { LoadingArtwork } from './StudyBoltLoadingArtwork';

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

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 12, alignSelf: 'stretch' },
  status: { alignItems: 'center', alignSelf: 'stretch', gap: 14 },
  copy: { alignSelf: 'stretch', alignItems: 'center', gap: 5 },
  message: { fontSize: 16, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  detail: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineCopy: { flex: 1 },
  compactMessage: { fontSize: 14, lineHeight: 21, textAlign: 'left' },
  track: { height: 4, alignSelf: 'stretch', borderRadius: 3, overflow: 'hidden' },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
});
