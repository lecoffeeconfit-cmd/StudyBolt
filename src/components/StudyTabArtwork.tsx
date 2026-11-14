import React, { memo, useEffect, useId, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type StudyTabArtworkName = 'home' | 'library' | 'planner' | 'stats';

type Props = {
  name: StudyTabArtworkName;
  active: boolean;
  reducedMotion: boolean;
  accent: string;
  size?: number;
  mode?: 'light' | 'dark';
};

const NATIVE = Platform.OS !== 'web';

function artworkPalette(active: boolean, dark: boolean, accent: string) {
  return {
    light: active ? (dark ? '#9DC9FA' : '#8FC7FF') : (dark ? '#9EADC4' : '#B0BFD3'),
    shade: active ? (dark ? '#527DBD' : '#4881D5') : (dark ? '#647792' : '#778BAB'),
    edge: active ? (dark ? '#96B8E9' : '#3B65A3') : (dark ? '#879AB7' : '#667D9F'),
    paper: active ? (dark ? '#DAEBFF' : '#F3F9FF') : (dark ? '#CED8E8' : '#EEF3F9'),
    paperShade: active ? (dark ? '#92B2DA' : '#C1DFFF') : (dark ? '#90A1BB' : '#C5D3E4'),
    ink: active ? (dark ? '#253F65' : '#325583') : (dark ? '#344760' : '#465D7D'),
    gold: active ? accent : (dark ? '#9BAAC1' : '#A1B2CA'),
    goldEdge: active ? '#976319' : (dark ? '#455876' : '#7389A8'),
    highlight: '#F4F9FF',
    shadow: dark ? '#070D19' : '#284477',
  };
}

type Palette = ReturnType<typeof artworkPalette>;

// All art uses the Settings icon's 32-unit grid and the existing 27-point slot.
export const StudyTabArtwork = memo(function StudyTabArtwork({
  name, active, reducedMotion, accent, size = 27, mode = 'light',
}: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const bodyId = 'study-tab-body-' + id;
  const paperId = 'study-tab-paper-' + id;
  const body = 'url(#' + bodyId + ')';
  const paper = 'url(#' + paperId + ')';
  const palette = artworkPalette(active, mode === 'dark', accent);
  const progress = useRef(new Animated.Value(1)).current;
  const wasActive = useRef(active);

  useEffect(() => {
    const justSelected = active && !wasActive.current;
    wasActive.current = active;
    if (!justSelected || reducedMotion) {
      progress.setValue(1);
      return;
    }

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 300,
      easing: Easing.linear,
      useNativeDriver: NATIVE,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, progress, reducedMotion]);

  const settle = {
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.6, -0.8, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.96, 1.035, 1] }) },
    ],
  };
  const detailStyle = name === 'library'
    ? { transform: [{ scaleX: progress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0.82, 1.025, 1] }) }] }
    : name === 'stats'
      ? {
          transformOrigin: '50% 78%',
          transform: [{ scaleY: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.74, 1.025, 1] }) }],
        }
      : {
          opacity: progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.7, 1, 1] }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.93, 1.04, 1] }) }],
        };

  return (
    <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Animated.View style={reducedMotion || name === 'stats' ? undefined : settle}>
        <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <Defs>
            <LinearGradient id={bodyId} x1="7" y1="4" x2="24" y2="27" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={palette.light} />
              <Stop offset="1" stopColor={palette.shade} />
            </LinearGradient>
            <LinearGradient id={paperId} x1="8" y1="8" x2="25" y2="26" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={palette.paper} />
              <Stop offset="1" stopColor={palette.paperShade} />
            </LinearGradient>
          </Defs>
          <Ellipse cx="16" cy="28.25" rx="8" ry="1.05" fill={palette.shadow} opacity=".13" />
          {name === 'home' ? <House palette={palette} body={body} paper={paper} /> : null}
          {name === 'library' ? <Book palette={palette} body={body} paper={paper} /> : null}
          {name === 'planner' ? <Calendar palette={palette} body={body} paper={paper} /> : null}
          {name === 'stats' ? <Path d="M4.7 25.5h22.6" stroke={palette.edge} strokeWidth="1.75" strokeLinecap="round" /> : null}
        </Svg>
        <Animated.View style={[styles.detail, !reducedMotion && detailStyle]}>
          <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
            {name === 'home' ? (
              <G>
                <Rect x="17.2" y="16.1" width="5.2" height="5.3" rx="1.2" fill={palette.gold} stroke={palette.goldEdge} strokeWidth=".7" />
                <Path d="M18.5 17.5h2.6M19.8 17.5v2.6" stroke={palette.paper} strokeWidth=".68" opacity=".85" strokeLinecap="round" />
              </G>
            ) : null}
            {name === 'library' ? <BookPage palette={palette} /> : null}
            {name === 'planner' ? (
              <G>
                <Rect x="17.1" y="16.5" width="7.2" height="6.8" rx="1.7" fill={palette.gold} />
                <Path d="m18.8 19.9 1.3 1.3 2.5-2.7" stroke={palette.ink} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
              </G>
            ) : null}
            {name === 'stats' ? <Bars palette={palette} /> : null}
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
});

