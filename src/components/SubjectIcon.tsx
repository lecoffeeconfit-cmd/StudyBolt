import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { getSubjectIcon, type SubjectIconId } from '../data/subjectIcons';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useStudyBolt } from '../StudyBoltContext';

const INK = '#29385B';

function Face({ x = 32, y = 35, wide = false }: { x?: number; y?: number; wide?: boolean }) {
  return (
    <G>
      <Ellipse cx={x - 9} cy={y + 3} rx="3" ry="1.8" fill="#F193A3" opacity="0.55" />
      <Ellipse cx={x + 9} cy={y + 3} rx="3" ry="1.8" fill="#F193A3" opacity="0.55" />
      <Ellipse cx={x - 5} cy={y} rx="1.35" ry="1.8" fill={INK} />
      <Ellipse cx={x + 5} cy={y} rx="1.35" ry="1.8" fill={INK} />
      <Path d={wide ? `M${x - 3.5} ${y + 4} Q${x} ${y + 10} ${x + 3.5} ${y + 4} Z` : `M${x - 3} ${y + 4} Q${x} ${y + 7.5} ${x + 3} ${y + 4}`} fill={wide ? INK : 'none'} stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
    </G>
  );
}

function Character({ kind }: { kind: SubjectIconId }) {
  switch (kind) {
    case 'biology':
      return <G>
        <Path d="M32 33V19" stroke="#32956D" strokeWidth="2.6" strokeLinecap="round" />
        <Path d="M31 27C17 29 15 17 16 15C27 13 33 18 31 27Z" fill="#78D6A0" stroke="#32956D" strokeWidth="1.8" />
        <Path d="M32 22C31 12 40 10 47 12C47 21 41 26 32 25" fill="#4FC18D" stroke="#32956D" strokeWidth="1.8" />
        <Path d="M20 20L30 26M35 22L41 17" stroke="#32956D" strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M19 33H45L42 50Q32 55 22 50Z" fill="#F3B77D" stroke="#C88855" strokeWidth="1.8" />
        <Rect x="17" y="29" width="30" height="7" rx="3" fill="#FFD2A2" stroke="#C88855" strokeWidth="1.8" />
        <Face y={40} wide />
      </G>;
    case 'chemistry':
      return <G>
        <Path d="M26 12H38M28 13V26L17 44Q13 52 23 53H41Q51 52 47 44L36 26V13" fill="#F3FAFF" stroke="#5286BA" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <Path d="M23 35Q30 32 36 35Q39 37 41 35L46 45Q49 51 41 51H23Q16 51 19 45Z" fill="#71CFD6" />
        <Path d="M23 29L20 35" stroke="#FFF" strokeWidth="2.8" strokeLinecap="round" />
        <Circle cx="31" cy="21" r="2" fill="#8FBAF2" /><Circle cx="40" cy="8" r="3" fill="#9AC4F7" /><Circle cx="23" cy="7" r="1.7" fill="#69C7C7" />
        <Face y={40} wide />
      </G>;
    case 'psychology':
      return <G>
        <Path d="M32 15C26 8 18 12 18 19C10 19 9 29 14 33C10 41 17 49 24 47C28 53 35 51 38 47C47 50 54 40 49 33C55 25 49 18 44 19C44 11 36 9 32 15Z" fill="#F7B3CC" stroke="#CF759B" strokeWidth="2" />
        <Path d="M32 16V26M21 19Q19 25 24 27M43 20Q45 25 41 28M16 34L20 32M45 34L49 35M24 44L24 47M39 44L38 47" stroke="#DC8DAD" strokeWidth="2" fill="none" strokeLinecap="round" />
        <Path d="M24 16Q27 14 29 17" stroke="#FFDDE9" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <Face y={34} wide />
      </G>;
    case 'medicine':
      return <G>
        <Path d="M29 24L26 14L32 12L36 23M35 25L39 14L44 17L40 28" fill="#F3A2AA" stroke="#C96077" strokeWidth="2" strokeLinejoin="round" />
        <Path d="M32 28C20 14 9 26 16 39C21 47 28 51 32 54C39 50 50 40 50 32C50 21 38 19 32 28Z" fill="#F28E9C" stroke="#C96077" strokeWidth="2" />
        <Path d="M21 28Q18 30 19 34" stroke="#FFD9DC" strokeWidth="3" fill="none" strokeLinecap="round" />
        <Face y={35} wide />
      </G>;
    case 'physics':
      return <G>
        <Ellipse cx="32" cy="32" rx="24" ry="10" fill="none" stroke="#A18BE4" strokeWidth="2" transform="rotate(-35 32 32)" />
        <Ellipse cx="32" cy="32" rx="24" ry="10" fill="none" stroke="#A18BE4" strokeWidth="2" transform="rotate(35 32 32)" />
        <Ellipse cx="32" cy="32" rx="10" ry="24" fill="none" stroke="#A18BE4" strokeWidth="2" />
        <Circle cx="32" cy="32" r="12" fill="#C8BAFA" stroke="#8671CA" strokeWidth="1.8" />
        <Circle cx="49" cy="18" r="3.8" fill="#FFD16D" stroke="#E3AA48" strokeWidth="1.5" />
        <Circle cx="11" cy="26" r="3.3" fill="#88D7D3" />
        <Face y={30} />
      </G>;
    case 'math':
      return <G>
        <Rect x="17" y="10" width="32" height="44" rx="8" fill="#FFD37D" stroke="#D5A14F" strokeWidth="2" transform="rotate(-5 33 32)" />
        <Rect x="22" y="15" width="22" height="9" rx="3" fill="#FFF4CF" transform="rotate(-5 33 20)" />
        <Path d="M27 16V22M24 19H30M35 18H40M35 21H40" stroke="#AD813D" strokeWidth="1.6" strokeLinecap="round" />
        <Face y={32} wide />
        <Rect x="23" y="44" width="5" height="4" rx="1.5" fill="#E6AF54" /><Rect x="31" y="44" width="5" height="4" rx="1.5" fill="#E6AF54" /><Rect x="39" y="43" width="5" height="4" rx="1.5" fill="#E6AF54" />
      </G>;
    case 'computing':
      return <G>
        <Rect x="13" y="14" width="38" height="30" rx="6" fill="#84B7F2" stroke="#517DB3" strokeWidth="2" />
        <Rect x="17" y="18" width="30" height="22" rx="3" fill="#E6F7FF" />
        <Path d="M13 43L8 50Q8 53 13 53H51Q56 53 56 50L51 43Z" fill="#ACCFFA" stroke="#517DB3" strokeWidth="2" strokeLinejoin="round" />
        <Path d="M26 48H38" stroke="#6C96C9" strokeWidth="2.6" strokeLinecap="round" />
        <Path d="M22 23L19 26L22 29M42 23L45 26L42 29" stroke="#71A9DC" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Face y={28} />
      </G>;
    case 'literature':
    case 'general':
      return <G>
        <Path d="M10 17Q22 12 32 19Q42 12 54 17V48Q42 44 32 51Q22 44 10 48Z" fill={kind === 'general' ? '#94B8F5' : '#C7A5E9'} stroke={kind === 'general' ? '#618BC7' : '#9776BE'} strokeWidth="2" strokeLinejoin="round" />
        <Path d="M14 15Q24 13 32 20Q41 13 50 15V44Q39 42 32 48Q24 42 14 44Z" fill="#FFFBF1" />
        <Path d="M32 20V47M18 21L26 23M38 23L46 21" stroke="#DDD8EC" strokeWidth="1.7" strokeLinecap="round" />
        <Face y={31} wide />
        <Path d="M43 15V28L47 25L51 27V14" fill="#F5BC6A" />
      </G>;
    case 'history':
      return <G>
        <Path d="M12 23L32 10L52 23Z" fill="#F6D4A6" stroke="#BF9565" strokeWidth="2" strokeLinejoin="round" />
        <Rect x="12" y="24" width="40" height="5" rx="2" fill="#E9BC85" />
        <Path d="M18 29V47M27 29V47M37 29V47M46 29V47" stroke="#E6BE90" strokeWidth="5" strokeLinecap="round" />
        <Rect x="11" y="47" width="42" height="6" rx="2.5" fill="#F6D4A6" stroke="#BF9565" strokeWidth="1.8" />
        <Face y={19} />
      </G>;
    case 'geography':
      return <G>
        <Path d="M22 50H43M32 46V51M45 12Q60 29 44 45Q37 52 22 45" stroke="#70A2AD" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <Circle cx="31" cy="29" r="20" fill="#91D5ED" stroke="#529BB5" strokeWidth="2" />
        <Path d="M17 16L26 13L28 20L24 25L18 24L16 30L12 28Q11 21 17 16M40 13L44 21L39 25L43 30L48 32L47 40L40 43L36 35L39 28L34 23Z" fill="#73C99C" />
        <Face x={30} y={29} wide />
      </G>;
    case 'languages':
      return <G>
        <Path d="M35 16H47Q54 16 54 23V34Q54 40 48 40V46L41 40H36" fill="#F8C884" stroke="#D6A05C" strokeWidth="1.8" strokeLinejoin="round" />
        <Path d="M18 12H36Q45 12 45 21V33Q45 42 36 42H26L17 49V41Q10 40 10 33V21Q10 12 18 12Z" fill="#B5C4F6" stroke="#859AD0" strokeWidth="2" strokeLinejoin="round" />
        <Path d="M18 20H30M18 24H25" stroke="#EFF2FF" strokeWidth="2.2" strokeLinecap="round" />
        <Face x={28} y={29} wide />
      </G>;
    case 'art':
      return <G>
        <Path d="M51 31C55 16 37 8 25 13C10 17 7 32 15 44C22 55 37 54 39 47C41 41 32 40 37 35C41 31 48 39 51 31Z" fill="#FFE6BA" stroke="#CDA66C" strokeWidth="2" />
        <Circle cx="20" cy="28" r="3.5" fill="#F29BB0" /><Circle cx="27" cy="19" r="3.5" fill="#88CEC0" /><Circle cx="39" cy="20" r="3.5" fill="#AFA2ED" /><Circle cx="46" cy="27" r="3" fill="#87B6ED" />
        <Face x={25} y={37} />
        <Path d="M40 50L52 30" stroke="#BE8BCA" strokeWidth="5" strokeLinecap="round" />
        <Path d="M50 32Q48 25 56 21Q58 29 53 33Z" fill="#8C79CF" />
      </G>;
    case 'music':
      return <G>
        <Path d="M25 39V16L48 11V35" fill="none" stroke="#9780CE" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M26 22L47 17" stroke="#B4A0E9" strokeWidth="5" />
        <Ellipse cx="20" cy="42" rx="10" ry="9" fill="#BBA5EE" stroke="#9780CE" strokeWidth="1.8" transform="rotate(-15 20 42)" />
        <Ellipse cx="43" cy="38" rx="10" ry="9" fill="#F5B4CF" stroke="#CF87AD" strokeWidth="1.8" transform="rotate(-15 43 38)" />
        <G transform="translate(7 22) scale(.65)"><Face x={20} y={28} /></G>
        <G transform="translate(30 18) scale(.65)"><Face x={20} y={28} /></G>
      </G>;
    case 'business':
      return <G>
        <Rect x="12" y="12" width="40" height="41" rx="8" fill="#F1FCF3" stroke="#78AD91" strokeWidth="2" />
        <Path d="M20 30L29 24L36 27L45 18M39 18H45V24" stroke="#54B48D" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="19" y="28" width="5" height="5" rx="1.5" fill="#B5E0BF" /><Rect x="28" y="28" width="5" height="5" rx="1.5" fill="#8BD0A5" /><Rect x="37" y="27" width="5" height="6" rx="1.5" fill="#6CC397" />
        <Face y={39} wide />
      </G>;
    case 'engineering':
      return <G>
        <Path d="M32 12V18M30 12H34" stroke="#6E98B0" strokeWidth="2" strokeLinecap="round" />
        <Circle cx="32" cy="10" r="3" fill="#F4C86C" />
        <Rect x="11" y="27" width="6" height="13" rx="3" fill="#87AFC1" /><Rect x="47" y="27" width="6" height="13" rx="3" fill="#87AFC1" />
        <Rect x="16" y="19" width="32" height="32" rx="9" fill="#AED5E4" stroke="#6E98B0" strokeWidth="2" />
        <Rect x="21" y="25" width="22" height="17" rx="5" fill="#EAF8FA" />
        <Face y={30} />
        <Path d="M27 46H37" stroke="#6E98B0" strokeWidth="2" strokeLinecap="round" />
      </G>;
  }
}

