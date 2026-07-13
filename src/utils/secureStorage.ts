/**
 * @file src/utils/secureStorage.ts
 * @description Wrapper typé autour de expo-secure-store.
 *              Toutes les opérations de lecture/écriture de secrets passent par ce module.
 *              Aucune valeur sensible n'est loggée.
 *
 * @exports getSecureItem
 * @exports setSecureItem
 * @exports deleteSecureItem
 * @exports hasActiveInstance
 */

import * as SecureStore from 'expo-secure-store';

/**
 * Clés autorisées dans SecureStore — union type pour éviter les typos.
 * - GHOST_INSTANCES : JSON sérialisé de GhostInstance[]
 * - GHOST_ACTIVE_ID : uuid de l'instance active
 */
type SecureKey =
  | 'GHOST_INSTANCES'
  | 'GHOST_ACTIVE_ID'
  | 'SETTINGS_THEME'
  | 'SETTINGS_DEFAULT_STATUS'
  | 'SETTINGS_CONFIRM_DELETE'
  | 'SETTINGS_VOICE_VOCABULARY';

/**
 * Lit une valeur depuis SecureStore.
 * @param key - Clé de stockage
 * @returns La valeur stockée, ou null si absente
 * @throws Error si la lecture échoue (permission, corruption)
 */
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getSecureItem(key: SecureKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, SECURE_OPTS);
  } catch (error) {
    throw new Error(
      `Erreur de lecture SecureStore (${key}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Écrit une valeur dans SecureStore.
 * @param key - Clé de stockage
 * @param value - Valeur à stocker (ne pas passer de credentials en clair dans les logs)
 * @throws Error si l'écriture échoue
 */
export async function setSecureItem(key: SecureKey, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value, SECURE_OPTS);
  } catch (error) {
    throw new Error(
      `Erreur d'écriture SecureStore (${key}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Supprime une entrée de SecureStore.
 * @param key - Clé à supprimer
 * @throws Error si la suppression échoue
 */
export async function deleteSecureItem(key: SecureKey): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, SECURE_OPTS);
  } catch (error) {
    throw new Error(
      `Erreur de suppression SecureStore (${key}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Vérifie qu'une instance Ghost active et valide est configurée.
 * Utilisé au démarrage pour décider de la route initiale.
 * @returns true si une instance active correspondant à un enregistrement connu existe
 */
export async function hasActiveInstance(): Promise<boolean> {
  try {
    const activeId = await getSecureItem('GHOST_ACTIVE_ID');
    if (!activeId) return false;

    const instancesJson = await getSecureItem('GHOST_INSTANCES');
    if (!instancesJson) return false;

    const instances = JSON.parse(instancesJson) as Array<{ id: string }>;
    return Array.isArray(instances) && instances.some((i) => i.id === activeId);
  } catch {
    return false;
  }
}
