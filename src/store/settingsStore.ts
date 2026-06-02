import { create } from 'zustand';
import { getSecureItem, setSecureItem } from '../utils/secureStorage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type DefaultPostStatus = 'draft' | 'published';

interface SettingsState {
  themePreference: ThemePreference;
  defaultPostStatus: DefaultPostStatus;
  confirmDelete: boolean;
  isLoaded: boolean;
}

interface SettingsActions {
  loadSettings(): Promise<void>;
  setThemePreference(pref: ThemePreference): Promise<void>;
  setDefaultPostStatus(status: DefaultPostStatus): Promise<void>;
  setConfirmDelete(value: boolean): Promise<void>;
}

export const useSettingsStore = create<SettingsState & SettingsActions>((set) => ({
  themePreference: 'system',
  defaultPostStatus: 'draft',
  confirmDelete: true,
  isLoaded: false,

  async loadSettings(): Promise<void> {
    const theme = await getSecureItem('SETTINGS_THEME');
    const status = await getSecureItem('SETTINGS_DEFAULT_STATUS');
    const confirm = await getSecureItem('SETTINGS_CONFIRM_DELETE');
    set({
      themePreference: (theme as ThemePreference) ?? 'system',
      defaultPostStatus: (status as DefaultPostStatus) ?? 'draft',
      confirmDelete: confirm !== 'false',
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
}));