/** Small, expressive vector characters that stay crisp at every class-card size. */
export const SubjectIcon = memo(function SubjectIcon({
  subject,
  emoji,
  size = 48,
  animated = true,
}: {
  subject?: string;
  emoji?: string;
  size?: number;
  animated?: boolean;
}) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const icon = getSubjectIcon(subject, emoji);
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    bounce.setValue(0);
    if (!animated || reducedMotion) return;
    // A single hello keeps long class lists calm and avoids idle animation work.
    const animation = Animated.sequence([
      Animated.delay(100),
      Animated.timing(bounce, { toValue: 1, duration: 760, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animated, bounce, icon.id, reducedMotion]);

  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        pointerEvents: 'none',
        transform: animated && !reducedMotion ? [
          { translateY: bounce.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0, -size * 0.07, size * 0.02, 0] }) },
          { rotate: bounce.interpolate({ inputRange: [0, 0.3, 0.65, 1], outputRange: ['0deg', '-7deg', '3deg', '0deg'] }) },
          { scale: bounce.interpolate({ inputRange: [0, 0.3, 0.65, 1], outputRange: [1, 1.06, 0.98, 1] }) },
        ] : [],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect x="1" y="1" width="62" height="62" rx="20" fill={colors.mode === 'dark' ? icon.dark : icon.light} />
        <Path d="M9 22Q9 9 22 9" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" opacity={colors.mode === 'dark' ? 0.12 : 0.7} />
        <Ellipse cx="33" cy="55" rx="16" ry="2.5" fill={icon.color} opacity="0.12" />
        <Character kind={icon.id} />
        <Path d="M53 8L54.5 11.5L58 13L54.5 14.5L53 18L51.5 14.5L48 13L51.5 11.5Z" fill="#F2C363" />
        <Circle cx="9" cy="44" r="1.7" fill={icon.color} opacity="0.6" />
      </Svg>
    </Animated.View>
  );
});
