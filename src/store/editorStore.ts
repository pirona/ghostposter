// SPDX-License-Identifier: GPL-3.0-or-later
// State of the post being edited: fields, undo/redo history, save/conflict handling,
// and a local autosave so an app kill doesn't lose unsaved work.

import { create } from 'zustand';
import * as FileSystem from 'expo-file-system';

import { getPost, createPost, updatePost, deletePost, getTags } from '../api/ghostClient';
import { GhostPost, PostMeta, PostStatus, PostWriteFields } from '../api/ghostTypes';
import { htmlToMarkdown, markdownToHtml } from '../utils/contentConverter';
import { resolveEmbeds } from '../utils/embeds';
import { useInstanceStore } from './instanceStore';

export interface PostFields {
  title: string;
  markdown: string;
  tags: string[];
  featureImage: string | null;
  meta: PostMeta;
}

export const EMPTY_META: PostMeta = {
  custom_excerpt: null,
  meta_title: null,
  meta_description: null,
  og_title: null,
  og_description: null,
  twitter_title: null,
  twitter_description: null,
};

const EMPTY_FIELDS: PostFields = { title: '', markdown: '', tags: [], featureImage: null, meta: EMPTY_META };

const HISTORY_LIMIT = 100;
// Keystrokes (and voice interim results) on the same field within this window form one undo step.
const COALESCE_MS = 1000;
const AUTOSAVE_DELAY_MS = 1500;
const AUTOSAVE_PATH = `${FileSystem.documentDirectory}editor-autosave.json`;

interface Autosave {
  instanceId: string;
  ghostId?: string;
  updatedAt?: string;
  status: PostStatus | null;
  fields: PostFields;
  savedAt: string;
}

interface EditorState {
  fields: PostFields;
  /** Last state known to match the server — isDirty compares against it. */
  baseline: PostFields;
  ghostId?: string;
  /** Instance the post belongs to; saving is refused if the active one differs. */
  instanceId: string | null;
  updatedAt?: string;
  /** null for a post that was never saved. */
  status: PostStatus | null;
  url?: string;
  past: PostFields[];
  future: PostFields[];
  lastEdit: { key: string; at: number } | null;
  isLoading: boolean;
  isSaving: boolean;
  availableTags: string[];
  restorable: Autosave | null;
}

interface EditorActions {
  update(patch: Partial<PostFields>): void;
  updateMeta(patch: Partial<PostMeta>): void;
  undo(): void;
  redo(): void;
  /** Back to the last saved state, as one undoable step. */
  revert(): void;
  newPost(): void;
  /** Always re-fetches: list data has no body and may carry a stale updated_at. */
  openPost(id: string): Promise<void>;
  reload(): Promise<void>;
  /** @throws ConflictError when the post changed on the server since it was loaded. */
  save(status: PostStatus): Promise<GhostPost>;
  /** Saves over a newer server version (after the user chose to on a conflict). */
  overwrite(status: PostStatus): Promise<GhostPost>;
  deleteCurrent(): Promise<void>;
  loadTags(): Promise<void>;
  checkAutosave(): Promise<void>;
  restoreAutosave(): void;
  discardAutosave(): Promise<void>;
}

export type EditorStore = EditorState & EditorActions;

export const selectIsDirty = (s: EditorState): boolean =>
  JSON.stringify(s.fields) !== JSON.stringify(s.baseline);

function fieldsFromPost(post: GhostPost): PostFields {
  return {
    title: post.title,
    markdown: htmlToMarkdown(post.html),
    tags: post.tags.map((t) => t.name),
    featureImage: post.feature_image,
    meta: {
      custom_excerpt: post.custom_excerpt,
      meta_title: post.meta_title,
      meta_description: post.meta_description,
      og_title: post.og_title,
      og_description: post.og_description,
      twitter_title: post.twitter_title,
      twitter_description: post.twitter_description,
    },
  };
}

function blankToNull(meta: PostMeta): PostMeta {
  const out = { ...meta };
  for (const key of Object.keys(out) as Array<keyof PostMeta>) {
    const value = out[key]?.trim();
    out[key] = value ? value : null;
  }
  return out;
}

function freshState(): Partial<EditorState> {
  return {
    fields: EMPTY_FIELDS,
    baseline: EMPTY_FIELDS,
    ghostId: undefined,
    instanceId: useInstanceStore.getState().activeInstanceId,
    updatedAt: undefined,
    status: null,
    url: undefined,
    past: [],
    future: [],
    lastEdit: null,
    restorable: null,
  };
}

