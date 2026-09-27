// SPDX-License-Identifier: GPL-3.0-or-later
// Paginated post list for the active instance.

import { create } from 'zustand';

import { getPosts, deletePost as deletePostApi } from '../api/ghostClient';
import { GhostPost, PostFilter } from '../api/ghostTypes';
import { useInstanceStore } from './instanceStore';

interface PostListState {
  posts: GhostPost[];
  filter: PostFilter;
  search: string;
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

interface PostListActions {
  /** Reloads page 1 — supersedes any request still in flight. */
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  setFilter(filter: PostFilter): void;
  setSearch(search: string): void;
  deletePost(id: string): Promise<void>;
  reset(): void;
}

const INITIAL: PostListState = {
  posts: [],
  filter: 'all',
  search: '',
  page: 1,
  hasMore: true,
  isLoading: false,
  error: null,
};

// Only the latest request may write its result: a slow answer for a previous
// instance/filter/search must not land in the current list.
let latestRequest = 0;

export const usePostListStore = create<PostListState & PostListActions>((set, get) => {
  async function load(page: number): Promise<void> {
    const request = ++latestRequest;
    set({ isLoading: true, error: null });
    try {
      const { posts, meta } = await getPosts(page, get().filter, get().search);
      if (request !== latestRequest) return;
      set((s) => ({
        posts: page === 1 ? posts : [...s.posts, ...posts],
        page,
        hasMore: meta.pagination.next !== null,
        isLoading: false,
      }));
    } catch (error) {
      if (request !== latestRequest) return;
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erreur lors du chargement des posts.',
      });
    }
  }

  return {
    ...INITIAL,

    refresh: () => load(1),

    async loadMore() {
      const { isLoading, hasMore, page } = get();
      if (isLoading || !hasMore) return;
      await load(page + 1);
    },

    setFilter(filter) {
      set({ filter, posts: [], hasMore: true });
      void load(1);
    },

    setSearch(search) {
      if (search === get().search) return;
      set({ search, posts: [], hasMore: true });
      void load(1);
    },

    async deletePost(id) {
      await deletePostApi(id);
      set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
    },

    reset() {
      latestRequest++;
      set({ ...INITIAL });
    },
  };
});

useInstanceStore.subscribe((state, prev) => {
  if (state.activeInstanceId !== prev.activeInstanceId || state.credentialsVersion !== prev.credentialsVersion) {
    usePostListStore.getState().reset();
  }
});
