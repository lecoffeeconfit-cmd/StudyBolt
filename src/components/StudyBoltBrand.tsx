import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import artwork from '../config/launchArtwork.json';
import { useLoadingMotion } from '../hooks/useLoadingMotion';

// Display masks crop the background around the approved artwork; its pixels stay intact.
export const STUDYBOLT_LOGO = require('../../assets/icon.png');
export const LAUNCH_LOGO_SIZE = artwork.displayWidth;
export const LAUNCH_LOGO_HEIGHT = LAUNCH_LOGO_SIZE * artwork.height / artwork.width;
const TRAIL = [[750, 187], [577, 293], [388, 389], [704, 436], [966, 531], [637, 631], [278, 720], [720, 827], [1100, 937], [930, 1040], [774, 1094]];

export const AnimatedStudyBoltLogo = React.memo(function AnimatedStudyBoltLogo({ size = LAUNCH_LOGO_SIZE }: { size?: number }) {
  const { phase, moving } = useLoadingMotion();
  const reveal = useRef(new Animated.Value(1)).current;
  const travel = useRef(new Animated.Value(0)).current;
  const entered = useRef(false);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const scale = size / artwork.width;
  const height = artwork.height * scale;

  useEffect(() => {
    if (!moving) { reveal.setValue(1); return; }
    if (entered.current) return;
    entered.current = true;
    reveal.setValue(0);
    const animation = Animated.timing(reveal, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [moving, reveal]);

  useEffect(() => {
    travel.setValue(0);
    if (!moving) return;
    const animation = Animated.loop(Animated.timing(travel, { toValue: 1, duration: 4600, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false }));
    animation.start();
    return () => animation.stop();
  }, [moving, travel]);

  return (
    <View accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ pointerEvents: 'none', width: size, height }}>
      <Animated.View style={{ position: 'absolute', width: size * 1.7, height: size * 1.55, left: -size * 0.35, top: -size * 0.28, opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] }), transform: [{ rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) }] }}>
        <Svg width="100%" height="100%" viewBox="0 0 320 296" fill="none">
          <Defs>
            <RadialGradient id={`${id}-blue`} cx="50%" cy="50%" rx="50%" ry="50%"><Stop stopColor="#40B7FF" stopOpacity="0.3" /><Stop offset="1" stopColor="#40B7FF" stopOpacity="0" /></RadialGradient>
            <RadialGradient id={`${id}-gold`} cx="50%" cy="50%" rx="50%" ry="50%"><Stop stopColor="#FFD565" stopOpacity="0.26" /><Stop offset="1" stopColor="#FFD565" stopOpacity="0" /></RadialGradient>
            <LinearGradient id={`${id}-trail`} x1="20" y1="200" x2="292" y2="190" gradientUnits="userSpaceOnUse"><Stop stopColor="#3A9DFF" stopOpacity="0" /><Stop offset="0.3" stopColor="#40C9F4" stopOpacity="0.8" /><Stop offset="0.72" stopColor="#E9BB4D" stopOpacity="0.7" /><Stop offset="1" stopColor="#E9BB4D" stopOpacity="0" /></LinearGradient>
          </Defs>
          <Circle cx="115" cy="150" r="110" fill={`url(#${id}-blue)`} />
          <Circle cx="220" cy="169" r="100" fill={`url(#${id}-gold)`} />
          <Path d="M23 183C9 242 260 280 299 188" stroke={`url(#${id}-trail)`} strokeWidth="1.5" strokeLinecap="round" />
          <Path d="M35 118C61 59 245 47 285 103" stroke={`url(#${id}-trail)`} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
          <Path d="M34 198C67 248 259 254 290 203" stroke={`url(#${id}-trail)`} strokeWidth="0.8" opacity="0.45" />
        </Svg>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }, { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }] }}>
        <View style={{ width: size, height, borderRadius: artwork.radius * scale, overflow: 'hidden' }}>
          <Image source={STUDYBOLT_LOGO} defaultSource={STUDYBOLT_LOGO} fadeDuration={0} resizeMode="stretch" style={{ position: 'absolute', width: artwork.sourceWidth * scale, height: artwork.sourceHeight * scale, left: -artwork.x * scale, top: -artwork.y * scale }} />
          {/* Light on the existing artwork; this flattened logo is never split into moving pieces. */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.add(phase.interpolate({ inputRange: [0, 1], outputRange: [0.02, 0.09] }), reveal.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.24, 0] })) }]}>
            <Svg width="100%" height="100%" viewBox={`${artwork.x} ${artwork.y} ${artwork.width} ${artwork.height}`} fill="none">
              <Path d="M752 185 645 503 806 465 548 816 608 578 441 624Z" fill="#FFF6A4" />
              <Path d="M750 187C648 282 354 316 388 389C422 464 1027 371 966 531C925 639 239 599 278 720C305 813 1118 799 1100 937C1089 1019 848 1080 774 1094" stroke="#D8FAFF" strokeWidth="7" strokeLinecap="round" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.travelLight, { opacity: travel.interpolate({ inputRange: [0, 0.06, 0.88, 1], outputRange: [0, 0.8, 0.7, 0] }), transform: [
            { translateX: travel.interpolate({ inputRange: TRAIL.map((_, index) => index / (TRAIL.length - 1)), outputRange: TRAIL.map((point) => (point[0]! - artwork.x) * scale) }) },
            { translateY: travel.interpolate({ inputRange: TRAIL.map((_, index) => index / (TRAIL.length - 1)), outputRange: TRAIL.map((point) => (point[1]! - artwork.y) * scale) }) },
          ] }]} />
        </View>
      </Animated.View>
      {[{ x: -0.15, y: 0.2, color: '#54B9F1' }, { x: 1.12, y: 0.77, color: '#D7A639' }].map((star, index) => (
        <Animated.View key={index} style={{ position: 'absolute', left: size * star.x - 5, top: height * star.y - 5, opacity: phase.interpolate({ inputRange: [0, 1], outputRange: index ? [0.35, 0.7] : [0.7, 0.35] }), transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: index ? [2, -2] : [-2, 2] }) }] }}>
          <Svg width="10" height="10" viewBox="0 0 10 10"><Path d="m5 0 1.2 3.8L10 5 6.2 6.2 5 10 3.8 6.2 0 5l3.8-1.2Z" fill={star.color} /></Svg>
        </Animated.View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  travelLight: { position: 'absolute', left: -2, top: -2, width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF8C2', shadowColor: '#56DAFF', shadowOpacity: 0.8, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
});
