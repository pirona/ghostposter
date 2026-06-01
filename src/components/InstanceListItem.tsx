import React, { useRef } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, Surface, Chip, useTheme } from 'react-native-paper';
import { Swipeable } from 'react-native-gesture-handler';

import { GhostInstance } from '../store/instanceStore';

export interface InstanceListItemProps {
  instance: GhostInstance;
  isActive: boolean;
  onPress: (instance: GhostInstance) => void;
  onDelete: (id: string) => void;
}

export function InstanceListItem({
  instance,
  isActive,
  onPress,
  onDelete,
}: InstanceListItemProps): React.JSX.Element {
  const swipeableRef = useRef<Swipeable>(null);
  const { colors } = useTheme();

  function handleDeletePress(): void {
    swipeableRef.current?.close();
    onDelete(instance.id);
  }

  function renderRightActions(): React.JSX.Element {
    return (
      <TouchableOpacity style={styles.deleteAction} onPress={handleDeletePress}>
        <Text style={styles.deleteText}>Supprimer</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      enabled={!isActive}
    >
      <Surface
        style={[styles.surface, isActive && { borderWidth: 2, borderColor: colors.primary }]}
        elevation={1}
      >
        <TouchableOpacity
          style={styles.content}
          onPress={() => onPress(instance)}
          activeOpacity={0.7}
          disabled={isActive}
        >
          <View style={styles.header}>
            <Text style={styles.name} variant="titleMedium" numberOfLines={1}>
              {instance.name}
            </Text>
            {isActive && (
              <Chip
                compact
                style={{ backgroundColor: colors.primary + '22' }}
                textStyle={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}
              >
                Actif
              </Chip>
            )}
          </View>
          <Text style={[styles.url, { color: colors.onSurfaceVariant }]} variant="bodySmall" numberOfLines={1}>
            {instance.url}
          </Text>
        </TouchableOpacity>
      </Surface>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  surface: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
  },
  content: {
    padding: 16,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontWeight: '600',
    flex: 1,
  },
  url: {},
  deleteAction: {
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    marginVertical: 6,
    marginRight: 16,
    borderRadius: 12,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
