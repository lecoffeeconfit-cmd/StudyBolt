import React, { useEffect, useId, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useReducedMotion } from '../hooks/useReducedMotion';
import type { AppColors } from '../theme';

const NATIVE_MOTION = Platform.OS !== 'web';
const WAVE_PATTERNS = [
  [0.22, 0.5, 0.8, 0.4, 0.22],
  [0.42, 0.9, 0.5, 0.7, 0.42],
  [0.7, 0.45, 1, 0.6, 0.7],
  [0.48, 0.85, 0.35, 0.95, 0.48],
  [0.24, 0.55, 0.8, 0.45, 0.24],
];

/** A quiet welcome when paused; decorative sound bars accompany playback. */
export const StudyCastArtwork = React.memo(function StudyCastArtwork({ playing, colors, visible = true }: {
  playing: boolean; colors: AppColors; visible?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const breath = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const activity = useRef(new Animated.Value(playing ? 1 : 0)).current;
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const moving = visible && foreground && !reducedMotion;
  const dark = colors.mode === 'dark';

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    breath.setValue(0);
    if (!moving) return;
    const float = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_MOTION, isInteraction: false }),
      Animated.timing(breath, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_MOTION, isInteraction: false }),
    ]), { iterations: playing ? -1 : 3 });
    float.start();
    return () => float.stop();
  }, [breath, moving, playing]);

  useEffect(() => {
    const fade = Animated.timing(activity, {
      toValue: playing ? 1 : 0, duration: moving ? 350 : 0,
      useNativeDriver: NATIVE_MOTION, isInteraction: false,
    });
    fade.start();
    if (!playing || !moving) {
      const settle = Animated.timing(wave, { toValue: 0, duration: moving ? 300 : 0, useNativeDriver: NATIVE_MOTION, isInteraction: false });
      settle.start();
      return () => { fade.stop(); settle.stop(); };
    }
    wave.setValue(0);
    const sound = Animated.loop(Animated.timing(wave, {
      toValue: 1, duration: 1700, easing: Easing.linear,
      useNativeDriver: NATIVE_MOTION, isInteraction: false,
    }));
    sound.start();
    return () => { fade.stop(); sound.stop(); };
  }, [activity, moving, playing, wave]);

  return (
    <View testID="studycast-artwork" accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.canvas}>
      <Svg style={styles.layer} width="100%" height="100%" viewBox="0 0 280 200" fill="none">
        <Defs>
          <RadialGradient id={`${id}-aura`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop stopColor={dark ? '#4F8F88' : '#C7F1E4'} stopOpacity={dark ? '0.35' : '0.7'} />
            <Stop offset="1" stopColor={dark ? '#4F8F88' : '#C7F1E4'} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="140" cy="110" rx="126" ry="85" fill={`url(#${id}-aura)`} />
        <Path d="M76 69c13-32 53-44 85-30 27 12 50 39 48 70-2 39-37 62-74 58-42-5-75-58-59-98Z" fill={dark ? '#294758' : '#E0EEFF'} />
        <Circle cx="201" cy="57" r="17" fill={dark ? '#66562D' : '#FFF0B7'} />
        <Ellipse cx="140" cy="177" rx="66" ry="6" fill={colors.primary} opacity={dark ? '0.12' : '0.08'} />
        <Path d="M71 43v7m-3.5-3.5h7" stroke={colors.gold} strokeWidth="2" strokeLinecap="round" />
        <Circle cx="220" cy="153" r="3" fill={colors.mint} opacity="0.65" />
        <Circle cx="57" cy="147" r="2" fill={colors.primary} opacity="0.3" />
      </Svg>

      {[false, true].map((right) => WAVE_PATTERNS.map((pattern, index) => (
        <Animated.View key={`${right}-${index}`} style={[
          styles.soundBar,
          {
            left: `${((right ? 229 + index * 8 : 16 + index * 8) / 280) * 100}%`,
            backgroundColor: right ? colors.primary : colors.mint,
            opacity: activity.interpolate({ inputRange: [0, 1], outputRange: [dark ? 0.35 : 0.24, 0.75] }),
            transform: [{ scaleY: wave.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: right ? WAVE_PATTERNS[4 - index]! : pattern }) }],
          },
        ]} />
      )))}

      <Animated.View style={[styles.layer, { transform: [{ translateY: breath.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] }) }] }]}>
        <Svg width="100%" height="100%" viewBox="0 0 280 200" fill="none">
          <Defs>
            <LinearGradient id={`${id}-blue`} x1="98" y1="49" x2="180" y2="145" gradientUnits="userSpaceOnUse">
              <Stop stopColor="#8FC6FF" /><Stop offset="0.5" stopColor="#4D9AF1" /><Stop offset="1" stopColor="#3275CC" />
            </LinearGradient>
            <LinearGradient id={`${id}-cover`} x1="91" y1="122" x2="196" y2="173" gradientUnits="userSpaceOnUse">
              <Stop stopColor="#75B5FF" /><Stop offset="1" stopColor="#377EE0" />
            </LinearGradient>
            <LinearGradient id={`${id}-paper`} x1="93" y1="116" x2="147" y2="167" gradientUnits="userSpaceOnUse">
              <Stop stopColor="#FFFEF7" /><Stop offset="1" stopColor="#F4EBD3" />
            </LinearGradient>
            <LinearGradient id={`${id}-gold`} x1="130" y1="69" x2="151" y2="124" gradientUnits="userSpaceOnUse">
              <Stop stopColor="#FFE989" /><Stop offset="0.55" stopColor="#FFD052" /><Stop offset="1" stopColor="#F3AF34" />
            </LinearGradient>
          </Defs>
          <Path d="M94 106V86a46 46 0 0 1 92 0v20" stroke="#1F65AF" strokeOpacity="0.12" strokeWidth="13" strokeLinecap="round" transform="translate(0 3)" />
          <Path d="M94 106V86a46 46 0 0 1 92 0v20" stroke={`url(#${id}-blue)`} strokeWidth="10" strokeLinecap="round" />
          <Path d="M104 65a40 40 0 0 1 57-17" stroke="#E2F2FF" strokeOpacity="0.8" strokeWidth="2.5" strokeLinecap="round" />
          <Rect x="86" y="96" width="19" height="37" rx="9.5" fill="#3172C2" />
          <Rect x="89" y="97" width="15" height="31" rx="7.5" fill={`url(#${id}-blue)`} />
          <Rect x="98" y="102" width="7" height="23" rx="3.5" fill={dark ? '#99E1CB' : '#B5EDDB'} />
          <Rect x="175" y="96" width="19" height="37" rx="9.5" fill="#3172C2" />
          <Rect x="176" y="97" width="15" height="31" rx="7.5" fill={`url(#${id}-blue)`} />
          <Rect x="175" y="102" width="7" height="23" rx="3.5" fill={dark ? '#99E1CB' : '#B5EDDB'} />
          <Path d="m149 70-25 34q-2 3 2 3h14l-5 22q-1 4 2 1l25-34q2-3-2-3h-15l6-22q1-4-2-1Z" fill="#B47819" opacity="0.13" transform="translate(0 3)" />
          <Path d="m149 70-25 34q-2 3 2 3h14l-5 22q-1 4 2 1l25-34q2-3-2-3h-15l6-22q1-4-2-1Z" fill={`url(#${id}-gold)`} stroke="#E6AD37" strokeWidth="0.8" strokeLinejoin="round" />
          <Path d="m146 78-18 25h15" stroke="#FFF4BD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M75 121c25-7 47-2 65 9 18-11 40-16 65-9v45c-25-5-46-1-65 10-19-11-40-15-65-10v-45Z" fill={`url(#${id}-cover)`} />
          <Path d="M80 119c23-5 44-1 60 11 16-12 37-16 60-11v42c-23-4-44 0-60 11-16-11-37-15-60-11v-42Z" fill="#D3E4F6" />
          <Path d="M81 115c22-4 43 0 59 12v41c-17-11-37-15-59-10v-43Z" fill={`url(#${id}-paper)`} />
          <Path d="M140 127c16-12 37-16 59-12v43c-22-5-42-1-59 10v-41Z" fill="#FFFEF7" />
          <Path d="M140 129v37" stroke="#E8DCC3" strokeWidth="1.3" strokeLinecap="round" />
          <Path d="M92 128c12-1 24 2 35 7m-35 3c12-1 24 2 35 7m-35 3c8-1 17 1 24 4m38-17c11-5 23-8 35-7m-35 17c11-5 23-8 35-7m-35 17c8-4 17-6 25-6" stroke="#D6CBAE" strokeWidth="2.8" strokeLinecap="round" opacity="0.65" />
          <Path d="M164 119v17l5-4 5 1v-17" fill={dark ? '#87D6BE' : '#7BD4B3'} />
          <Path d="m214 78 2.4 6.2 6.3 2.4-6.3 2.4L214 95l-2.4-6-6.2-2.4 6.2-2.4L214 78Z" fill={colors.goldBright} />
          <Rect x="42" y="68" width="31" height="28" rx="10" fill={dark ? '#315663' : '#FFFFFF'} stroke={dark ? '#50827F' : '#D1EAE4'} strokeWidth="0.8" />
          <Path d="M50 80v5m5-9v13m5-10v7m5-5v3" stroke={colors.mint} strokeWidth="2.3" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  canvas: { width: '100%', maxWidth: 252, aspectRatio: 280 / 200, marginBottom: 0, pointerEvents: 'none' },
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  soundBar: { position: 'absolute', width: 3, height: '15%', top: '43%', borderRadius: 3 },
});