export const useEditorStore = create<EditorStore>((set, get) => {
  function applyPost(post: GhostPost): void {
    const fields = fieldsFromPost(post);
    set({
      ...freshState(),
      fields,
      baseline: fields,
      ghostId: post.id,
      updatedAt: post.updated_at,
      status: post.status,
      url: post.url,
    });
  }

  function record(next: PostFields, key: string): void {
    const { fields, past, lastEdit } = get();
    const now = Date.now();
    const coalesce = lastEdit !== null && lastEdit.key === key && now - lastEdit.at < COALESCE_MS;
    set({
      fields: next,
      past: coalesce ? past : [...past, fields].slice(-HISTORY_LIMIT),
      future: [],
      lastEdit: { key, at: now },
    });
  }

  return {
    ...(freshState() as EditorState),
    isLoading: false,
    isSaving: false,
    availableTags: [],

    update(patch) {
      record({ ...get().fields, ...patch }, Object.keys(patch).sort().join(','));
    },

    updateMeta(patch) {
      const { fields } = get();
      record({ ...fields, meta: { ...fields.meta, ...patch } }, `meta:${Object.keys(patch).join(',')}`);
    },

    undo() {
      const { past, future, fields } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      set({ fields: previous, past: past.slice(0, -1), future: [fields, ...future], lastEdit: null });
    },

    redo() {
      const { past, future, fields } = get();
      const next = future[0];
      if (!next) return;
      set({ fields: next, past: [...past, fields], future: future.slice(1), lastEdit: null });
    },

    revert() {
      const { fields, baseline, past } = get();
      set({ fields: baseline, past: [...past, fields].slice(-HISTORY_LIMIT), future: [], lastEdit: null });
    },

    newPost() {
      set(freshState());
    },

    async openPost(id) {
      set({ ...freshState(), isLoading: true });
      try {
        applyPost(await getPost(id));
      } finally {
        set({ isLoading: false });
      }
    },

    async reload() {
      const { ghostId } = get();
      if (ghostId) await get().openPost(ghostId);
    },

    async save(status) {
      const state = get();
      const { fields, ghostId, updatedAt } = state;
      const activeId = useInstanceStore.getState().activeInstanceId;

      if (state.instanceId !== activeId) {
        throw new Error('Ce post appartient à une autre instance — rebasculez dessus pour le sauvegarder.');
      }
      if (!fields.title.trim()) throw new Error('Le titre est obligatoire.');
      // An existing post must never be overwritten with an empty body.
      if (ghostId && !fields.markdown.trim()) {
        throw new Error('Le contenu est vide — sauvegarde annulée pour ne pas écraser le post.');
      }

      set({ isSaving: true });
      try {
        const renderEmbed = await resolveEmbeds(fields.markdown);
        const body: PostWriteFields = {
          title: fields.title.trim(),
          html: markdownToHtml(fields.markdown, renderEmbed),
          status,
          tags: fields.tags.map((name) => ({ name })),
          feature_image: fields.featureImage,
          ...blankToNull(fields.meta),
        };

        const saved = ghostId && updatedAt
          ? await updatePost(ghostId, { posts: [{ ...body, updated_at: updatedAt }] })
          : await createPost({ posts: [body] });

        // Baseline is what was sent: edits typed while the request was in flight stay dirty.
        set({
          baseline: fields,
          ghostId: saved.id,
          updatedAt: saved.updated_at,
          status: saved.status,
          url: saved.url,
        });
        void get().discardAutosave();
        return saved;
      } finally {
        set({ isSaving: false });
      }
    },

    async overwrite(status) {
      const { ghostId } = get();
      if (!ghostId) return get().save(status);
      const latest = await getPost(ghostId);
      set({ updatedAt: latest.updated_at });
      return get().save(status);
    },

    async deleteCurrent() {
      const { ghostId } = get();
      if (ghostId) await deletePost(ghostId);
      await get().discardAutosave();
      set(freshState());
    },

    async loadTags() {
      try {
        const tags = await getTags();
        set({ availableTags: tags.map((t) => t.name).sort((a, b) => a.localeCompare(b)) });
      } catch {
        // Suggestions are a convenience — the editor works without them.
      }
    },

    async checkAutosave() {
      try {
        const info = await FileSystem.getInfoAsync(AUTOSAVE_PATH);
        if (!info.exists) return;
        const data = JSON.parse(await FileSystem.readAsStringAsync(AUTOSAVE_PATH)) as Autosave;
        const sameInstance = data.instanceId === useInstanceStore.getState().activeInstanceId;
        if (sameInstance && data.fields && !selectIsDirty(get())) set({ restorable: data });
      } catch {
        // Unreadable autosave: nothing sensible to restore.
      }
    },

    restoreAutosave() {
      const data = get().restorable;
      if (!data) return;
      set({
        ...freshState(),
        fields: data.fields,
        // Unknown server state: keep the restored content dirty until saved.
        baseline: EMPTY_FIELDS,
        ghostId: data.ghostId,
        updatedAt: data.updatedAt,
        status: data.status,
      });
    },

    async discardAutosave() {
      set({ restorable: null });
      await FileSystem.deleteAsync(AUTOSAVE_PATH, { idempotent: true }).catch(() => undefined);
    },
  };
});

// ---------------------------------------------------------------------------
// Side effects
// ---------------------------------------------------------------------------

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

useEditorStore.subscribe((state, prev) => {
  if (state.fields === prev.fields || !selectIsDirty(state) || !state.instanceId) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const s = useEditorStore.getState();
    if (!selectIsDirty(s) || !s.instanceId) return;
    const data: Autosave = {
      instanceId: s.instanceId,
      ghostId: s.ghostId,
      updatedAt: s.updatedAt,
      status: s.status,
      fields: s.fields,
      savedAt: new Date().toISOString(),
    };
    FileSystem.writeAsStringAsync(AUTOSAVE_PATH, JSON.stringify(data)).catch(() => undefined);
  }, AUTOSAVE_DELAY_MS);
});

useInstanceStore.subscribe((state, prev) => {
  if (state.activeInstanceId !== prev.activeInstanceId) {
    useEditorStore.setState({ ...freshState(), availableTags: [] });
  } else if (state.credentialsVersion !== prev.credentialsVersion) {
    useEditorStore.setState({ availableTags: [] });
  }
});
