/**
 * @file src/store/postStore.ts
 * @description Store Zustand pour la gestion des posts Ghost.
 *              Centralise l'état de la liste des posts et du post en cours d'édition.
 *              Tous les appels API passent par ce store — jamais directement depuis les écrans.
 *
 * @exports usePostStore
 * @exports CurrentPostState
 */

import { create } from 'zustand';

import {
  getPosts,
  createPost,
  updatePost,
  deletePost as deletePostApi,
} from '../api/ghostClient';
import { htmlToMarkdown, markdownToHtml } from '../utils/contentConverter';
import {
  GhostPost,
  PostFilter,
  ConflictError,
} from '../api/ghostTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * État du post actuellement chargé dans l'éditeur.
 * L'éditeur travaille toujours en Markdown — la conversion HTML↔Markdown
 * est transparente pour les composants.
 */
export interface CurrentPostState {
  /** Undefined si le post est en cours de création (pas encore persisté). */
  ghostId?: string;
  title: string;
  markdownContent: string;
  tags: string[];
  /** URL de l'image à la une — null si aucune, modifiable indépendamment du contenu. */
  featureImage: string | null;
  /** updated_at Ghost original — obligatoire pour les requêtes PUT (optimistic lock). */
  originalUpdatedAt?: string;
  /** Statut au moment du chargement — détermine les actions disponibles dans l'éditeur. */
  originalStatus?: 'draft' | 'published';
  /** True dès qu'un champ a été modifié sans être sauvegardé. */
  isDirty: boolean;
}

type StatusFilter = 'all' | 'draft' | 'published';

interface PostState {
  posts: GhostPost[];
  currentPost: CurrentPostState | null;
  statusFilter: StatusFilter;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  currentPage: number;
  hasMore: boolean;
}

