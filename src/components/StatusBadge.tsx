// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { PostStatus } from '../api/ghostTypes';

export interface StatusBadgeProps {
  status: PostStatus;
}

const STATUS_CONFIG = {
  draft:     { label: 'Brouillon', color: '#757575' },
  published: { label: 'Publié',    color: '#30CF43' },
  scheduled: { label: 'Programmé', color: '#E65100' },
} as const;

export function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;

  return (
    <View style={[styles.badge, { backgroundColor: config.color + '1A' }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
