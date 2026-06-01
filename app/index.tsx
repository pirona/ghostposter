import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useTheme } from 'react-native-paper';

import { useInstanceStore } from '../src/store/instanceStore';

export default function Index(): React.JSX.Element {
  const isLoading = useInstanceStore((s) => s.isLoading);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!activeInstanceId) {
    return <Redirect href="/settings" />;
  }

  return <Redirect href="/(tabs)/posts" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
