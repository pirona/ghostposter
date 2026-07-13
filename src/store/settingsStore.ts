import { create } from 'zustand';
import { getSecureItem, setSecureItem } from '../utils/secureStorage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type DefaultPostStatus = 'draft' | 'published';

interface SettingsState {
  themePreference: ThemePreference;
  defaultPostStatus: DefaultPostStatus;
  confirmDelete: boolean;
  voiceVocabulary: string[];
  isLoaded: boolean;
}

interface SettingsActions {
  loadSettings(): Promise<void>;
  setThemePreference(pref: ThemePreference): Promise<void>;
  setDefaultPostStatus(status: DefaultPostStatus): Promise<void>;
  setConfirmDelete(value: boolean): Promise<void>;
  setVoiceVocabulary(terms: string[]): Promise<void>;
}

export const useSettingsStore = create<SettingsState & SettingsActions>((set) => ({
  themePreference: 'system',
  defaultPostStatus: 'draft',
  confirmDelete: true,
  voiceVocabulary: [],
  isLoaded: false,

  async loadSettings(): Promise<void> {
    const theme = await getSecureItem('SETTINGS_THEME');
    const status = await getSecureItem('SETTINGS_DEFAULT_STATUS');
    const confirm = await getSecureItem('SETTINGS_CONFIRM_DELETE');
    const vocabularyJson = await getSecureItem('SETTINGS_VOICE_VOCABULARY');
    set({
      themePreference: (theme as ThemePreference) ?? 'system',
      defaultPostStatus: (status as DefaultPostStatus) ?? 'draft',
      confirmDelete: confirm !== 'false',
      voiceVocabulary: vocabularyJson ? (JSON.parse(vocabularyJson) as string[]) : [],
      isLoaded: true,
    });
  },

  async setThemePreference(pref): Promise<void> {
    set({ themePreference: pref });
    await setSecureItem('SETTINGS_THEME', pref);
  },

  async setDefaultPostStatus(status): Promise<void> {
    set({ defaultPostStatus: status });
    await setSecureItem('SETTINGS_DEFAULT_STATUS', status);
  },

  async setConfirmDelete(value): Promise<void> {
    set({ confirmDelete: value });
    await setSecureItem('SETTINGS_CONFIRM_DELETE', String(value));
  },

  async setVoiceVocabulary(terms): Promise<void> {
    set({ voiceVocabulary: terms });
    await setSecureItem('SETTINGS_VOICE_VOCABULARY', JSON.stringify(terms));
  },
}));
