import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';

// Rounded, eight-tooth silhouette on a 32-point grid.
const GEAR = 'M12.99 7.27 Q13.59 7.02 13.75 6.39 L14.17 4.75 Q14.33 4.12 14.98 4.12 L17.02 4.12 Q17.67 4.12 17.83 4.75 L18.25 6.39 Q18.41 7.02 19.01 7.27 L20.05 7.70 Q20.65 7.95 21.21 7.61 L22.66 6.75 Q23.22 6.42 23.68 6.88 L25.12 8.32 Q25.58 8.78 25.25 9.34 L24.39 10.79 Q24.05 11.35 24.30 11.95 L24.73 12.99 Q24.98 13.59 25.61 13.75 L27.25 14.17 Q27.88 14.33 27.88 14.98 L27.88 17.02 Q27.88 17.67 27.25 17.83 L25.61 18.25 Q24.98 18.41 24.73 19.01 L24.30 20.05 Q24.05 20.65 24.39 21.21 L25.25 22.66 Q25.58 23.22 25.12 23.68 L23.68 25.12 Q23.22 25.58 22.66 25.25 L21.21 24.39 Q20.65 24.05 20.05 24.30 L19.01 24.73 Q18.41 24.98 18.25 25.61 L17.83 27.25 Q17.67 27.88 17.02 27.88 L14.98 27.88 Q14.33 27.88 14.17 27.25 L13.75 25.61 Q13.59 24.98 12.99 24.73 L11.95 24.30 Q11.35 24.05 10.79 24.39 L9.34 25.25 Q8.78 25.58 8.32 25.12 L6.88 23.68 Q6.42 23.22 6.75 22.66 L7.61 21.21 Q7.95 20.65 7.70 20.05 L7.27 19.01 Q7.02 18.41 6.39 18.25 L4.75 17.83 Q4.12 17.67 4.12 17.02 L4.12 14.98 Q4.12 14.33 4.75 14.17 L6.39 13.75 Q7.02 13.59 7.27 12.99 L7.70 11.95 Q7.95 11.35 7.61 10.79 L6.75 9.34 Q6.42 8.78 6.88 8.32 L8.32 6.88 Q8.78 6.42 9.34 6.75 L10.79 7.61 Q11.35 7.95 11.95 7.70 Z';
const NATIVE = Platform.OS !== 'web';

/** A sculpted StudyBolt gear: the mechanism turns while its bolt stays upright. */
export function SettingsTabGlyph({ color, accent, active, reducedMotion, size = 27, mode = 'light', interacting = false, activation = 0 }: {
  color: string;
  accent: string;
  active: boolean;
  reducedMotion: boolean;
  size?: number;
  mode?: 'light' | 'dark';
  interacting?: boolean;
  activation?: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const turn = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const highlighted = active || interacting;
  const dark = mode === 'dark';
  const bodyId = 'settings-body-' + id;
  const boltId = 'settings-bolt-' + id;
  const bodyTop = highlighted ? (dark ? '#90B9F4' : '#6EB6FF') : (dark ? '#8D9DB7' : '#8B9EBD');
  const bodyBottom = highlighted ? (dark ? '#9A89D6' : '#7960D9') : (dark ? '#74839F' : '#7182A2');
  const hub = highlighted ? (dark ? '#1B2740' : '#223769') : (dark ? '#202C3C' : '#E9EFF8');

  useEffect(() => {
    turn.stopAnimation();
    shimmer.stopAnimation();
    turn.setValue(0);
    shimmer.setValue(0);
    if (reducedMotion || !highlighted) return;

    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(turn, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE, isInteraction: false }),
        Animated.spring(turn, { toValue: 0, damping: 11, stiffness: 190, mass: 0.65, useNativeDriver: NATIVE, isInteraction: false }),
      ]),
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 210, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE, isInteraction: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 540, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE, isInteraction: false }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [activation, highlighted, reducedMotion, shimmer, turn]);

  return (
    <View accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={styles.layer}>
        <Ellipse cx="16" cy="28.4" rx="7.4" ry="1.2" fill={color} opacity={dark ? 0.13 : 0.09} />
        <Circle cx="16" cy="16" r="13.9" fill={color} opacity={highlighted ? 0.07 : 0.025} />
      </Svg>
      <Animated.View style={[styles.layer, { opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }), transform: [{ scale: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.05] }) }] }]}>
        <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <Path d="M4.5 11.5a12.5 12.5 0 0 1 7-7M27.5 20.5a12.5 12.5 0 0 1-7 7" stroke={bodyTop} strokeWidth="1" strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, { transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '32deg'] }) }] }]}>
        <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <Defs>
            <LinearGradient id={bodyId} x1="7" y1="4" x2="25" y2="28" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={bodyTop} />
              <Stop offset="0.48" stopColor={highlighted ? (dark ? '#7A9BE0' : '#4E8AE8') : bodyTop} />
              <Stop offset="1" stopColor={bodyBottom} />
            </LinearGradient>
          </Defs>
          <Path d={GEAR} fill={'url(#' + bodyId + ')'} stroke={highlighted ? (dark ? '#BCCDF1' : '#4775C3') : color} strokeWidth="0.65" strokeLinejoin="round" strokeOpacity={highlighted ? 0.7 : 0.55} />
          <Path d="M10.8 9.6a8.3 8.3 0 0 1 10.4 0" stroke={dark ? '#D5E2F8' : '#DFEEFF'} strokeWidth="0.9" strokeLinecap="round" opacity={highlighted ? 0.6 : 0.35} />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={styles.layer}>
        <Defs>
          <LinearGradient id={boltId} x1="14" y1="11" x2="18" y2="21" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={highlighted ? '#FFE8A1' : color} />
            <Stop offset="1" stopColor={highlighted ? accent : color} />
          </LinearGradient>
        </Defs>
        <Circle cx="16" cy="16.6" r="6.4" fill={dark ? '#101A30' : '#355294'} opacity="0.3" />
        <Circle cx="16" cy="16" r="6.35" fill={hub} stroke={highlighted ? '#B5D5FF' : bodyBottom} strokeWidth="0.9" />
        <Path d="M12.1 13.1a4.9 4.9 0 0 1 7.8 0" stroke={highlighted ? '#CADFFF' : color} strokeWidth="0.65" strokeLinecap="round" opacity="0.3" />
        <Path d="m17 10.9-4.6 6h3.1l-.7 4.2 4.8-6.3h-3.1l.5-3.9Z" fill={'url(#' + boltId + ')'} stroke={highlighted ? '#E5BB56' : color} strokeWidth="0.35" strokeLinejoin="round" />
        {highlighted ? <>
          <Path d="m27.5 3.2.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7Z" fill={accent} />
          <Circle cx="4.1" cy="23.9" r="0.8" fill={bodyTop} opacity="0.8" />
        </> : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } });
