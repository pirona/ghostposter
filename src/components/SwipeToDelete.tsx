// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useRef } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

interface Props {
  onDelete: () => void;
  enabled?: boolean;
  children: React.ReactNode;
}

export function SwipeToDelete({ onDelete, enabled = true, children }: Props): React.JSX.Element {
  const ref = useRef<SwipeableMethods>(null);
  const { colors } = useTheme();

  return (
    <ReanimatedSwipeable
      ref={ref}
      enabled={enabled}
      friction={2}
      renderRightActions={() => (
        <TouchableOpacity
          style={[styles.action, { backgroundColor: colors.error }]}
          onPress={() => {
            ref.current?.close();
            onDelete();
          }}
          accessibilityLabel="Supprimer"
        >
          <Text style={[styles.label, { color: colors.onError }]}>Supprimer</Text>
        </TouchableOpacity>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    marginVertical: 6,
    marginRight: 16,
    borderRadius: 12,
  },
  label: {
    fontWeight: '600',
    fontSize: 13,
  },
});
