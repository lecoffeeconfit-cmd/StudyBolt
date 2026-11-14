import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { SettingsTabGlyph } from './SettingsTabGlyph';
import { StudyTabArtwork } from './StudyTabArtwork';

export type StudyTabGlyphName = 'home' | 'library' | 'planner' | 'stats' | 'discover' | 'profile';
export type PriorityGlyphName = 'due' | 'weak' | 'mistakes';

/** Crisp, font-free navigation illustrations with a small selection response. */
type StudyTabGlyphProps = {
  name: StudyTabGlyphName;
  color: string;
  accent: string;
  active: boolean;
  reducedMotion: boolean;
  size?: number;
  mode?: 'light' | 'dark';
  interacting?: boolean;
  activation?: number;
};

export function StudyTabGlyph(props: StudyTabGlyphProps) {
  const { name } = props;
  if (name === 'profile') return <SettingsTabGlyph {...props} />;
  if (name === 'discover') return <NavigationGlyph {...props} />;
  return <StudyTabArtwork {...props} name={name} />;
}

function NavigationGlyph({ name, color, accent, active, reducedMotion, size = 27 }: StudyTabGlyphProps) {
  const selection = useRef(new Animated.Value(active ? 1 : 0)).current;
  const flourish = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    selection.stopAnimation();
    flourish.stopAnimation();
    if (reducedMotion) {
      selection.setValue(active ? 1 : 0);
      flourish.setValue(0);
      return;
    }

    const settle = Animated.spring(selection, {
      toValue: active ? 1 : 0,
      damping: 15,
      stiffness: 280,
      mass: 0.65,
      useNativeDriver: Platform.OS !== 'web',
    });
    settle.start();

    if (active && name === 'discover') {
      const turn = Animated.sequence([
        Animated.timing(flourish, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(flourish, { toValue: 0, damping: 8, stiffness: 300, useNativeDriver: Platform.OS !== 'web' }),
      ]);
      turn.start();
    } else {
      flourish.setValue(0);
    }

    return () => {
      settle.stop();
      flourish.stopAnimation();
    };
  }, [active, flourish, name, reducedMotion, selection]);

  const scale = selection.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.07] });
  const lift = selection.interpolate({ inputRange: [0, 1], outputRange: [1, -0.7] });
  const rotation = flourish.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', name === 'discover' ? '22deg' : '-16deg'],
  });

  return (
    <Animated.View
      accessible={false}
      style={{ width: size, height: size, transform: [{ translateY: lift }, { scale }, { rotate: rotation }] }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
        {name === 'discover' ? <>
          <Circle cx="12" cy="12" r="8.7" stroke={color} strokeWidth="1.8" />
          <Path d="m15.8 8.1-2.2 5.4-5.4 2.4 2.3-5.5 5.3-2.3Z" fill={active ? accent : 'none'} opacity={active ? 0.34 : 1} stroke={active ? accent : color} strokeWidth="1.55" strokeLinejoin="round" />
          <Circle cx="12" cy="12" r="1" fill={active ? accent : color} />
          <Path d="M12 1.9v1.3m0 17.6v1.3M1.9 12h1.3m17.6 0h1.3" stroke={active ? accent : color} strokeWidth="1.45" strokeLinecap="round" />
        </> : null}
      </Svg>
    </Animated.View>
  );
}

/** Small, purpose-specific art for the three study-priority shortcuts. */
export function PriorityGlyph({ name, color, accent, size = 22 }: {
  name: PriorityGlyphName;
  color: string;
  accent: string;
  size?: number;
}) {
  return (
    <View accessible={false}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
        {name === 'due' ? <>
          <Rect x="3.5" y="4.5" width="14.5" height="16" rx="3" stroke={color} strokeWidth="1.8" />
          <Path d="M7.5 3.2v2.7m6.5-2.7v2.7M4 8.5h13.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
          <Path d="M7 11.4h3.1m-3.1 3h2" stroke={color} strokeWidth="1.45" strokeLinecap="round" opacity=".72" />
          <Circle cx="17.2" cy="16.8" r="4.2" fill={accent} stroke="white" strokeWidth="1.2" />
          <Path d="M17.2 14.4v2.5l1.5.9" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </> : null}
        {name === 'weak' ? <>
          <Path d="M12 20.6c-1.5 0-2.2-.9-2.2-2v-.7c-2.9-.9-4.9-3.5-4.9-6.4a7.1 7.1 0 0 1 14.2 0c0 2.9-2 5.5-4.9 6.4v.7c0 1.1-.7 2-2.2 2Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
          <Path d="M9.7 17.8h4.6m-4 2.8h3.4M12 6.7v7.5m0-4.2c-1.7 0-2.5-.8-2.5-2m2.5 4.5c1.5 0 2.4-.8 2.4-2" stroke={color} strokeWidth="1.45" strokeLinecap="round" />
          <Path d="M18.5 4.3v2.2m-1.1-1.1h2.2" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        </> : null}
        {name === 'mistakes' ? <>
          <Circle cx="11.5" cy="12.5" r="8.1" stroke={color} strokeWidth="1.7" />
          <Circle cx="11.5" cy="12.5" r="4.8" stroke={color} strokeWidth="1.55" opacity=".82" />
          <Circle cx="11.5" cy="12.5" r="1.65" fill={accent} />
          <Path d="M13.8 4.7a8.1 8.1 0 0 1 5.1 2.7l1.4-1.2m-1.4 1.2 1.8.2" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </> : null}
      </Svg>
    </View>
  );
}

export function ImportGlyph({ color = '#5B70B5', size = 26 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none" accessibilityElementsHidden>
      <Path d="M6.2 3.6h10.1l5.5 5.5v14.1a1.7 1.7 0 0 1-1.7 1.7H6.2a1.7 1.7 0 0 1-1.7-1.7V5.3a1.7 1.7 0 0 1 1.7-1.7Z" fill="#FFFFFF" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <Path d="M16.1 3.9v5.4h5.3M8.5 14.1h10.7" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.8 20.8v-4.9m-2.1 2.1 2.1-2.1 2.2 2.1" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
