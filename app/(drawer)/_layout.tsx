import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { Text, Divider, List, useTheme, TouchableRipple } from 'react-native-paper';

import { useInstanceStore } from '../../src/store/instanceStore';
import { usePostStore } from '../../src/store/postStore';

function DrawerContent(props: DrawerContentComponentProps): React.JSX.Element {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const instances = useInstanceStore((s) => s.instances);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const setActiveInstance = useInstanceStore((s) => s.setActiveInstance);
  const resetCurrentPost = usePostStore((s) => s.resetCurrentPost);

  const activeInstance = instances.find((i) => i.id === activeInstanceId);

  function close(): void {
    navigation.dispatch(DrawerActions.closeDrawer());
  }

  function goTo(path: string): void {
    close();
    router.navigate(path as never);
  }

  function handleCompose(): void {
    resetCurrentPost();
    goTo('/(drawer)/compose');
  }

  async function handleSwitchInstance(id: string): Promise<void> {
    if (id === activeInstanceId) return;
    try {
      await setActiveInstance(id);
    } catch {
      // instance introuvable — ignoré
    }
  }

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
        <Text variant="titleLarge" style={[styles.appName, { color: colors.onSurface }]}>
          Ghost Poster
        </Text>
        {activeInstance && (
          <Text variant="bodySmall" style={{ color: colors.primary }}>
            {activeInstance.name}
          </Text>
        )}
      </View>

      {instances.length > 0 && (
        <>
          <List.Subheader style={{ color: colors.onSurfaceVariant }}>Instances</List.Subheader>
          {instances.map((instance) => {
            const isActive = instance.id === activeInstanceId;
            return (
              <TouchableRipple
                key={instance.id}
                onPress={() => handleSwitchInstance(instance.id)}
                rippleColor={colors.primary + '33'}
              >
                <View style={[
                  styles.instanceRow,
                  isActive && { backgroundColor: colors.primaryContainer },
                ]}>
                  <View style={[
                    styles.instanceDot,
                    { backgroundColor: isActive ? colors.primary : colors.outlineVariant },
                  ]} />
                  <Text
                    variant="bodyMedium"
                    style={{ color: isActive ? colors.onPrimaryContainer : colors.onSurface, flex: 1 }}
                    numberOfLines={1}
                  >
                    {instance.name}
                  </Text>
                  {isActive && <List.Icon icon="check" color={colors.primary} />}
                </View>
              </TouchableRipple>
            );
          })}
          <Divider style={styles.divider} />
        </>
      )}

      <List.Subheader style={{ color: colors.onSurfaceVariant }}>Navigation</List.Subheader>
      <List.Item
        title="Posts"
        left={(p) => <List.Icon {...p} icon="text-box-multiple-outline" color={colors.onSurface} />}
        onPress={() => goTo('/(drawer)/posts')}
        titleStyle={{ color: colors.onSurface }}
      />
      <List.Item
        title="Nouveau post"
        left={(p) => <List.Icon {...p} icon="pencil-outline" color={colors.onSurface} />}
        onPress={handleCompose}
        titleStyle={{ color: colors.onSurface }}
      />

      <Divider style={styles.divider} />

      <List.Item
        title="Paramètres"
        left={(p) => <List.Icon {...p} icon="cog-outline" color={colors.onSurfaceVariant} />}
        onPress={() => { close(); router.push('/settings'); }}
        titleStyle={{ color: colors.onSurfaceVariant }}
      />
    </DrawerContentScrollView>
  );
}

export default function DrawerLayout(): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        drawerType: 'slide',
        swipeEdgeWidth: 80,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onSurface,
        headerShadowVisible: false,
      }}
    >
      <Drawer.Screen name="posts" options={{ title: 'Posts' }} />
      <Drawer.Screen name="compose" options={{ title: 'Compose' }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  appName: {
    fontWeight: '700',
    marginBottom: 2,
  },
  instanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 2,
  },
  instanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    marginVertical: 8,
  },
});