function House({ palette, body, paper }: { palette: Palette; body: string; paper: string }) {
  return (
    <G>
      <Path d="M21 10V6.3q0-.9.9-.9h1.6q.9 0 .9.9v7" fill={palette.shade} stroke={palette.edge} strokeWidth=".7" />
      <Path d="M6.3 13.6 16 6l9.7 7.6v9.8q0 3.2-3.2 3.2h-13q-3.2 0-3.2-3.2Z" fill={paper} stroke={palette.edge} strokeWidth=".8" />
      <Path d="m3.9 12.6 10.4-8.4q1.7-1.4 3.4 0l10.4 8.4a1.55 1.55 0 0 1-1.9 2.45L16 7.1 5.8 15.05a1.55 1.55 0 0 1-1.9-2.45Z" fill={body} stroke={palette.edge} strokeWidth=".7" strokeLinejoin="round" />
      <Path d="m6 12.8 9-7.2q1-.8 2 0l4.1 3.3" stroke={palette.highlight} strokeWidth=".85" strokeLinecap="round" opacity=".7" />
      <Path d="M10.1 26v-6.7a2.45 2.45 0 0 1 4.9 0V26Z" fill={palette.shade} stroke={palette.edge} strokeWidth=".65" />
    </G>
  );
}

function Book({ palette, body, paper }: { palette: Palette; body: string; paper: string }) {
  return (
    <G>
      <Path d="M3.6 8.5q5.9-2.8 12.4 1.25Q22.5 5.7 28.4 8.5v15.3q-6.2-1.35-12.4 3.1-6.2-4.45-12.4-3.1Z" fill={body} stroke={palette.edge} strokeWidth="1" strokeLinejoin="round" />
      <Path d="M5.2 6.4q5.4-2 10.8 1.8v15.6q-5.6-3.7-10.8-2.25Z" fill={paper} stroke={palette.edge} strokeWidth=".75" strokeLinejoin="round" />
      <Path d="M7.5 10.5q2.9-.6 5.9 1.3M7.5 14q2.9-.6 5.9 1.3" stroke={palette.ink} strokeWidth="1" opacity=".65" strokeLinecap="round" />
      <Path d="M6.6 22.9q4.45-.95 9.4 2.4 4.95-3.35 9.4-2.4" stroke={palette.highlight} strokeWidth=".75" opacity=".55" strokeLinecap="round" />
    </G>
  );
}

function BookPage({ palette }: { palette: Palette }) {
  return (
    <G>
      <Path d="M16 8.2q5.4-3.8 10.8-1.8v15.15q-5.2-1.45-10.8 2.25Z" fill={palette.paper} stroke={palette.edge} strokeWidth=".75" strokeLinejoin="round" />
      <Path d="M18.5 13.1q2.8-1.55 5.9-1.05m-5.9 4.3q2.8-1.55 5.9-1.05" stroke={palette.ink} strokeWidth="1" opacity=".65" strokeLinecap="round" />
      <Path d="M21.4 6.15q1.45-.35 3-.18v6l-1.5-1-1.5 1.25Z" fill={palette.gold} stroke={palette.goldEdge} strokeWidth=".45" strokeLinejoin="round" />
    </G>
  );
}

function Calendar({ palette, body, paper }: { palette: Palette; body: string; paper: string }) {
  return (
    <G>
      <Rect x="4.4" y="6.9" width="23.2" height="19.8" rx="4" fill={palette.shade} stroke={palette.edge} strokeWidth=".8" />
      <Rect x="4.4" y="6.2" width="23.2" height="19" rx="4" fill={paper} stroke={palette.edge} strokeWidth=".8" />
      <Path d="M4.4 10.2q0-4 4-4h15.2q4 0 4 4v2.55H4.4Z" fill={body} stroke={palette.edge} strokeWidth=".65" />
      <Path d="M10.2 4.6v3.9m11.6-3.9v3.9" stroke={palette.ink} strokeWidth="2.1" strokeLinecap="round" />
      <Path d="M7 11h18" stroke={palette.highlight} strokeWidth=".7" opacity=".5" strokeLinecap="round" />
      <Circle cx="9.5" cy="16.7" r="1.15" fill={palette.ink} opacity=".62" />
      <Circle cx="13.9" cy="16.7" r="1.15" fill={palette.ink} opacity=".62" />
      <Circle cx="9.5" cy="21.2" r="1.15" fill={palette.ink} opacity=".62" />
      <Circle cx="13.9" cy="21.2" r="1.15" fill={palette.ink} opacity=".62" />
    </G>
  );
}

function Bars({ palette }: { palette: Palette }) {
  return (
    <G>
      <Rect x="6" y="16.6" width="5.2" height="8.4" rx="1.35" fill={palette.paperShade} stroke={palette.edge} strokeWidth=".8" />
      <Rect x="13.4" y="11.1" width="5.2" height="13.9" rx="1.35" fill={palette.shade} stroke={palette.edge} strokeWidth=".8" />
      <Rect x="20.8" y="5.5" width="5.2" height="19.5" rx="1.35" fill={palette.gold} stroke={palette.goldEdge} strokeWidth=".8" />
      <Path d="M7.5 18.55h2.2m5.2-5.5h2.2m5.2-5.6h2.2" stroke={palette.highlight} strokeWidth=".85" strokeLinecap="round" opacity=".85" />
    </G>
  );
}

const styles = StyleSheet.create({
  detail: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
