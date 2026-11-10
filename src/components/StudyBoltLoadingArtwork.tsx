import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { useLoadingMotion } from '../hooks/useLoadingMotion';
import type { AppColors } from '../theme';
import type { LoadingVariant } from './StudyBoltLoading';

type Phase = Animated.Value;
type Palette = ReturnType<typeof paletteFor>;
function paletteFor(colors: AppColors) {
  const dark = colors.mode === 'dark';
  return {
    blue: dark ? '#80B3F3' : '#326FC3',
    cover: dark ? '#416FA9' : '#417FCD',
    deep: dark ? '#28486D' : '#24569E',
    mist: dark ? '#1C3049' : '#E7F1FF',
    paper: dark ? '#25394F' : '#FFFFFF',
    page: dark ? '#B7CEE9' : '#D9E8FA',
    yellow: dark ? '#F1C85C' : '#F5C34D',
    yellowSoft: dark ? '#493E25' : '#FFF0BD',
    shadow: dark ? '#101C2C' : '#DDE8F6',
  };
}

/** Decorative illustrations only; their movement never represents measured progress. */
export const LoadingArtwork = React.memo(function LoadingArtwork({ variant = 'inlineLoading', colors, compact = false }: {
  variant?: LoadingVariant; colors: AppColors; compact?: boolean;
}) {
  const { phase } = useLoadingMotion();
  const palette = paletteFor(colors);
  if (compact || variant === 'inlineLoading' || variant === 'screenLoading') return <KnowledgePulse phase={phase} blue={colors.primary} yellow={colors.goldBright} />;
  return (
    <View testID={`loading-art-${variant}`} accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={variant === 'aiTutorThinking' ? styles.thinking : styles.scene}>
      {variant === 'aiTutorThinking' ? <ThinkingGraphic phase={phase} p={palette} /> : <>
        <Backdrop p={palette} />
        {variant === 'flashcardGeneration' ? <CardsGraphic phase={phase} p={palette} />
          : variant === 'quizGeneration' ? <QuizGraphic phase={phase} p={palette} />
            : variant === 'studyCastGeneration' ? <AudioGraphic phase={phase} p={palette} />
              : <BookGraphic phase={phase} p={palette} />}
      </>}
    </View>
  );
});

function KnowledgePulse({ phase, blue, yellow }: { phase: Phase; blue: string; yellow: string }) {
  return <View accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dots}>
    {[0, 1, 2].map((index) => <Animated.View key={index} style={{ width: index === 1 ? 5 : 4, height: index === 1 ? 5 : 4, borderRadius: 3, backgroundColor: index === 1 ? yellow : blue, opacity: phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: index === 1 ? [0.65, 1, 0.65] : [0.9, 0.45, 0.9] }), transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: index === 1 ? [-1.5, 1.5] : [1.5, -1.5] }) }] }} />)}
  </View>;
}

function Backdrop({ p }: { p: Palette }) {
  return <Svg style={styles.layer} width="160" height="124" viewBox="0 0 160 124" fill="none">
    <Ellipse cx="80" cy="60" rx="65" ry="47" fill={p.mist} />
    <Circle cx="124" cy="28" r="16" fill={p.yellowSoft} />
    <Ellipse cx="80" cy="111" rx="44" ry="4" fill={p.shadow} />
    <Path d="M22 37v6m-3-3h6M137 77v5m-2.5-2.5h5" stroke={p.yellow} strokeWidth="1.5" strokeLinecap="round" />
    <Circle cx="30" cy="84" r="2" fill={p.blue} opacity="0.35" />
  </Svg>;
}

function BookGraphic({ phase, p }: { phase: Phase; p: Palette }) {
  return <>
    <Animated.View style={[styles.layer, { transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }]}>
      <Svg width="160" height="124" viewBox="0 0 160 124" fill="none">
        <Path d="m27 65 48 5 8 33c-21-12-41-10-58-9-4 0-5-4-3-7Z" fill={p.deep} />
        <Path d="m133 65-48 5-8 33c21-12 41-10 58-9 4 0 5-4 3-7Z" fill={p.cover} />
        <Path d="M80 99c-15-12-34-14-52-11l8-37c19-2 33 4 44 15Z" fill={p.paper} stroke={p.page} />
        <Path d="M80 99c15-12 34-14 52-11l-8-37c-19-2-33 4-44 15Z" fill={p.paper} stroke={p.page} />
        <Path d="M80 68v30M42 63c12 1 22 5 28 10M39 73c11 1 21 4 29 9M91 74c9-6 18-9 27-10M92 83c8-4 17-7 28-8" stroke={p.page} strokeWidth="2" strokeLinecap="round" />
        <Path d="M80 100c-18-11-35-11-52-8M80 100c18-11 35-11 52-8" stroke={p.yellow} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    </Animated.View>
    <Animated.View style={[styles.layer, { opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }), transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [1, -3] }) }] }]}>
      <Svg width="160" height="124" viewBox="0 0 160 124" fill="none"><Circle cx="83" cy="42" r="20" fill={p.yellowSoft} /><Path d="m88 22-22 26h14l-5 18 23-28H84Z" fill={p.yellow} stroke={p.yellow} strokeLinejoin="round" /></Svg>
    </Animated.View>
    <Animated.View style={[styles.note, { backgroundColor: p.paper, borderColor: p.page, transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [2, -2] }) }, { rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '-6deg'] }) }] }]}>
      <View style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: p.yellow }} /><View style={[styles.noteLine, { backgroundColor: p.page }]} /><View style={[styles.noteLine, { backgroundColor: p.page, width: 9 }]} />
    </Animated.View>
  </>;
}

