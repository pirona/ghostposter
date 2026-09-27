// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Divider,
  HelperText,
  List,
  Modal,
  Portal,
  SegmentedButtons,
  Snackbar,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import Constants from 'expo-constants';

import { useInstances, InstanceFormData, InstanceFormErrors } from '../src/hooks/useInstances';
import { useSettingsStore, ThemePreference } from '../src/store/settingsStore';
import { GhostInstance } from '../src/store/instanceStore';
import { InstanceListItem } from '../src/components/InstanceListItem';
import { TagChipList } from '../src/components/TagChipList';
import { confirmDiscardChanges } from '../src/utils/editorGuard';

const EMPTY_FORM: InstanceFormData = { name: '', url: '', apiKey: '' };

export default function SettingsScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const instances = useInstances();
  const settings = useSettingsStore();

  // `editing` undefined = modal closed, null = adding, instance = editing it.
  const [editing, setEditing] = useState<GhostInstance | null | undefined>(undefined);
  const [form, setForm] = useState<InstanceFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<InstanceFormErrors>({});
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const appVersion = Constants.expoConfig?.version ?? '—';
  const busy = instances.isTesting;

  function openForm(instance: GhostInstance | null): void {
    // The key is never shown back: an empty field while editing keeps the stored one.
    setForm(instance ? { name: instance.name, url: instance.url, apiKey: '' } : EMPTY_FORM);
    setErrors({});
    setEditing(instance);
  }

  function updateField(field: keyof InstanceFormData, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function submit(): Promise<void> {
    const result = await instances.saveInstance(form, editing ?? undefined);
    if (result) {
      setErrors(result);
      return;
    }
    setSnackbar(editing ? 'Instance mise à jour.' : 'Instance ajoutée et connectée.');
    setEditing(undefined);
  }

  function select(instance: GhostInstance): void {
    confirmDiscardChanges(() => {
      instances.setActiveInstance(instance.id)
        .then(() => setSnackbar(`Instance « ${instance.name} » activée.`))
        .catch(() => undefined);
    });
  }

  function removeInstance(instance: GhostInstance): void {
    const remove = (): void =>
      instances.removeInstanceWithConfirm(instance, () => setSnackbar('Instance supprimée.'));
    // Removing the active instance switches away from it, which resets the editor.
    if (instance.id === instances.activeInstanceId) confirmDiscardChanges(remove);
    else remove();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <List.Subheader style={[styles.subheader, { color: colors.primary }]}>Instances Ghost</List.Subheader>
        <View style={[styles.card, styles.flushCard, { backgroundColor: colors.surface }]}>
          {instances.isLoading ? (
            <ActivityIndicator style={styles.loader} />
          ) : instances.instances.length === 0 ? (
            <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
              Aucune instance configurée.
            </Text>
          ) : (
            instances.instances.map((item, i) => (
              <View key={item.id}>
                {i > 0 && <Divider />}
                <InstanceListItem
                  instance={item}
                  isActive={item.id === instances.activeInstanceId}
                  onSelect={select}
                  onEdit={openForm}
                  onDelete={removeInstance}
                />
              </View>
            ))
          )}
          <Button icon="plus" mode="text" onPress={() => openForm(null)} style={styles.addButton}>
            Ajouter une instance
          </Button>
        </View>

        <List.Subheader style={[styles.subheader, { color: colors.primary }]}>Éditeur</List.Subheader>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text variant="bodyMedium" style={{ color: colors.onSurface }}>Confirmation avant suppression</Text>
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                Demander confirmation avant de supprimer un post depuis la liste
              </Text>
            </View>
            <Switch value={settings.confirmDelete} onValueChange={settings.setConfirmDelete} color={colors.primary} />
          </View>
        </View>

        <List.Subheader style={[styles.subheader, { color: colors.primary }]}>Reconnaissance vocale</List.Subheader>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text variant="bodyMedium" style={[styles.settingLabel, { color: colors.onSurface }]}>
            Vocabulaire spécifique
          </Text>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            Termes techniques à privilégier lors de la dictée (ex : HAProxy, n8n, Kubernetes)
          </Text>
          <TagChipList
            tags={settings.voiceVocabulary}
            onTagsChange={settings.setVoiceVocabulary}
            placeholder="Ajouter des termes (séparés par une virgule)"
          />
        </View>

        <List.Subheader style={[styles.subheader, { color: colors.primary }]}>Apparence</List.Subheader>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <SegmentedButtons
            value={settings.themePreference}
            onValueChange={(v) => void settings.setThemePreference(v as ThemePreference)}
            buttons={[
              { value: 'light', label: 'Clair', icon: 'white-balance-sunny' },
              { value: 'system', label: 'Auto', icon: 'brightness-auto' },
              { value: 'dark', label: 'Sombre', icon: 'weather-night' },
            ]}
          />
        </View>

        <List.Subheader style={[styles.subheader, { color: colors.primary }]}>À propos</List.Subheader>
        <View style={[styles.card, styles.flushCard, { backgroundColor: colors.surface }]}>
          <List.Item
            title="Version"
            right={() => <Text variant="bodyMedium" style={styles.alignCenter}>{appVersion}</Text>}
          />
          <Divider />
          <List.Item title="Ghost Admin API" description="v5 compatible" />
        </View>
      </ScrollView>

      <Portal>
        <Modal
          visible={editing !== undefined}
          onDismiss={() => !busy && setEditing(undefined)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <KeyboardAvoidingView behavior="height">
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text variant="titleLarge" style={styles.modalTitle}>
                {editing ? 'Modifier l’instance' : 'Nouvelle instance Ghost'}
              </Text>

              <TextInput
                label="Nom"
                value={form.name}
                onChangeText={(v) => updateField('name', v)}
                mode="outlined"
                placeholder="Ex : Blog perso"
                error={!!errors.name}
                style={styles.input}
                disabled={busy}
              />
              <HelperText type="error" visible={!!errors.name}>{errors.name}</HelperText>

              <TextInput
                label="URL de base"
                value={form.url}
                onChangeText={(v) => updateField('url', v)}
                mode="outlined"
                placeholder="https://blog.example.internal"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                error={!!errors.url}
                style={styles.input}
                disabled={busy}
              />
              <HelperText type="error" visible={!!errors.url}>{errors.url}</HelperText>

              <TextInput
                label={editing ? 'Nouvelle clé Admin API' : 'Clé Admin API'}
                value={form.apiKey}
                onChangeText={(v) => updateField('apiKey', v)}
                mode="outlined"
                placeholder={editing ? 'Laisser vide pour conserver la clé actuelle' : 'id:secret (hexadécimal)'}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                error={!!errors.apiKey}
                style={styles.input}
                disabled={busy}
              />
              <HelperText type={errors.apiKey ? 'error' : 'info'} visible>
                {errors.apiKey ?? 'Ghost Admin → Paramètres → Intégrations → clé « Admin API ».'}
              </HelperText>

              <View style={styles.modalActions}>
                <Button onPress={() => setEditing(undefined)} disabled={busy}>Annuler</Button>
                <Button mode="contained" onPress={() => void submit()} loading={busy} disabled={busy}>
                  {busy ? 'Test en cours…' : editing ? 'Enregistrer' : 'Ajouter'}
                </Button>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 32,
  },
  subheader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingTop: 16,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  flushCard: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    gap: 0,
    overflow: 'hidden',
  },
  settingLabel: {
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchLabel: {
    flex: 1,
    gap: 2,
  },
  loader: {
    paddingVertical: 16,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 12,
  },
  addButton: {
    alignSelf: 'flex-start',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  alignCenter: {
    alignSelf: 'center',
  },
  modal: {
    margin: 20,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'transparent',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
