// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Searchbar, Snackbar, Text, useTheme } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';

import { usePostListStore } from '../../src/store/postListStore';
import { useEditorStore } from '../../src/store/editorStore';
import { PostListItem } from '../../src/components/PostListItem';
import { GhostPost, PostFilter } from '../../src/api/ghostTypes';
import { confirmDiscardChanges } from '../../src/utils/editorGuard';

const FILTERS: Array<{ key: PostFilter; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'scheduled', label: 'Programmés' },
  { key: 'published', label: 'Publiés' },
];

const SEARCH_DEBOUNCE_MS = 400;

export default function PostsScreen(): React.JSX.Element {
  const router = useRouter();
  const { colors } = useTheme();
  const list = usePostListStore();
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [query, setQuery] = useState(list.search);

  useFocusEffect(
    useCallback(() => {
      void usePostListStore.getState().refresh();
    }, []),
  );

  useEffect(() => {
    const timer = setTimeout(() => list.setSearch(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function openPost(post: GhostPost): void {
    const editor = useEditorStore.getState();
    const go = (): void => {
      router.navigate('/(drawer)/compose');
      editor.openPost(post.id).catch((err) => {
        // Back to the list so the error is shown where the user can act on it.
        router.navigate('/(drawer)/posts');
        setSnackbar(err instanceof Error ? err.message : 'Impossible d’ouvrir le post.');
      });
    };
    // Re-opening the post already in the editor keeps its unsaved changes.
    if (editor.ghostId === post.id) router.navigate('/(drawer)/compose');
    else confirmDiscardChanges(go);
  }

  function newPost(): void {
    confirmDiscardChanges(() => {
      useEditorStore.getState().newPost();
      router.navigate('/(drawer)/compose');
    });
  }

  async function deletePost(id: string): Promise<void> {
    try {
      await list.deletePost(id);
      if (useEditorStore.getState().ghostId === id) useEditorStore.getState().newPost();
      setSnackbar('Post supprimé.');
    } catch (err) {
      setSnackbar(err instanceof Error ? err.message : 'Impossible de supprimer le post.');
    }
  }

  async function pullRefresh(): Promise<void> {
    setIsPullRefreshing(true);
    await list.refresh();
    setIsPullRefreshing(false);
  }

  function renderEmpty(): React.JSX.Element {
    if (list.isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      );
    }
    if (list.error) {
      return (
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={{ color: colors.error, textAlign: 'center' }}>{list.error}</Text>
          <Button onPress={() => void list.refresh()}>Réessayer</Button>
        </View>
      );
    }
    if (list.search) {
      return (
        <View style={styles.centered}>
          <Text variant="titleMedium" style={{ color: colors.onSurface }}>Aucun résultat</Text>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>pour « {list.search} »</Text>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Image source={require('../../assets/icon.png')} style={styles.emptyIcon} resizeMode="contain" />
        <Text variant="titleMedium" style={{ color: colors.onSurface }}>Aucun post</Text>
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>Créez votre premier article</Text>
        <Button mode="contained" onPress={newPost}>Nouveau post</Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={list.posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostListItem post={item} onPress={openPost} onDelete={(id) => void deletePost(id)} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Searchbar
              placeholder="Rechercher un titre"
              value={query}
              onChangeText={setQuery}
              style={styles.search}
              inputStyle={styles.searchInput}
            />
            <View style={styles.filters}>
              {FILTERS.map((f) => (
                <Chip key={f.key} compact selected={list.filter === f.key} onPress={() => list.setFilter(f.key)}>
                  {f.label}
                </Chip>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={
          list.isLoading && list.posts.length > 0 && !isPullRefreshing
            ? <ActivityIndicator style={styles.footerLoader} />
            : null
        }
        ListEmptyComponent={renderEmpty}
        onEndReached={() => void list.loadMore()}
        onEndReachedThreshold={0.4}
        onRefresh={() => void pullRefresh()}
        refreshing={isPullRefreshing}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={list.posts.length === 0 ? styles.grow : styles.listContent}
      />

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
        {snackbar}
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
  grow: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  search: {
    height: 44,
  },
  searchInput: {
    minHeight: 0,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    opacity: 0.4,
  },
  footerLoader: {
    paddingVertical: 16,
  },
});
