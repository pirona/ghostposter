import React, { useCallback } from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Text, Chip, Button, ActivityIndicator, Snackbar, useTheme } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';

import { usePostStore } from '../../src/store/postStore';
import { PostListItem } from '../../src/components/PostListItem';
import { GhostPost, PostFilter } from '../../src/api/ghostTypes';

const FILTERS: Array<{ key: PostFilter | 'all'; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'published', label: 'Publiés' },
];

export default function PostsScreen(): React.JSX.Element {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    posts,
    statusFilter,
    isLoading,
    error,
    hasMore,
    fetchPosts,
    fetchMorePosts,
    deletePost,
    loadPostForEditing,
    setStatusFilter,
  } = usePostStore();

  const [snackbarMessage, setSnackbarMessage] = React.useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]),
  );

  function handlePostPress(post: GhostPost): void {
    loadPostForEditing(post);
    router.navigate('/(tabs)/compose');
  }

  async function handleDeletePost(id: string): Promise<void> {
    try {
      await deletePost(id);
      setSnackbarMessage('Post supprimé.');
    } catch {
      setSnackbarMessage('Impossible de supprimer le post.');
    }
  }

  function handleFilterChange(filter: PostFilter | 'all'): void {
    setStatusFilter(filter as 'all' | 'draft' | 'published');
  }

  function handleEndReached(): void {
    if (!isLoading && hasMore) {
      fetchMorePosts();
    }
  }

  function renderHeader(): React.JSX.Element {
    return (
      <View style={styles.filterBar}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            selected={statusFilter === f.key}
            onPress={() => handleFilterChange(f.key)}
            style={styles.filterChip}
            compact
          >
            {f.label}
          </Chip>
        ))}
      </View>
    );
  }

  function renderFooter(): React.JSX.Element | null {
    if (!isLoading || posts.length === 0) return null;
    return <ActivityIndicator style={styles.footerLoader} />;
  }

  function renderEmpty(): React.JSX.Element {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={{ color: colors.error, textAlign: 'center' }}>
            {error}
          </Text>
          <Button onPress={() => fetchPosts(true)} style={styles.retryButton}>
            Réessayer
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Text variant="bodyLarge" style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>
          Aucun post trouvé.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostListItem
            post={item}
            onPress={handlePostPress}
            onDelete={handleDeletePost}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        onRefresh={() => fetchPosts(true)}
        refreshing={isLoading && posts.length === 0}
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.listContent}
      />

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage(null)}
        duration={2500}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    borderRadius: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  retryButton: {
    marginTop: 8,
  },
  footerLoader: {
    paddingVertical: 16,
  },
});
