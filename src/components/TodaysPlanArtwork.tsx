import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { useStudyBolt } from '../StudyBoltContext';
import { Icon } from './ui';

/** A small stack of study cards, with a single lift as the plan appears. */
export function TodaysPlanArtwork({ still, size }: { still: boolean; size: 'small' | 'medium' | 'large' }) {
  const { colors } = useStudyBolt();
  const neon = colors.neon;
  const night = colors.night;
  const darkArtwork = neon || night;
  const artworkEdge = neon?.sheetEdge ?? colors.border;
  const lift = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    lift.setValue(still ? 1 : 0);
    if (still) return;
    const animation = Animated.timing(lift, {
      toValue: 1, duration: 460, easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [lift, still]);

  return (
    <View pointerEvents="none" aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.viewport, styles[size]]}>
      <Animated.View style={[styles.scene, { opacity: lift, transform: [
        { scale: size === 'large' ? 1.35 : size === 'small' ? 0.55 : 0.86 },
        { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
      ] }]}>
        <View style={[styles.orbit, darkArtwork && { borderColor: neon?.edge ?? colors.border, backgroundColor: neon?.secondarySoft ?? colors.backgroundRaised }]} />
        <View style={[styles.backCard, darkArtwork && { borderColor: artworkEdge, backgroundColor: night?.artwork.shade ?? colors.backgroundRaised }]} />
        <LinearGradient colors={darkArtwork ? [colors.cardStrong, neon?.secondarySoft ?? colors.card] : ['#FFFFFF', '#C8DFFF']} style={[styles.frontCard, darkArtwork && { borderColor: neon?.focus ?? artworkEdge }]}>
          <View style={[styles.cardBolt, darkArtwork && { backgroundColor: colors.primarySoft }]}><Icon name="lightning-bolt" size={23} color={neon?.indicator.icon ?? (night ? colors.primary : '#16489C')} /></View>
          <View style={[styles.line, darkArtwork && { backgroundColor: artworkEdge }]} />
          <View style={[styles.line, styles.shortLine, darkArtwork && { backgroundColor: artworkEdge }]} />
        </LinearGradient>
        <LinearGradient colors={neon?.action ?? (night ? [colors.goldBright, colors.gold] : ['#FFF3B0', '#FFC641'])} style={styles.check}>
          <Icon name="check" color={neon ? colors.primaryText : night ? colors.onGold : '#573400'} size={19} />
        </LinearGradient>
        <View style={styles.spark}><Icon name="star-four-points" color={neon?.season.highlight ?? '#FFE184'} size={16} /></View>
        <View style={styles.smallSpark}><Icon name="star-four-points" color={neon?.season.secondary ?? (night ? colors.primary : '#ADCAFF')} size={9} /></View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  small: { width: 61, height: 67 },
  medium: { width: 91, height: 98 },
  large: { width: 172, height: 140 },
  scene: { width: 112, height: 110 },
  orbit: { position: 'absolute', left: 0, top: 1, width: 110, height: 106, borderRadius: 56, borderWidth: 1, borderColor: '#BCD5FF55', backgroundColor: '#7AAFFF24' },
  backCard: { position: 'absolute', top: 16, left: 29, width: 62, height: 77, borderRadius: 13, borderWidth: 1, borderColor: '#A6C7FF', backgroundColor: '#6C9FF6', transform: [{ rotate: '16deg' }] },
  frontCard: { position: 'absolute', top: 13, left: 16, width: 61, height: 76, borderRadius: 13, borderWidth: 1, borderColor: '#FFFFFFB3', padding: 9, justifyContent: 'center', gap: 5, transform: [{ rotate: '-11deg' }], boxShadow: '0px 8px 14px #071A574D' },
  cardBolt: { width: 29, height: 27, borderRadius: 8, backgroundColor: '#C3DAFF', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  line: { height: 3, borderRadius: 2, backgroundColor: '#83A7DE' },
  shortLine: { width: 23 },
  check: { position: 'absolute', top: 66, left: 67, width: 31, height: 31, borderRadius: 12, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '11deg' }], boxShadow: '0px 4px 8px #071A5755' },
  spark: { position: 'absolute', top: 6, right: 4 },
  smallSpark: { position: 'absolute', bottom: 8, left: 8 },
});
