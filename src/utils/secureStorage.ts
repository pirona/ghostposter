// SPDX-License-Identifier: GPL-3.0-or-later
// Typed wrapper around expo-secure-store. Values are never logged.

import * as SecureStore from 'expo-secure-store';

type SecureKey =
  | 'GHOST_INSTANCES'
  | 'GHOST_ACTIVE_ID'
  | 'SETTINGS_THEME'
  | 'SETTINGS_CONFIRM_DELETE'
  | 'SETTINGS_VOICE_VOCABULARY';

const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function wrap(op: string, key: SecureKey, error: unknown): Error {
  return new Error(`SecureStore ${op} failed (${key}): ${error instanceof Error ? error.message : String(error)}`);
}

export async function getSecureItem(key: SecureKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, SECURE_OPTS);
  } catch (error) {
    throw wrap('read', key, error);
  }
}

export async function setSecureItem(key: SecureKey, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value, SECURE_OPTS);
  } catch (error) {
    throw wrap('write', key, error);
  }
}

export async function deleteSecureItem(key: SecureKey): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, SECURE_OPTS);
  } catch (error) {
    throw wrap('delete', key, error);
  }
}
