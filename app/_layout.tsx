import React, { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Barlow_700Bold } from '@expo-google-fonts/barlow';

import { useInstanceStore } from '../src/store/instanceStore';
import { lightTheme, darkTheme } from '../src/theme';

export default function RootLayout(): React.JSX.Element {
  const loadInstances = useInstanceStore((s) => s.loadInstances);
  const colorScheme = useColorScheme();
  useFonts({ Barlow_700Bold });

  useEffect(() => {
    loadInstances();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
              name="settings"
              options={{
                title: 'Instances Ghost',
                headerBackTitle: 'Retour',
              }}
            />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
