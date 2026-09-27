// SPDX-License-Identifier: GPL-3.0-or-later
// Instance form validation, connection test and confirmations on top of instanceStore.

import { useState } from 'react';
import { Alert } from 'react-native';

import { useInstanceStore, GhostInstance } from '../store/instanceStore';
import { testGhostConnection } from '../api/ghostClient';
import {
  AuthenticationError,
  GhostApiError,
  InvalidApiKeyError,
  RateLimitError,
} from '../api/ghostTypes';

export interface InstanceFormData {
  name: string;
  url: string;
  /** Empty when editing means "keep the stored key". */
  apiKey: string;
}

export type InstanceFormErrors = Partial<Record<keyof InstanceFormData, string>>;

const API_KEY_RE = /^[a-f0-9]+:[a-f0-9]+$/i;

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function validate(data: InstanceFormData, editing: boolean): InstanceFormErrors {
  const errors: InstanceFormErrors = {};
  const url = normalizeUrl(data.url);
  const key = data.apiKey.trim();

  if (!data.name.trim()) errors.name = 'Le nom est requis.';
  if (!url) errors.url = "L'URL est requise.";
  else if (!/^https:\/\/[^\s/]+/.test(url)) errors.url = "L'URL doit commencer par https://";

  if (!key && !editing) errors.apiKey = 'La clé Admin API est requise.';
  else if (key && !API_KEY_RE.test(key)) {
    errors.apiKey = 'Format invalide. Attendu : id:secret (caractères hexadécimaux uniquement).';
  }
  return errors;
}

function connectionError(err: unknown): InstanceFormErrors {
  if (err instanceof AuthenticationError || err instanceof InvalidApiKeyError) {
    return { apiKey: 'Clé API invalide ou accès refusé.' };
  }
  if (err instanceof RateLimitError) {
    return { url: 'Trop de tentatives — attendez quelques secondes avant de réessayer.' };
  }
  if (err instanceof GhostApiError && err.status >= 500) {
    return { url: `Erreur serveur Ghost (${err.status}). Vérifiez que l'instance est opérationnelle.` };
  }
  if (err instanceof GhostApiError && err.status === 404) {
    return { url: "Aucune API Ghost à cette adresse (404). Vérifiez l'URL." };
  }
  return { url: `Connexion impossible : ${err instanceof Error ? err.message : String(err)}` };
}

export function useInstances() {
  const store = useInstanceStore();
  const [isTesting, setIsTesting] = useState(false);

  /**
   * Adds a new instance, or updates `editing` in place. The connection is tested only
   * when URL or key change, so renaming works offline.
   * @returns field errors, or null on success
   */
  async function saveInstance(
    data: InstanceFormData,
    editing?: GhostInstance,
  ): Promise<InstanceFormErrors | null> {
    const errors = validate(data, !!editing);
    if (Object.keys(errors).length > 0) return errors;

    const next = {
      name: data.name.trim(),
      url: normalizeUrl(data.url),
      apiKey: data.apiKey.trim() || editing?.apiKey || '',
    };
    const needsTest = !editing || next.url !== editing.url || next.apiKey !== editing.apiKey;

    setIsTesting(true);
    try {
      if (needsTest) await testGhostConnection(next.url, next.apiKey);
      if (editing) await store.updateInstance(editing.id, next);
      else await store.addInstance(next);
      return null;
    } catch (err) {
      return connectionError(err);
    } finally {
      setIsTesting(false);
    }
  }

  function removeInstanceWithConfirm(instance: GhostInstance, onRemoved?: () => void): void {
    const isActive = instance.id === store.activeInstanceId;
    Alert.alert(
      "Supprimer l'instance",
      `Supprimer « ${instance.name} » de l'application ?${isActive ? "\n\nC'est l'instance active." : ''}\n\n`
        + "Seule la configuration locale est supprimée : rien n'est modifié sur le blog. "
        + 'Pensez à révoquer la clé dans Ghost Admin → Intégrations si elle ne sert plus.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            store.removeInstance(instance.id).then(onRemoved).catch((err) => {
              Alert.alert('Erreur', err instanceof Error ? err.message : String(err));
            });
          },
        },
      ],
    );
  }

  return {
    instances: store.instances,
    activeInstanceId: store.activeInstanceId,
    isLoading: store.isLoading,
    isTesting,
    saveInstance,
    removeInstanceWithConfirm,
    setActiveInstance: store.setActiveInstance,
  };
}
