// SPDX-License-Identifier: GPL-3.0-or-later
import { create } from 'zustand';

import { getSecureItem, setSecureItem } from '../utils/secureStorage';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEMES: ThemePreference[] = ['light', 'dark', 'system'];

interface SettingsState {
  themePreference: ThemePreference;
  confirmDelete: boolean;
  voiceVocabulary: string[];
  isLoaded: boolean;
}

interface SettingsActions {
  loadSettings(): Promise<void>;
  setThemePreference(pref: ThemePreference): Promise<void>;
  setConfirmDelete(value: boolean): Promise<void>;
  setVoiceVocabulary(terms: string[]): Promise<void>;
}

function parseStringArray(json: string | null): string[] {
  try {
    const value: unknown = json ? JSON.parse(json) : [];
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export const useSettingsStore = create<SettingsState & SettingsActions>((set) => ({
  themePreference: 'system',
  confirmDelete: true,
  voiceVocabulary: [],
  isLoaded: false,

  async loadSettings() {
    try {
      const theme = await getSecureItem('SETTINGS_THEME');
      const confirm = await getSecureItem('SETTINGS_CONFIRM_DELETE');
      const vocabulary = await getSecureItem('SETTINGS_VOICE_VOCABULARY');
      set({
        themePreference: THEMES.includes(theme as ThemePreference) ? (theme as ThemePreference) : 'system',
        confirmDelete: confirm !== 'false',
        voiceVocabulary: parseStringArray(vocabulary),
      });
    } finally {
      set({ isLoaded: true });
    }
  },

  async setThemePreference(pref) {
    set({ themePreference: pref });
    await setSecureItem('SETTINGS_THEME', pref);
  },

  async setConfirmDelete(value) {
    set({ confirmDelete: value });
    await setSecureItem('SETTINGS_CONFIRM_DELETE', String(value));
  },

  async setVoiceVocabulary(terms) {
    set({ voiceVocabulary: terms });
    await setSecureItem('SETTINGS_VOICE_VOCABULARY', JSON.stringify(terms));
  },
}));
