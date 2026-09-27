// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { ActivityIndicator, useTheme } from 'react-native-paper';

import { useInstanceStore } from '../src/store/instanceStore';

export default function Index(): React.JSX.Element {
  const isLoading = useInstanceStore((s) => s.isLoading);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.background }]}>
        <Image
          source={require('../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={colors.primary} style={styles.indicator} />
      </View>
    );
  }

  if (!activeInstanceId) {
    return <Redirect href="/settings" />;
  }

  return <Redirect href="/(drawer)/posts" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 32,
  },
  indicator: {
    marginTop: 8,
  },
});
