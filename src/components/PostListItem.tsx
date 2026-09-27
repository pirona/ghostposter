// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Alert } from 'react-native';
import { Text, Surface, useTheme } from 'react-native-paper';

import { GhostPost } from '../api/ghostTypes';
import { StatusBadge } from './StatusBadge';
import { SwipeToDelete } from './SwipeToDelete';
import { useSettingsStore } from '../store/settingsStore';
import { formatDate } from '../utils/format';

interface Props {
  post: GhostPost;
  onPress: (post: GhostPost) => void;
  onDelete: (id: string) => void;
}

export function PostListItem({ post, onPress, onDelete }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const confirmDelete = useSettingsStore((s) => s.confirmDelete);

  function handleDelete(): void {
    if (!confirmDelete) {
      onDelete(post.id);
      return;
    }
    Alert.alert('Supprimer le post', `Supprimer « ${post.title || '(Sans titre)'} » définitivement ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(post.id) },
    ]);
  }

  // Scheduled posts show their publication date; everything else its last edit.
  const date = post.status === 'scheduled' && post.published_at ? post.published_at : post.updated_at;

  return (
    <SwipeToDelete onDelete={handleDelete}>
      <Surface style={styles.surface} elevation={1}>
        <TouchableOpacity style={styles.content} onPress={() => onPress(post)} activeOpacity={0.7}>
          <View style={styles.row}>
            <View style={styles.textContent}>
              <View style={styles.header}>
                <StatusBadge status={post.status} />
                <Text style={{ color: colors.onSurfaceVariant }} variant="labelSmall">
                  {formatDate(date, post.status === 'scheduled')}
                </Text>
              </View>
              <Text style={styles.title} variant="titleMedium" numberOfLines={2}>
                {post.title || '(Sans titre)'}
              </Text>
              {post.custom_excerpt ? (
                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} numberOfLines={2}>
                  {post.custom_excerpt}
                </Text>
              ) : null}
            </View>
            {post.feature_image ? (
              <Image source={{ uri: post.feature_image }} style={styles.thumbnail} resizeMode="cover" />
            ) : null}
          </View>
        </TouchableOpacity>
      </Surface>
    </SwipeToDelete>
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
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  textContent: {
    flex: 1,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: '600',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    alignSelf: 'center',
  },
});
