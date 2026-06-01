import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { IconButton, useTheme } from 'react-native-paper';

import { useInstanceStore } from '../../src/store/instanceStore';

function SettingsButton(): React.JSX.Element {
  const router = useRouter();
  const { colors } = useTheme();
  const instanceName = useInstanceStore((s) =>
    s.instances.find((i) => i.id === s.activeInstanceId)?.name ?? null,
  );

  return (
    <IconButton
      icon="server"
      size={22}
      iconColor={colors.primary}
      onPress={() => router.push('/settings')}
      accessibilityLabel={instanceName ? `Instance : ${instanceName}` : 'Gérer les instances Ghost'}
      style={{ marginRight: 4 }}
    />
  );
}

export default function TabsLayout(): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.outline,
        },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onSurface,
        headerShadowVisible: false,
        headerRight: () => <SettingsButton />,
      }}
    >
      <Tabs.Screen
        name="posts"
        options={{
          title: 'Posts',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="text-box-multiple-outline" iconColor={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="compose"
        options={{
          title: 'Compose',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="pencil-outline" iconColor={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
