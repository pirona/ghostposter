// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Chip, IconButton, Menu, Text, useTheme } from 'react-native-paper';

import { GhostInstance } from '../store/instanceStore';

interface Props {
  instance: GhostInstance;
  isActive: boolean;
  onSelect: (instance: GhostInstance) => void;
  onEdit: (instance: GhostInstance) => void;
  onDelete: (instance: GhostInstance) => void;
}

export function InstanceListItem({ instance, isActive, onSelect, onEdit, onDelete }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.content}
        onPress={() => onSelect(instance)}
        disabled={isActive}
        activeOpacity={0.7}
        accessibilityLabel={isActive ? `${instance.name}, instance active` : `Activer ${instance.name}`}
      >
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.name} numberOfLines={1}>{instance.name}</Text>
          {isActive && (
            <Chip compact style={{ backgroundColor: colors.primaryContainer }} textStyle={styles.chipText}>
              Active
            </Chip>
          )}
        </View>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>
          {instance.url}
        </Text>
      </TouchableOpacity>
      <Menu
        visible={menuOpen}
        onDismiss={() => setMenuOpen(false)}
        anchor={
          <IconButton icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel={`Actions pour ${instance.name}`} />
        }
      >
        <Menu.Item
          leadingIcon="pencil-outline"
          title="Modifier"
          onPress={() => {
            setMenuOpen(false);
            onEdit(instance);
          }}
        />
        <Menu.Item
          leadingIcon="delete-outline"
          title="Supprimer"
          titleStyle={{ color: colors.error }}
          onPress={() => {
            setMenuOpen(false);
            onDelete(instance);
          }}
        />
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 16,
    gap: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontWeight: '600',
    flexShrink: 1,
  },
  chipText: {
    fontSize: 11,
  },
});
