import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { resolveColors } from '../theme';
import { AnimatedStudyBoltLogo, LAUNCH_LOGO_HEIGHT, LAUNCH_LOGO_SIZE } from './StudyBoltBrand';
import { LoadingArtwork } from './StudyBoltLoading';

/** A single cold-launch overlay. Readiness can interrupt every entrance effect. */
export function StudyBoltLaunch({ ready, onFinished }: { ready: boolean; onFinished: () => void }) {
  const colors = resolveColors('system', useColorScheme());
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const title = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ready && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility('Opening your StudyBolt study space.');
  }, [ready]);

  useEffect(() => {
    if (reducedMotion) { title.setValue(1); return; }
    const animation = Animated.timing(title, { toValue: 1, duration: 320, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, title]);

  useEffect(() => {
    if (!ready) return;
    if (reducedMotion) { onFinished(); return; }
    const exit = Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    exit.start(({ finished }) => { if (finished) onFinished(); });
    return () => exit.stop();
  }, [onFinished, opacity, ready, reducedMotion]);

  return (
    <Animated.View aria-hidden={ready} accessibilityElementsHidden={ready} importantForAccessibility={ready ? 'no-hide-descendants' : 'auto'} style={[styles.overlay, { backgroundColor: colors.background, opacity }]}>
      <StatusBar style={colors.mode === 'dark' ? 'light' : 'dark'} />
      <View style={styles.logo}><AnimatedStudyBoltLogo /></View>
      <Animated.View style={[styles.copy, { opacity: title }]}>
        <Text style={[styles.title, { color: colors.text }]}>StudyBolt</Text>
        <View accessible={false} aria-hidden style={styles.accent}><View style={[styles.accentBlue, { backgroundColor: colors.primary }]} /><View style={styles.accentGold} /></View>
        <Text style={[styles.message, { color: colors.textSecondary }]} accessibilityLiveRegion="polite" accessibilityRole="progressbar" accessibilityState={{ busy: !ready }}>Getting your study space ready…</Text>
        <LoadingArtwork colors={colors} variant="inlineLoading" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, pointerEvents: 'none' },
  logo: { position: 'absolute', top: '50%', left: '50%', marginLeft: -LAUNCH_LOGO_SIZE / 2, marginTop: -LAUNCH_LOGO_HEIGHT / 2 },
  copy: { position: 'absolute', top: '50%', marginTop: LAUNCH_LOGO_HEIGHT / 2 + 31, left: 24, right: 24, alignItems: 'center', gap: 9 },
  title: { fontSize: 29, lineHeight: 36, letterSpacing: -0.9, fontWeight: '800' },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  accent: { flexDirection: 'row', gap: 3, marginBottom: 2 },
  accentBlue: { width: 27, height: 2, borderRadius: 1, opacity: 0.55 },
  accentGold: { width: 13, height: 2, borderRadius: 1, backgroundColor: '#D9AC48', opacity: 0.8 },
});
