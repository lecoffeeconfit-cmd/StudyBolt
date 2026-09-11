import { ColorSchemeName } from 'react-native';

import { ThemePreference } from './models';

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
  textMuted: '#8C96AF',
  primary: '#1678FF',
  primarySoft: '#E9F2FF',
  primaryText: '#FFFFFF',
  mint: '#19B88A',
  mintSoft: '#E3F8F2',
  border: '#E4EAF4',
  shadow: '#243B76',
  danger: '#EB5A68',
  warning: '#F5A524',
  purple: '#7D5CFF',
  purpleSoft: '#EFEAFF',
  tabBar: '#FFFFFF',
};

const dark: AppColors = {
  mode: 'dark',
  background: '#090B18',
  backgroundRaised: '#101326',
  card: '#15192E',
  cardStrong: '#1B2039',
  text: '#F7F5FF',
  textSecondary: '#B5B9CF',
  textMuted: '#747A96',
  primary: '#6B8CFF',
  primarySoft: '#1D2C57',
  primaryText: '#FFFFFF',
  mint: '#59D7B1',
  mintSoft: '#12372F',
  border: '#272C47',
  shadow: '#000000',
  danger: '#FF7E89',
  warning: '#F7C35A',
  purple: '#B392FF',
  purpleSoft: '#2C2149',
  tabBar: '#111426',
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
