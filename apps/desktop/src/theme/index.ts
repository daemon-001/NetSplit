/**
 * NetSplit Fluent Design System Tokens
 * Restrained, professional, Windows 11 Fluent 2 inspired palette
 */

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSubtle: string;
  surfaceHover: string;
  surfaceActive: string;
  surfaceCard: string;
  border: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentHover: string;
  accentPressed: string;
  accentSubtle: string;
  accentText: string;
  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  error: string;
  errorSubtle: string;
  badgeBg: string;
  sidebarBg: string;
  sidebarActiveBg: string;
  topbarBg: string;
  tableHeaderBg: string;
  tableRowHover: string;
  tableRowSelected: string;
}

export const darkTheme: ThemeColors = {
  background: '#202020',
  surface: '#2c2c2c',
  surfaceSubtle: '#272727',
  surfaceHover: '#333333',
  surfaceActive: '#383838',
  surfaceCard: '#2d2d2d',
  border: '#3c3c3c',
  borderSubtle: '#2e2e2e',
  borderStrong: '#4a4a4a',
  textPrimary: '#ffffff',
  textSecondary: '#d0d0d0',
  textTertiary: '#8a8a8a',
  accent: '#1173d4', // Fluent Brand Blue
  accentHover: '#1a82e8',
  accentPressed: '#0f6cbd',
  accentSubtle: '#183b5c',
  accentText: '#ffffff',
  success: '#107c41',
  successSubtle: '#173f27',
  warning: '#ca8a04',
  warningSubtle: '#3d2e07',
  error: '#d13438',
  errorSubtle: '#43191b',
  badgeBg: '#383838',
  sidebarBg: '#1c1c1c',
  sidebarActiveBg: '#333333',
  topbarBg: '#202020',
  tableHeaderBg: '#262626',
  tableRowHover: '#303030',
  tableRowSelected: '#293d52',
};

export const lightTheme: ThemeColors = {
  background: '#f3f3f3',
  surface: '#ffffff',
  surfaceSubtle: '#f9f9f9',
  surfaceHover: '#f0f0f0',
  surfaceActive: '#e6e6e6',
  surfaceCard: '#ffffff',
  border: '#e0e0e0',
  borderSubtle: '#ebebeb',
  borderStrong: '#cccccc',
  textPrimary: '#1a1a1a',
  textSecondary: '#5e5e5e',
  textTertiary: '#8c8c8c',
  accent: '#0f6cbd',
  accentHover: '#1173d4',
  accentPressed: '#0c5897',
  accentSubtle: '#e5f1fb',
  accentText: '#ffffff',
  success: '#107c41',
  successSubtle: '#e8f5ed',
  warning: '#ca8a04',
  warningSubtle: '#fef9c3',
  error: '#d13438',
  errorSubtle: '#fde8e9',
  badgeBg: '#ebebeb',
  sidebarBg: '#f8f8f8',
  sidebarActiveBg: '#e8e8e8',
  topbarBg: '#ffffff',
  tableHeaderBg: '#f5f5f5',
  tableRowHover: '#f8f9fa',
  tableRowSelected: '#ebf3fc',
};

export const typography = {
  fontFamily: 'Segoe UI Variable Text, Segoe UI, -apple-system, sans-serif',
  fontFamilyDisplay: 'Segoe UI Variable Display, Segoe UI, -apple-system, sans-serif',
  fontFamilyMono: 'Cascadia Mono, Consolas, Courier New, monospace',
  sizes: {
    xs: 11,
    sm: 12,
    base: 13,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    title: 26,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  huge: 36,
};

export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
  pill: 9999,
};
