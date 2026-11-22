import type { ColorSchemeName } from 'react-native';

import type { ThemePreference } from './models';

type SurfaceGradient = readonly [string, string];
type Appearance = Exclude<ThemePreference, 'system'>;
type NeonTab = 'home' | 'library' | 'planner' | 'stats' | 'discover' | 'profile';

const appearances = {
  light: { id: 'light', label: 'Light', icon: 'weather-sunny' },
  // Keep the stored identifier used by existing installs.
  dark: { id: 'dark', label: 'Comfort Dark', icon: 'moon-waning-crescent' },
  warmNight: { id: 'warmNight', label: 'Warm Night', icon: 'weather-night' },
  neon: { id: 'neon', label: 'Neon Mode', icon: 'creation' },
} as const satisfies { [ID in Appearance]: { id: ID; label: string; icon: string } };

export const themeOptions = [{ id: 'system', label: 'System', icon: 'cellphone' }, ...Object.values(appearances)] as const;
const nextAppearance: Record<Appearance, Appearance> = { light: 'dark', dark: 'warmNight', warmNight: 'neon', neon: 'light' };

export interface TabGlyphColors {
  light: string;
  shade: string;
  edge: string;
  paper: string;
  paperShade: string;
  ink: string;
  detail: string;
}

interface NeonTabPalette {
  active: string;
  inactive: string;
  selection: SurfaceGradient;
  edge: string;
  halo: string;
  activeGlyph: TabGlyphColors;
  inactiveGlyph: TabGlyphColors;
}

interface NeonColors {
  name: string;
  season: { primary: string; secondary: string; highlight: string };
  edge: string;
  sheetEdge: string;
  glow: string;
  secondarySoft: string;
  focus: string;
  chart: string;
  hero: SurfaceGradient;
  action: SurfaceGradient;
  progressTrack: string;
  progressFill: string;
  progressEnd: string;
  progressHighlight: string;
  indicator: { icon: string; surface: string; edge: string; halo: string };
  navigation: {
    surface: SurfaceGradient;
    rim: readonly [string, string, string, string, string];
    edge: string;
    tabs: Record<NeonTab, NeonTabPalette>;
  };
}

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
  night?: {
    hero: SurfaceGradient;
    artwork: { cover: string; shade: string };
    navigation: { activeGlyph: TabGlyphColors; inactiveGlyph: TabGlyphColors };
  };
  neon?: NeonColors;
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

const darkBase = {
  mode: 'dark',
  // Low-chroma, stepped surfaces reduce large luminance jumps in a dim room.
  // Text stays comfortably above WCAG AA without using pure white on black.
  background: '#101722',
  backgroundRaised: '#151E2A',
  card: '#1B2636',
  cardStrong: '#222F41',
  text: '#E8EDF4',
  textSecondary: '#B8C4D4',
  textMuted: '#A0ADC0',
  primary: '#92B5E8',
  primarySoft: '#283D58',
  primaryText: '#0A111B',
  gold: '#F4C44E',
  goldBright: '#FFD45E',
  goldSoft: '#3A2E12',
  goldText: '#F4C44E',
  onGold: '#2C1D00',
  mint: '#78C9AE',
  mintSoft: '#16352E',
  border: '#38475B',
  shadow: '#000000',
  danger: '#EF8D95',
  warning: '#DDB96E',
  purple: '#AC9DDD',
  purpleSoft: '#29263A',
  tabBar: '#131C28',
} satisfies AppColors;

const warmBase = {
  mode: 'dark',
  background: '#191714',
  backgroundRaised: '#201C17',
  card: '#26221C',
  cardStrong: '#302A22',
  text: '#F0E7D9',
  textSecondary: '#D2C3AF',
  textMuted: '#BCAA92',
  primary: '#E6BD85',
  primarySoft: '#443727',
  primaryText: '#211810',
  gold: '#DDB376',
  goldBright: '#EDC88E',
  goldSoft: '#413321',
  goldText: '#E9C996',
  onGold: '#281C10',
  mint: '#9AD3B3',
  mintSoft: '#21382D',
  border: '#4B4033',
  shadow: '#090704',
  danger: '#F1A4AD',
  warning: '#E8BC78',
  purple: '#CBB9E3',
  purpleSoft: '#372D3F',
  tabBar: '#1E1A16',
} satisfies AppColors;

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
  background: '#070C18',
  backgroundRaised: '#0B1427',
  card: '#101B30',
  cardStrong: '#192844',
  text: '#EDF2FA',
  textSecondary: '#BBC8DD',
  textMuted: '#A5B5CE',
  primary: '#83F7A9',
  primaryText: '#071A16',
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
  tabBar: '#0C1427',
} satisfies Omit<AppColors, 'primarySoft' | 'border' | 'neon'>;

const neonIndicator = { icon: '#7DFF92', surface: '#102A24', edge: '#569F72', halo: '#7DFF9224' };
const neonCyan = '#68DEF1';
const neonBlue = '#76AFFF';

function mixHex(base: string, accent: string, amount: number): string {
  const channels = [1, 3, 5].map(offset => {
    const from = Number.parseInt(base.slice(offset, offset + 2), 16);
    const to = Number.parseInt(accent.slice(offset, offset + 2), 16);
    return Math.round(from + (to - from) * amount).toString(16).padStart(2, '0');
  });
  return '#' + channels.join('');
}

function tabGlyph(color: string, active: boolean, tabBar: string, text: string): TabGlyphColors {
  return {
    light: color,
    shade: mixHex(tabBar, color, active ? 0.57 : 0.47),
    edge: color,
    paper: mixHex(tabBar, color, active ? 0.37 : 0.31),
    paperShade: mixHex(tabBar, color, 0.48),
    ink: mixHex(color, text, active ? 0.42 : 0.22),
    detail: mixHex(color, text, active ? 0.31 : 0.1),
  };
}

