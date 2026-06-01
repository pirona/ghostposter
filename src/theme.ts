import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';

const fonts = configureFonts({ config: { fontFamily: 'Barlow_700Bold' } });

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1565C0',
    secondary: '#546E7A',
  },
  fonts,
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#82B1FF',
    secondary: '#90A4AE',
    background: '#15171A',
    surface: '#1C1F24',
    surfaceVariant: '#252A31',
    onSurface: '#E4E7EB',
    onBackground: '#E4E7EB',
    outline: '#3E4751',
    onSurfaceVariant: '#9BA3AC',
  },
  fonts,
};

export type AppTheme = typeof lightTheme;
