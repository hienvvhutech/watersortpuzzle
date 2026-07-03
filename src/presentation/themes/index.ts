import { GameTheme, TubeSkin } from '../../domain/types';

export interface ThemeConfig {
  background: string[]; // Gradients
  text: string;
  textSecondary: string;
  primary: string;
  accent: string;
  cardBg: string;
  cardBorder: string;
  buttonBg: string;
  buttonText: string;
  navBg: string;
}

export const THEMES: Record<GameTheme, ThemeConfig> = {
  light: {
    background: ['#F7F9FC', '#E2E8F0'],
    text: '#1E293B',
    textSecondary: '#64748B',
    primary: '#4D96FF',
    accent: '#FFD93D',
    cardBg: '#FFFFFF',
    cardBorder: '#CBD5E1',
    buttonBg: '#4D96FF',
    buttonText: '#FFFFFF',
    navBg: '#FFFFFF',
  },
  dark: {
    background: ['#0F172A', '#1E293B'],
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    primary: '#4D96FF',
    accent: '#FFD93D',
    cardBg: '#1E293B',
    cardBorder: '#334155',
    buttonBg: '#4D96FF',
    buttonText: '#FFFFFF',
    navBg: '#0F172A',
  },
  forest: {
    background: ['#1A3C40', '#1D5C5A'],
    text: '#F5F2E7',
    textSecondary: '#D6CDA4',
    primary: '#6BCB77',
    accent: '#FFD93D',
    cardBg: '#1D5C5A',
    cardBorder: '#406882',
    buttonBg: '#6BCB77',
    buttonText: '#1A3C40',
    navBg: '#1A3C40',
  },
  candy: {
    background: ['#FCE38A', '#F38181'],
    text: '#3F2B96',
    textSecondary: '#6C5B7B',
    primary: '#FF78F0',
    accent: '#A8E6CF',
    cardBg: 'rgba(255, 255, 255, 0.85)',
    cardBorder: '#FFAAA6',
    buttonBg: '#F38181',
    buttonText: '#FFFFFF',
    navBg: '#FCE38A',
  },
  space: {
    background: ['#0B0C10', '#1F2833'],
    text: '#66FCF1',
    textSecondary: '#C5C6C7',
    primary: '#45A29E',
    accent: '#66FCF1',
    cardBg: '#151C24',
    cardBorder: '#45A29E',
    buttonBg: '#66FCF1',
    buttonText: '#0B0C10',
    navBg: '#0B0C10',
  },
  ocean: {
    background: ['#0A4D68', '#088395'],
    text: '#EBF4F6',
    textSecondary: '#05BFDB',
    primary: '#00FFCA',
    accent: '#05BFDB',
    cardBg: '#088395',
    cardBorder: '#00FFCA',
    buttonBg: '#00FFCA',
    buttonText: '#0A4D68',
    navBg: '#0A4D68',
  },
  night: {
    background: ['#03001C', '#301E67'],
    text: '#B6E2A1',
    textSecondary: '#5B8FB9',
    primary: '#5B8FB9',
    accent: '#B6E2A1',
    cardBg: '#1C1635',
    cardBorder: '#301E67',
    buttonBg: '#5B8FB9',
    buttonText: '#03001C',
    navBg: '#03001C',
  },
  lava: {
    background: ['#220901', '#621708'],
    text: '#F77F00',
    textSecondary: '#FCBF49',
    primary: '#D62828',
    accent: '#FCBF49',
    cardBg: '#3D0E03',
    cardBorder: '#D62828',
    buttonBg: '#D62828',
    buttonText: '#FFFFFF',
    navBg: '#220901',
  },
  desert: {
    background: ['#F2D388', '#C19A6B'],
    text: '#4E3629',
    textSecondary: '#8F6240',
    primary: '#D68910',
    accent: '#A04000',
    cardBg: '#E5C494',
    cardBorder: '#C19A6B',
    buttonBg: '#A04000',
    buttonText: '#FFFFFF',
    navBg: '#F2D388',
  },
};

export interface SkinConfig {
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  highlightColor: string;
  shadowColor: string;
  glow?: boolean;
  bgFill?: string; // transparent glass tint
  customStyle?: any;
}

export const SKINS: Record<TubeSkin, SkinConfig> = {
  glass: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 3,
    borderRadius: 20,
    highlightColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    bgFill: 'rgba(255, 255, 255, 0.05)',
  },
  crystal: {
    borderColor: '#E2F0D9',
    borderWidth: 4,
    borderRadius: 0, // angular look
    highlightColor: '#FFFFFF',
    shadowColor: 'rgba(165, 214, 167, 0.3)',
    glow: true,
    bgFill: 'rgba(226, 240, 217, 0.08)',
  },
  wood: {
    borderColor: '#8B5A2B',
    borderWidth: 5,
    borderRadius: 16,
    highlightColor: '#CD853F',
    shadowColor: 'rgba(0, 0, 0, 0.4)',
    bgFill: 'rgba(139, 90, 43, 0.04)',
  },
  neon: {
    borderColor: '#39FF14', // Electric green
    borderWidth: 3,
    borderRadius: 25,
    highlightColor: '#FFFFFF',
    shadowColor: '#39FF14',
    glow: true,
    bgFill: 'rgba(57, 255, 20, 0.03)',
  },
  golden: {
    borderColor: '#FFD700',
    borderWidth: 4,
    borderRadius: 20,
    highlightColor: '#FFFDD0',
    shadowColor: '#FF8C00',
    glow: true,
    bgFill: 'rgba(255, 215, 0, 0.05)',
  },
  halloween: {
    borderColor: '#FF7518', // Pumpkin Orange
    borderWidth: 4,
    borderRadius: 18,
    highlightColor: '#FF9F00',
    shadowColor: '#4A154B',
    bgFill: 'rgba(0, 0, 0, 0.2)',
  },
  christmas: {
    borderColor: '#C41E3A', // Christmas Red
    borderWidth: 4.5,
    borderRadius: 22,
    highlightColor: '#228B22', // Forest Green Accent
    shadowColor: 'rgba(0, 0, 0, 0.25)',
    bgFill: 'rgba(255, 255, 255, 0.06)',
  },
  ocean: {
    borderColor: '#0077B6',
    borderWidth: 3.5,
    borderRadius: 24,
    highlightColor: '#90E0EF',
    shadowColor: '#03045E',
    bgFill: 'rgba(144, 224, 239, 0.08)',
  },
  galaxy: {
    borderColor: '#8A2BE2', // Neon purple
    borderWidth: 4,
    borderRadius: 30,
    highlightColor: '#00FFFF', // Cyan cyan highlight
    shadowColor: '#8A2BE2',
    glow: true,
    bgFill: 'rgba(138, 43, 226, 0.05)',
  },
  cyberpunk: {
    borderColor: '#00F0FF', // Cyan
    borderWidth: 3,
    borderRadius: 8,
    highlightColor: '#FF007F', // Neon Magenta
    shadowColor: '#00F0FF',
    glow: true,
    bgFill: 'rgba(0, 0, 0, 0.4)',
  },
};
