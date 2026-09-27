// SPDX-License-Identifier: GPL-3.0-or-later
import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';

const fonts = configureFonts({
  config: {
    displayLarge:   { fontFamily: 'Barlow_700Bold' },
    displayMedium:  { fontFamily: 'Barlow_700Bold' },
    displaySmall:   { fontFamily: 'Barlow_700Bold' },
    headlineLarge:  { fontFamily: 'Barlow_700Bold' },
    headlineMedium: { fontFamily: 'Barlow_700Bold' },
    headlineSmall:  { fontFamily: 'Barlow_600SemiBold' },
    titleLarge:     { fontFamily: 'Barlow_600SemiBold' },
    titleMedium:    { fontFamily: 'Barlow_600SemiBold' },
    titleSmall:     { fontFamily: 'Barlow_600SemiBold' },
    labelLarge:     { fontFamily: 'Barlow_600SemiBold' },
    labelMedium:    { fontFamily: 'Barlow_400Regular' },
    labelSmall:     { fontFamily: 'Barlow_400Regular' },
    bodyLarge:      { fontFamily: 'Barlow_400Regular' },
    bodyMedium:     { fontFamily: 'Barlow_400Regular' },
    bodySmall:      { fontFamily: 'Barlow_400Regular' },
  },
});

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1A1A1A',
    secondary: '#616161',
    primaryContainer: '#EBEBEB',
    onPrimaryContainer: '#1A1A1A',
  },
  fonts,
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#FFFFFF',
    secondary: '#9E9E9E',
    primaryContainer: '#2A2A2A',
    onPrimaryContainer: '#E0E0E0',
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
