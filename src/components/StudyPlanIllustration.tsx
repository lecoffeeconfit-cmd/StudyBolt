import React, { memo, useId } from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

/** Bundled vector artwork; its parent keeps this decorative scene out of accessibility traversal. */
export const StudyPlanIllustration = memo(function StudyPlanIllustration({ dark = false }: { dark?: boolean }) {
  const id = `study-plan-${useId().replace(/:/g, '')}`;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 230 185" accessible={false}>
      <Defs>
        <RadialGradient id={`${id}-glow`} cx="55%" cy="45%" rx="55%" ry="55%">
          <Stop offset="0" stopColor="#FFE9A3" stopOpacity={dark ? 0.08 : 0.2} />
          <Stop offset="1" stopColor="#DAD8FF" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id={`${id}-cover`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#378FF5" />
          <Stop offset="0.55" stopColor="#3459D6" />
          <Stop offset="1" stopColor="#8053D8" />
        </LinearGradient>
        <LinearGradient id={`${id}-left`} x1="0" y1="0" x2="1" y2="0.8">
          <Stop offset="0" stopColor={dark ? '#E7EDFA' : '#FFFEF8'} />
          <Stop offset="0.75" stopColor={dark ? '#DCE4F6' : '#FFF8E5'} />
          <Stop offset="1" stopColor="#CBCFEC" />
        </LinearGradient>
        <LinearGradient id={`${id}-right`} x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={dark ? '#E9E8F7' : '#FFFEF8'} />
          <Stop offset="0.75" stopColor={dark ? '#D9DCEF' : '#FFF6DC'} />
          <Stop offset="1" stopColor="#E3D9C8" />
        </LinearGradient>
        <LinearGradient id={`${id}-bolt`} x1="0" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor="#FFF1A0" />
          <Stop offset="0.48" stopColor="#FFD249" />
          <Stop offset="1" stopColor="#F5AA20" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="132" cy="80" rx="94" ry="77" fill={`url(#${id}-glow)`} />
      <Ellipse cx="116" cy="166" rx="88" ry="10" fill={dark ? '#080F24' : '#6474CC'} opacity={dark ? 0.3 : 0.12} />
      <Path d="M26 84C56 77 84 85 112 99C142 81 176 79 202 89L217 145Q220 155 208 159C173 152 143 159 116 172C88 155 54 150 22 153Q12 151 15 140Z" fill="#443AB5" opacity="0.7" />
      <Path d="M25 79C57 74 85 81 113 96C144 79 176 77 203 84L213 141Q216 150 207 152C172 147 139 152 114 166C89 151 54 145 23 147Q15 146 18 137Z" fill={`url(#${id}-cover)`} />
      <Path d="M31 76C62 73 88 84 113 98L113 158C86 141 56 136 26 140Z" fill="#B7C8F1" />
      <Path d="M113 98C142 80 171 75 198 81L206 141C169 135 142 145 113 158Z" fill="#C9C7EA" />
      <Path d="M34 65C65 64 89 76 113 91L113 151C87 134 59 128 27 132Z" fill={`url(#${id}-left)`} stroke={dark ? '#D9E2F5' : '#FFFFFF'} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M113 91C141 73 169 67 196 73L204 134C170 128 142 137 113 151Z" fill={`url(#${id}-right)`} stroke={dark ? '#D9E2F5' : '#FFFFFF'} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M113 94L113 149" stroke="#B8BAD9" strokeWidth="2" opacity="0.65" />
      <G stroke="#A2A3BA" strokeWidth="4" strokeLinecap="round" opacity="0.25">
        <Path d="M46 83Q73 83 95 98M44 96Q70 96 95 111M42 109Q69 109 95 124" />
        <Path d="M133 100Q160 86 184 88M134 113Q159 100 186 102M135 126Q161 114 188 116" />
      </G>
      <Path d="M148 17L115 67Q112 72 119 73L139 76L128 103Q126 109 132 104L174 53Q178 48 171 46L150 43L156 21Q158 11 148 17Z" fill="#DC9718" opacity="0.3" transform="translate(2 3)" />
      <Path d="M148 15L115 65Q112 70 119 71L139 74L128 101Q126 107 132 102L174 51Q178 46 171 44L150 41L156 19Q158 9 148 15Z" fill={`url(#${id}-bolt)`} stroke="#FFE788" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M147 23L121 64L143 68" fill="none" stroke="#FFF6B8" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
    </Svg>
  );
});
