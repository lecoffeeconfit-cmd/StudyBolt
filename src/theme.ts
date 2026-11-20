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
  neon?: {
    name: string;
    edge: string;
    glow: string;
    secondarySoft: string;
    progressTrack: string;
    progressFill: string;
    progressHighlight: string;
  };
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

// Calendar order: January to December. Seasonal accents are separate from
// success, warning, and error colors so that feedback keeps its meaning.
const seasonalAccents = [
  { name: 'Winter Frost', primary: '#8BD8FF', secondary: '#B7A7FF', highlight: '#BDEDFF' },
  { name: "Valentine's", primary: '#FFA2D7', secondary: '#C2ACFC', highlight: '#FF7291' },
  { name: 'Emerald', primary: '#B3F582', secondary: '#42DA99', highlight: '#72FFB0' },
  { name: 'Spring Bloom', primary: '#FCAAE4', secondary: '#BDAAFF', highlight: '#A3DFFF' },
  { name: 'Spring Glow', primary: '#67F0C8', secondary: '#51DDE2', highlight: '#FCE17E' },
  { name: 'Summer Solstice', primary: '#FFE175', secondary: '#FFAB93', highlight: '#FFC16B' },
  { name: 'Fireworks', primary: '#8BB8FF', secondary: '#FF7596', highlight: '#E1EDFF' },
  { name: 'Electric Summer', primary: '#6BE6FF', secondary: '#43E2CA', highlight: '#FFAD73' },
  { name: 'Autumn', primary: '#FFC275', secondary: '#FF9B70', highlight: '#FFE08A' },
  { name: 'Halloween', primary: '#FFAD67', secondary: '#B69BFF', highlight: '#BDE89A' },
  { name: 'Harvest', primary: '#F6CB82', secondary: '#F8A381', highlight: '#EB788D' },
  { name: 'Holiday Lights', primary: '#91D8FF', secondary: '#64DE9E', highlight: '#FF778F' },
] as const;

const neonBase = {
  mode: 'dark',
  background: '#090E1A',
  backgroundRaised: '#0F1728',
  card: '#131D30',
  cardStrong: '#1A2740',
  text: '#EFF4FF',
  textSecondary: '#C0CDE4',
  textMuted: '#A2B0CA',
  primaryText: '#0A111F',
  gold: '#E9BD63',
  goldBright: '#FFE18C',
  goldSoft: '#30271B',
  goldText: '#FFDA8A',
  onGold: '#241907',
  mint: '#75E1B9',
  mintSoft: '#12362F',
  shadow: '#020510',
  danger: '#FFA1AE',
  warning: '#F3C579',
  purple: '#C3B3FF',
  purpleSoft: '#282040',
  tabBar: '#11192B',
} satisfies Omit<AppColors, 'primary' | 'primarySoft' | 'border' | 'neon'>;

function mixHex(base: string, accent: string, amount: number): string {
  const channels = [1, 3, 5].map(offset => {
    const from = Number.parseInt(base.slice(offset, offset + 2), 16);
    const to = Number.parseInt(accent.slice(offset, offset + 2), 16);
    return Math.round(from + (to - from) * amount).toString(16).padStart(2, '0');
  });
  return '#' + channels.join('');
}

const monthlyNeonColors: readonly AppColors[] = seasonalAccents.map(({ name, primary, secondary, highlight }) => ({
  ...neonBase,
  primary,
  primarySoft: mixHex(neonBase.card, primary, 0.14),
  border: mixHex('#29364C', primary, 0.12),
  neon: {
    name,
    edge: mixHex('#24314A', secondary, 0.42),
    glow: highlight,
    secondarySoft: mixHex(neonBase.card, secondary, 0.16),
    progressTrack: '#293953',
    progressFill: mixHex(primary, highlight, 0.16),
    progressHighlight: '#EFF4FF55',
  },
}));

export function nextThemePreference(preference: ThemePreference, system: ColorSchemeName): Exclude<ThemePreference, 'system'> {
  if (preference === 'neon') return 'light';
  const visibleMode = preference === 'system' ? system : preference;
  return visibleMode === 'dark' ? 'neon' : 'dark';
}

export function resolveColors(preference: ThemePreference, system: ColorSchemeName, localMonth?: number): AppColors {
  if (preference === 'neon') return monthlyNeonColors[localMonth ?? new Date().getMonth()] ?? dark;
  const selected = preference === 'system' ? system : preference;
  return selected === 'dark' ? dark : light;
}

export function seasonalThemeCheckDelay(now: Date): number {
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  // Recheck the local clock after at most a minute to catch timezone or clock changes.
  return Math.min(60_000, Math.max(1, nextMonth.getTime() - now.getTime()));
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
