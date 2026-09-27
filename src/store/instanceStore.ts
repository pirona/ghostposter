// SPDX-License-Identifier: GPL-3.0-or-later
// Configured Ghost instances, persisted in SecureStore. API keys are never logged.
// Other stores react to activeInstanceId through subscribe() — this module imports none of them.

import { create } from 'zustand';
import * as Crypto from 'expo-crypto';

import { getSecureItem, setSecureItem, deleteSecureItem } from '../utils/secureStorage';

export interface GhostInstance {
  id: string;
  name: string;
  /** Base URL without trailing slash, e.g. https://blog.example.internal */
  url: string;
  /** Admin API key, `id:secret` in hex. */
  apiKey: string;
}

interface InstanceState {
  instances: GhostInstance[];
  activeInstanceId: string | null;
  /** Bumped whenever the active instance's URL or key changes, so caches can drop. */
  credentialsVersion: number;
  isLoading: boolean;
  error: string | null;
}

interface InstanceActions {
  loadInstances(): Promise<void>;
  getActiveInstance(): GhostInstance | null;
  addInstance(data: Omit<GhostInstance, 'id'>): Promise<GhostInstance>;
  updateInstance(id: string, data: Partial<Omit<GhostInstance, 'id'>>): Promise<void>;
  /** Removing the active instance activates the first remaining one, if any. */
  removeInstance(id: string): Promise<void>;
  setActiveInstance(id: string): Promise<void>;
}

function isInstance(value: unknown): value is GhostInstance {
  const i = value as GhostInstance;
  return typeof i === 'object' && i !== null
    && typeof i.id === 'string' && typeof i.name === 'string'
    && typeof i.url === 'string' && typeof i.apiKey === 'string';
}

async function persist(instances: GhostInstance[], activeId: string | null): Promise<void> {
  await setSecureItem('GHOST_INSTANCES', JSON.stringify(instances));
  if (activeId) await setSecureItem('GHOST_ACTIVE_ID', activeId);
  else await deleteSecureItem('GHOST_ACTIVE_ID');
}

export const useInstanceStore = create<InstanceState & InstanceActions>((set, get) => ({
  instances: [],
  activeInstanceId: null,
  credentialsVersion: 0,
  isLoading: true,
  error: null,

  async loadInstances() {
    set({ isLoading: true, error: null });
    try {
      const json = await getSecureItem('GHOST_INSTANCES');
      const activeId = await getSecureItem('GHOST_ACTIVE_ID');
      const parsed: unknown = json ? JSON.parse(json) : [];
      const instances = Array.isArray(parsed) ? parsed.filter(isInstance) : [];
      const validActive = instances.some((i) => i.id === activeId) ? activeId : instances[0]?.id ?? null;
      set({ instances, activeInstanceId: validActive, isLoading: false });
    } catch (error) {
      console.error('loadInstances failed:', error instanceof Error ? error.message : error);
      set({ isLoading: false, error: 'Impossible de charger les instances configurées.' });
    }
  },

  getActiveInstance() {
    const { instances, activeInstanceId } = get();
    return instances.find((i) => i.id === activeInstanceId) ?? null;
  },

  async addInstance(data) {
    const instance: GhostInstance = { ...data, id: Crypto.randomUUID() };
    const instances = [...get().instances, instance];
    const activeId = get().activeInstanceId ?? instance.id;
    await persist(instances, activeId);
    set({ instances, activeInstanceId: activeId });
    return instance;
  },

  async updateInstance(id, data) {
    const previous = get().instances.find((i) => i.id === id);
    if (!previous) throw new Error('Instance introuvable');
    const updated = { ...previous, ...data };
    const instances = get().instances.map((i) => (i.id === id ? updated : i));
    await persist(instances, get().activeInstanceId);

    const credentialsChanged = updated.url !== previous.url || updated.apiKey !== previous.apiKey;
    set((s) => ({
      instances,
      credentialsVersion:
        credentialsChanged && id === s.activeInstanceId ? s.credentialsVersion + 1 : s.credentialsVersion,
    }));
  },

  async removeInstance(id) {
    const instances = get().instances.filter((i) => i.id !== id);
    const current = get().activeInstanceId;
    const activeId = current === id ? instances[0]?.id ?? null : current;
    await persist(instances, activeId);
    set({ instances, activeInstanceId: activeId });
  },

  async setActiveInstance(id) {
    if (!get().instances.some((i) => i.id === id)) throw new Error('Instance introuvable');
    await setSecureItem('GHOST_ACTIVE_ID', id);
    set({ activeInstanceId: id });
  },
}));
