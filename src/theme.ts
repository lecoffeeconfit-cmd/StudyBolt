import type { ColorSchemeName } from 'react-native';

import type { ThemePreference } from './models';

export interface AppColors {
  mode: 'light' | 'dark';
  background: string;
  backgroundRaised: string;
  card: string;
  cardStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  primaryText: string;
  gold: string;
  goldBright: string;
  goldSoft: string;
  goldText: string;
  onGold: string;
  mint: string;
  mintSoft: string;
  border: string;
  shadow: string;
  danger: string;
  warning: string;
  purple: string;
  purpleSoft: string;
  tabBar: string;
}

const light: AppColors = {
  mode: 'light',
  background: '#F7F9FD',
  backgroundRaised: '#FFFFFF',
  card: '#FFFFFF',
  cardStrong: '#F0F5FF',
  text: '#111C4E',
  textSecondary: '#536080',
  textMuted: '#5E6D87',
  primary: '#1268D9',
  primarySoft: '#E9F2FF',
  primaryText: '#FFFFFF',
  gold: '#C47C00',
  goldBright: '#FFCB3D',
  goldSoft: '#FFF4C2',
  goldText: '#8A5A00',
  onGold: '#382500',
  mint: '#127E63',
  mintSoft: '#E3F8F2',
  border: '#E4EAF4',
  shadow: '#243B76',
  danger: '#BE364D',
  warning: '#966100',
  purple: '#6846CF',
  purpleSoft: '#EFEAFF',
  tabBar: '#FFFFFF',
};

const dark: AppColors = {
  mode: 'dark',
  // Low-chroma, stepped surfaces reduce large luminance jumps in a dim room.
  // Text stays comfortably above WCAG AA without using pure white on black.
  background: '#0E1217',
  backgroundRaised: '#121820',
  card: '#171F28',
  cardStrong: '#1D2833',
  text: '#E8EDF2',
  textSecondary: '#BBC4CD',
  textMuted: '#909DAC',
  primary: '#7AA8F5',
  primarySoft: '#1A2B42',
  primaryText: '#0A111B',
  gold: '#F4C44E',
  goldBright: '#FFD45E',
  goldSoft: '#3A2E12',
  goldText: '#F4C44E',
  onGold: '#2C1D00',
  mint: '#78C9AE',
  mintSoft: '#16352E',
  border: '#344250',
  shadow: '#000000',
  danger: '#EF8D95',
  warning: '#DDB96E',
  purple: '#AC9DDD',
  purpleSoft: '#29263A',
  tabBar: '#111820',
};

export function resolveColors(preference: ThemePreference, system: ColorSchemeName): AppColors {
  const selected = preference === 'system' ? system : preference;
  return selected === 'dark' ? dark : light;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
};

/** Shared text roles; keep platform fonts and system text scaling. */
export const typography = {
  pageTitle: { fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.65 },
  sectionTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700', letterSpacing: -0.2 },
  cardTitle: { fontSize: 16, lineHeight: 23, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23 },
  secondary: { fontSize: 14, lineHeight: 21 },
  caption: { fontSize: 12, lineHeight: 18 },
  control: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  metric: { fontSize: 28, lineHeight: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
} as const;
