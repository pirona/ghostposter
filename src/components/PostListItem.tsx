import React, { useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import { Text, Surface, useTheme } from 'react-native-paper';
import { Swipeable } from 'react-native-gesture-handler';

import { GhostPost } from '../api/ghostTypes';
import { StatusBadge } from './StatusBadge';

export interface PostListItemProps {
  post: GhostPost;
  onPress: (post: GhostPost) => void;
  onDelete: (id: string) => void;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function PostListItem({ post, onPress, onDelete }: PostListItemProps): React.JSX.Element {
  const swipeableRef = useRef<Swipeable>(null);
  const { colors } = useTheme();

  function handleDeletePress(): void {
    swipeableRef.current?.close();
    Alert.alert(
      'Supprimer le post',
      `Supprimer "${post.title}" définitivement ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => onDelete(post.id),
        },
      ],
    );
  }

  function renderRightActions(): React.JSX.Element {
    return (
      <TouchableOpacity style={styles.deleteAction} onPress={handleDeletePress}>
        <Text style={styles.deleteText}>Supprimer</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} friction={2}>
      <Surface style={styles.surface} elevation={1}>
        <TouchableOpacity style={styles.content} onPress={() => onPress(post)} activeOpacity={0.7}>
          <View style={styles.header}>
            <StatusBadge status={post.status} />
            <Text style={[styles.date, { color: colors.onSurfaceVariant }]} variant="labelSmall">
              {formatDate(post.updated_at)}
            </Text>
          </View>
          <Text style={styles.title} variant="titleMedium" numberOfLines={2}>
            {post.title || '(Sans titre)'}
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
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: '600',
  },
  date: {},
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