interface PostActions {
  setTitle(title: string): void;
  setMarkdownContent(content: string): void;
  setTags(tags: string[]): void;
  setFeatureImage(url: string | null): void;
  /** Charge un post de la liste dans l'éditeur (conversion HTML → Markdown). */
  loadPostForEditing(post: GhostPost): void;
  /** Réinitialise l'éditeur pour une nouvelle création. */
  resetCurrentPost(): void;
  /** Réinitialise la liste des posts (changement d'instance active). */
  resetPosts(): void;
  /** Efface l'erreur courante (appelé depuis l'UI après affichage). */
  clearError(): void;
  /** Charge la première page de posts. reset=true repart de la page 1. */
  fetchPosts(reset?: boolean): Promise<void>;
  /** Charge la page suivante (infinite scroll). */
  fetchMorePosts(): Promise<void>;
  /**
   * Sauvegarde le post en cours (création ou mise à jour).
   * @throws ConflictError si updated_at est périmé
   */
  saveCurrentPost(status: 'draft' | 'published'): Promise<GhostPost>;
  deletePost(id: string): Promise<void>;
  setStatusFilter(filter: StatusFilter): void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePostStore = create<PostState & PostActions>((set, get) => ({
  posts: [],
  currentPost: null,
  statusFilter: 'all',
  isLoading: false,
  isSaving: false,
  error: null,
  currentPage: 1,
  hasMore: true,

  // -------------------------------------------------------------------------
  // Mutations de l'éditeur
  // -------------------------------------------------------------------------

  setTitle(title: string): void {
    const current = get().currentPost;
    if (!current) {
      set({ currentPost: { title, markdownContent: '', tags: [], featureImage: null, isDirty: true } });
      return;
    }
    set({ currentPost: { ...current, title, isDirty: true } });
  },

  setMarkdownContent(content: string): void {
    const current = get().currentPost;
    if (!current) {
      set({ currentPost: { title: '', markdownContent: content, tags: [], featureImage: null, isDirty: true } });
      return;
    }
    set({ currentPost: { ...current, markdownContent: content, isDirty: true } });
  },

  setTags(tags: string[]): void {
    const current = get().currentPost;
    if (!current) {
      set({ currentPost: { title: '', markdownContent: '', tags, featureImage: null, isDirty: true } });
      return;
    }
    set({ currentPost: { ...current, tags, isDirty: true } });
  },

  setFeatureImage(url: string | null): void {
    const current = get().currentPost;
    if (!current) {
      set({ currentPost: { title: '', markdownContent: '', tags: [], featureImage: url, isDirty: true } });
      return;
    }
    set({ currentPost: { ...current, featureImage: url, isDirty: true } });
  },

  loadPostForEditing(post: GhostPost): void {
    const markdownContent = htmlToMarkdown(post.html);
    const tags = post.tags.map((t) => t.name);
    const originalStatus = post.status === 'scheduled' ? 'published' : post.status;

    set({
      currentPost: {
        ghostId: post.id,
        title: post.title,
        markdownContent,
        tags,
        featureImage: post.feature_image,
        originalUpdatedAt: post.updated_at,
        originalStatus,
        isDirty: false,
      },
    });
  },

  resetCurrentPost(): void {
    set({ currentPost: null });
  },

  resetPosts(): void {
    set({ posts: [], currentPage: 1, hasMore: true, error: null });
  },

  clearError(): void {
    set({ error: null });
  },

  // -------------------------------------------------------------------------
  // Chargement des posts
  // -------------------------------------------------------------------------

  async fetchPosts(reset = false): Promise<void> {
    if (get().isLoading) return;

    const page = reset ? 1 : get().currentPage;
    set({ isLoading: true, error: null });

    try {
      const response = await getPosts(page, get().statusFilter as PostFilter);
      const { posts: newPosts, meta } = response;

      set({
        posts: reset ? newPosts : [...get().posts, ...newPosts],
        currentPage: page,
        hasMore: meta.pagination.next !== null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Erreur fetchPosts:', error instanceof Error ? error.message : error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erreur lors du chargement des posts.',
      });
    }
  },

  async fetchMorePosts(): Promise<void> {
    if (get().isLoading || !get().hasMore) return;

    const nextPage = get().currentPage + 1;
    set({ isLoading: true, error: null });

    try {
      const response = await getPosts(nextPage, get().statusFilter as PostFilter);
      const { posts: newPosts, meta } = response;

      set({
        posts: [...get().posts, ...newPosts],
        currentPage: nextPage,
        hasMore: meta.pagination.next !== null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Erreur fetchMorePosts:', error instanceof Error ? error.message : error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erreur lors du chargement.',
      });
    }
  },

  // -------------------------------------------------------------------------
  // Sauvegarde / suppression
  // -------------------------------------------------------------------------

  async saveCurrentPost(status: 'draft' | 'published'): Promise<GhostPost> {
    const current = get().currentPost;
    if (!current) throw new Error('Aucun post en cours d\'édition');

    // Garde-fou : un post existant ne doit jamais être écrasé par un contenu vide
    // (cf. bug Android où la sélection de texte peut vider le TextInput contrôlé).
    if (current.ghostId && current.markdownContent.trim() === '') {
      const message = 'Le contenu est vide — sauvegarde annulée pour éviter d\'écraser le post existant.';
      set({ error: message });
      throw new Error(message);
    }

    set({ isSaving: true, error: null });

    const html = markdownToHtml(current.markdownContent);
    const tags = current.tags.map((name) => ({ name }));

    try {
      let savedPost: GhostPost;

      if (current.ghostId && current.originalUpdatedAt) {
        // Mise à jour — updated_at obligatoire pour l'optimistic lock Ghost
        savedPost = await updatePost(current.ghostId, {
          posts: [
            {
              title: current.title,
              html,
              status,
              tags,
              feature_image: current.featureImage,
              updated_at: current.originalUpdatedAt,
            },
          ],
        });
      } else {
        // Création
        savedPost = await createPost({
          posts: [{ title: current.title, html, status, tags, feature_image: current.featureImage }],
        });
      }

      // Met à jour le currentPost avec les nouvelles métadonnées Ghost
      set({
        isSaving: false,
        currentPost: {
          ...current,
          ghostId: savedPost.id,
          featureImage: savedPost.feature_image,
          originalUpdatedAt: savedPost.updated_at,
          originalStatus: savedPost.status === 'scheduled' ? 'published' : savedPost.status,
          isDirty: false,
        },
      });

      return savedPost;
    } catch (error) {
      const message = error instanceof ConflictError
        ? 'Le post a été modifié depuis votre dernier chargement. Rechargez-le avant de sauvegarder.'
        : error instanceof Error
          ? error.message
          : 'Erreur lors de la sauvegarde.';

      console.error('Erreur saveCurrentPost:', message);
      set({ isSaving: false, error: message });
      throw error;
    }
  },

  async deletePost(id: string): Promise<void> {
    set({ error: null });
    try {
      await deletePostApi(id);
      set({ posts: get().posts.filter((p) => p.id !== id) });
    } catch (error) {
      console.error('Erreur deletePost:', error instanceof Error ? error.message : error);
      set({ error: error instanceof Error ? error.message : 'Erreur lors de la suppression.' });
      throw error;
    }
  },

  setStatusFilter(filter: StatusFilter): void {
    set({ statusFilter: filter, posts: [], currentPage: 1, hasMore: true });
  },
}));