function neonTab(base: string, seasonal: string): NeonTabPalette {
  const hue = mixHex(base, seasonal, 0.29);
  const active = mixHex(hue, neonBase.text, 0.12);
  const inactive = mixHex(hue, neonBase.tabBar, 0.19);
  return {
    active,
    inactive,
    selection: [mixHex(neonBase.tabBar, hue, 0.22), mixHex(neonBase.tabBar, hue, 0.08)],
    edge: mixHex(neonBase.tabBar, hue, 0.47),
    halo: hue + '28',
    activeGlyph: tabGlyph(active, true, neonBase.tabBar, neonBase.text),
    inactiveGlyph: tabGlyph(inactive, false, neonBase.tabBar, neonBase.text),
  };
}

const monthlyNeonColors: readonly AppColors[] = seasonalAccents.map(({ name, ...season }) => {
  const { primary, secondary, highlight } = season;
  return {
    ...neonBase,
    primarySoft: mixHex(neonBase.card, neonBase.primary, 0.14),
    border: mixHex('#273750', secondary, 0.13),
    neon: {
      name,
      season,
      edge: mixHex('#273750', primary, 0.32),
      sheetEdge: mixHex('#273750', secondary, 0.29),
      glow: highlight,
      secondarySoft: mixHex(neonBase.card, secondary, 0.13),
      focus: mixHex(neonCyan, primary, 0.24),
      chart: mixHex(neonBlue, neonCyan, 0.6),
      hero: [mixHex(neonBase.card, neonBlue, 0.1), mixHex(neonBase.backgroundRaised, secondary, 0.14)],
      action: [neonBase.primary, mixHex(neonCyan, primary, 0.36)],
      progressTrack: '#273650',
      progressFill: neonBase.primary,
      progressEnd: mixHex(neonCyan, highlight, 0.49),
      progressHighlight: '#EDF2FA55',
      indicator: neonIndicator,
      navigation: {
        surface: [mixHex(neonBase.tabBar, secondary, 0.08), neonBase.tabBar],
        rim: [primary + '00', primary + 'B0', secondary + 'B0', highlight + 'B0', highlight + '00'],
        edge: mixHex(neonBase.tabBar, primary, 0.34),
        tabs: {
          home: neonTab('#66FFA0', primary),
          library: neonTab('#55DCFF', secondary),
          planner: neonTab('#C2A4FF', primary),
          stats: neonTab('#FFCE68', highlight),
          discover: neonTab('#8FC0FF', highlight),
          profile: neonTab('#FF8FBB', secondary),
        },
      },
    },
  };
});

export function isThemePreference(value: unknown): value is ThemePreference {
  return themeOptions.some(option => option.id === value);
}

function activeAppearance(preference: ThemePreference, system: ColorSchemeName): Appearance {
  return preference === 'system' ? system === 'dark' ? 'dark' : 'light' : preference;
}

export function nextThemePreference(preference: ThemePreference, system: ColorSchemeName): Appearance {
  return nextAppearance[activeAppearance(preference, system)];
}

export function themeTogglePresentation(preference: ThemePreference, system: ColorSchemeName) {
  const current = appearances[activeAppearance(preference, system)];
  const next = appearances[nextAppearance[current.id]];
  const source = preference === 'system' ? ' (System)' : '';
  return { icon: current.icon, label: `Appearance: ${current.label}${source}. Next: ${next.label}.` };
}

function strongerContrast(colors: AppColors, border: string): AppColors {
  return {
    ...colors,
    textSecondary: mixHex(colors.textSecondary, colors.text, 0.25),
    textMuted: mixHex(colors.textMuted, colors.text, 0.3),
    border,
    ...(colors.neon && { neon: {
      ...colors.neon, edge: border, sheetEdge: border,
      navigation: { ...colors.neon.navigation, edge: border },
    } }),
  };
}

function readingPalette(colors: AppColors, hero: SurfaceGradient, artwork: NonNullable<AppColors['night']>['artwork']): AppColors {
  return {
    ...colors,
    night: {
      hero,
      artwork,
      navigation: {
        activeGlyph: tabGlyph(colors.primary, true, colors.tabBar, colors.text),
        inactiveGlyph: tabGlyph(colors.textMuted, false, colors.tabBar, colors.text),
      },
    },
  };
}

const dark = readingPalette(darkBase, ['#212E41', '#171F2C'], { cover: '#445C77', shade: '#283A50' });
const warmNight = readingPalette(warmBase, ['#332A20', '#241F19'], { cover: '#66513A', shade: '#413326' });
const palettes = { light, dark, warmNight };
const contrastPalettes = {
  light: strongerContrast(light, '#778498'),
  dark: strongerContrast(dark, '#778DA7'),
  warmNight: strongerContrast(warmNight, '#93816B'),
};
const monthlyNeonContrast = monthlyNeonColors.map(colors => strongerContrast(colors, '#7A90AD'));

export function resolveColors(preference: ThemePreference, system: ColorSchemeName, localMonth?: number, increaseContrast = false): AppColors {
  const appearance = activeAppearance(preference, system);
  if (appearance === 'neon') {
    const months = increaseContrast ? monthlyNeonContrast : monthlyNeonColors;
    return months[localMonth ?? new Date().getMonth()] ?? months[0] ?? dark;
  }
  return (increaseContrast ? contrastPalettes : palettes)[appearance];
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
