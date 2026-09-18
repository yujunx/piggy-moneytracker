import { useColorScheme } from 'react-native';

const brand = {
  red: '#E8505B',
  income: '#3478F6',
  expense: '#E8505B',
  transfer: '#8E8E93',
  onRed: '#FFFFFF',
};

const light = {
  ...brand,
  bg: '#F3F3F6',
  card: '#FFFFFF',
  text: '#1C1C1E',
  sub: '#6E6E76',
  border: '#E3E3E8',
  header: brand.red,
  chip: '#EEEEF2',
  chipActive: '#FDE7E9',
  warnBg: '#FFF5D9',
  warnBorder: '#E8B931',
  track: '#EBEBEF',
};

export type Palette = typeof light;

const dark: Palette = {
  ...brand,
  bg: '#0E0E10',
  card: '#1B1B1E',
  text: '#F2F2F5',
  sub: '#9C9CA4',
  border: '#2B2B30',
  header: '#B83B45',
  chip: '#29292E',
  chipActive: '#4A2327',
  warnBg: '#3A3117',
  warnBorder: '#9E7F22',
  track: '#2B2B30',
};

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Categorical chart colors, in the order categories are ranked. */
export const CHART_COLORS = ['#E8505B', '#F29B38', '#F2C94C', '#4CB782', '#3AA6D9', '#5B6CF0', '#9A5BD9', '#D95BA6', '#8C7B6B', '#7C8A99'];

export function amountColor(p: Palette, type: 'income' | 'expense' | 'transfer') {
  return type === 'income' ? p.income : type === 'expense' ? p.expense : p.transfer;
}
