import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';

const fonts = configureFonts({ config: { fontFamily: 'Barlow_700Bold' } });

// Amber warm — clearly readable on both dark and light backgrounds
const AMBER_DARK  = '#F5A623';
const AMBER_LIGHT = '#C47A0F';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: AMBER_LIGHT,
    secondary: '#546E7A',
    primaryContainer: '#FFF3DC',
    onPrimaryContainer: '#6B3E00',
  },
  fonts,
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: AMBER_DARK,
    secondary: '#90A4AE',
    primaryContainer: '#5C3A00',
    onPrimaryContainer: '#FFD18A',
    background: '#15171A',
    surface: '#1C1F24',
    surfaceVariant: '#252A31',
    onSurface: '#E4E7EB',
    onBackground: '#E4E7EB',
    outline: '#3E4751',
    outlineVariant: '#2D3540',
    onSurfaceVariant: '#9BA3AC',
  },
  fonts,
};

export type AppTheme = typeof lightTheme;