function CardsGraphic({ phase, p }: { phase: Phase; p: Palette }) {
  return <>
    <Animated.View style={[styles.cardBack, { backgroundColor: p.cover, transform: [{ rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ['-13deg', '-9deg'] }) }, { translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [1, -2] }) }] }]} />
    <Animated.View style={[styles.cardMiddle, { backgroundColor: p.yellowSoft, borderColor: p.yellow, transform: [{ rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ['9deg', '5deg'] }) }] }]} />
    <Animated.View style={[styles.cardFront, { backgroundColor: p.paper, borderColor: p.blue, transform: [{ perspective: 500 }, { rotateY: phase.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) }, { translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [-1, 1] }) }] }]}>
      <View style={[styles.cardTab, { backgroundColor: p.yellow }]} />
      <Svg width="32" height="25" viewBox="0 0 32 25" fill="none"><Path d="M6 5h20M6 12h16M6 19h12" stroke={p.blue} strokeWidth="2" strokeLinecap="round" /></Svg>
      <View style={{ width: 16, height: 2, backgroundColor: p.page, borderRadius: 1, marginTop: 4 }} />
    </Animated.View>
  </>;
}

function QuizGraphic({ phase, p }: { phase: Phase; p: Palette }) {
  return <Animated.View style={[styles.layer, { transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [1.5, -1.5] }) }, { rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ['-1deg', '1deg'] }) }] }]}>
    <Svg width="160" height="124" viewBox="0 0 160 124" fill="none">
      <Rect x="45" y="17" width="72" height="88" rx="13" fill={p.paper} stroke={p.blue} strokeWidth="1.5" />
      <Rect x="58" y="12" width="44" height="12" rx="5" fill={p.cover} />
      <Path d="M59 37h29M59 43h41" stroke={p.page} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="61" cy="58" r="4" stroke={p.blue} strokeWidth="1.5" /><Path d="M73 58h26" stroke={p.page} strokeWidth="2" strokeLinecap="round" />
      <Rect x="53" y="70" width="55" height="22" rx="7" fill={p.yellowSoft} />
      <Circle cx="62" cy="81" r="5" fill={p.yellow} /><Path d="M74 81h24" stroke={p.blue} strokeWidth="2" strokeLinecap="round" />
    </Svg>
    <Animated.View style={[styles.quizCheck, { backgroundColor: p.yellow, opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }), transform: [{ scale: phase.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}><Svg width="18" height="18" viewBox="0 0 18 18"><Path d="m4 9 3 3 7-7" fill="none" stroke={p.deep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Svg></Animated.View>
  </Animated.View>;
}

function AudioGraphic({ phase, p }: { phase: Phase; p: Palette }) {
  return <>
    <Svg style={styles.layer} width="160" height="124" viewBox="0 0 160 124" fill="none">
      <Rect x="28" y="30" width="104" height="68" rx="21" fill={p.paper} stroke={p.page} />
      <Path d="M42 38c6-14 20-23 38-23s32 9 38 23" stroke={p.blue} strokeWidth="3" strokeLinecap="round" />
      <Rect x="28" y="52" width="9" height="25" rx="4.5" fill={p.cover} /><Rect x="123" y="52" width="9" height="25" rx="4.5" fill={p.cover} />
      <Circle cx="123" cy="23" r="8" fill={p.yellow} />
    </Svg>
    <View style={styles.wave}>
      {[16, 28, 39, 27, 42, 25, 15].map((height, index) => <Animated.View key={index} style={{ width: 5, height, borderRadius: 3, backgroundColor: index % 2 ? p.yellow : p.blue, transform: [{ scaleY: phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: index % 2 ? [0.6, 1, 0.75] : [1, 0.65, 0.9] }) }] }} />)}
    </View>
  </>;
}

function ThinkingGraphic({ phase, p }: { phase: Phase; p: Palette }) {
  return <>
    <Svg width="80" height="64" viewBox="0 0 80 64" fill="none"><Path d="M22 10h34c10 0 15 6 15 16v6c0 10-5 15-15 15H40L27 57l2-10h-7C12 47 7 42 7 32v-6c0-10 5-16 15-16Z" fill={p.mist} /><Circle cx="66" cy="13" r="7" fill={p.yellowSoft} /><Path d="m66 8-4 6h4l-1 5 5-7h-4l1-4Z" fill={p.yellow} /></Svg>
    <View style={styles.thinkingDots}><KnowledgePulse phase={phase} blue={p.blue} yellow={p.yellow} /></View>
  </>;
}

const styles = StyleSheet.create({
  scene: { width: 160, height: 124, alignSelf: 'center' },
  layer: { position: 'absolute', top: 0, left: 0, width: 160, height: 124 },
  thinking: { width: 80, height: 64, alignSelf: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 22, height: 22 },
  note: { position: 'absolute', top: 25, left: 25, width: 25, height: 32, padding: 5, gap: 4, borderRadius: 5, borderWidth: 1 },
  noteLine: { width: 13, height: 2, borderRadius: 1 },
  cardBack: { position: 'absolute', width: 67, height: 75, borderRadius: 11, left: 37, top: 25 },
  cardMiddle: { position: 'absolute', width: 67, height: 75, borderRadius: 11, borderWidth: 1, left: 53, top: 24 },
  cardFront: { position: 'absolute', width: 67, height: 75, borderRadius: 11, borderWidth: 1.5, left: 46, top: 26, padding: 12, alignItems: 'center', justifyContent: 'center' },
  cardTab: { position: 'absolute', right: 9, top: -1, width: 11, height: 13, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  quizCheck: { position: 'absolute', left: 103, top: 74, width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', top: 44, left: 45, width: 70, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  thinkingDots: { position: 'absolute', left: 26, top: 20 },
});
