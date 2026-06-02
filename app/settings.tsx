import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  FAB,
  Portal,
  Modal,
  Snackbar,
  HelperText,
  ActivityIndicator,
  Divider,
  List,
  SegmentedButtons,
  Switch,
  useTheme,
} from 'react-native-paper';
import Constants from 'expo-constants';

import { useInstances, InstanceFormData, InstanceFormErrors } from '../src/hooks/useInstances';
import { useSettingsStore, ThemePreference, DefaultPostStatus } from '../src/store/settingsStore';
import { InstanceListItem } from '../src/components/InstanceListItem';
import { GhostInstance } from '../src/store/instanceStore';

interface FormState {
  name: string;
  url: string;
  apiKey: string;
}

const EMPTY_FORM: FormState = { name: '', url: '', apiKey: '' };

export default function SettingsScreen(): React.JSX.Element {
  const {
    instances,
    activeInstanceId,
    isLoading,
    isTesting,
    addInstanceWithValidation,
    removeInstanceWithConfirm,
    setActiveInstance,
  } = useInstances();

  const {
    themePreference,
    defaultPostStatus,
    confirmDelete,
    setThemePreference,
    setDefaultPostStatus,
    setConfirmDelete,
  } = useSettingsStore();

  const { colors } = useTheme();

  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<InstanceFormErrors>({});
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const appVersion = Constants.expoConfig?.version ?? '—';

  function updateField(field: keyof FormState, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function openModal(): void {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalVisible(true);
  }

  function closeModal(): void {
    setModalVisible(false);
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  async function handleSubmit(): Promise<void> {
    const errors: InstanceFormErrors = {};
    const data: InstanceFormData = { name: form.name, url: form.url, apiKey: form.apiKey };

    const success = await addInstanceWithValidation(data, (field, message) => {
      errors[field] = message;
    });

    if (!success) {
      setFormErrors(errors);
      return;
    }

    closeModal();
    setSnackbarMessage('Instance ajoutée et connectée avec succès.');
  }

  async function handleSelectInstance(instance: GhostInstance): Promise<void> {
    if (instance.id === activeInstanceId) return;
    try {
      await setActiveInstance(instance.id);
      setSnackbarMessage(`Instance "${instance.name}" sélectionnée.`);
    } catch (err) {
      console.error('Erreur setActiveInstance:', err instanceof Error ? err.message : err);
    }
  }

  const isSubmitting = isTesting;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Apparence ── */}
        <List.Subheader style={[styles.subheader, { color: colors.primary }]}>
          Apparence
        </List.Subheader>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text variant="bodyMedium" style={[styles.settingLabel, { color: colors.onSurface }]}>
            Thème
          </Text>
          <SegmentedButtons
            value={themePreference}
            onValueChange={(v) => setThemePreference(v as ThemePreference)}
            buttons={[
              { value: 'light', label: 'Clair', icon: 'white-balance-sunny' },
              { value: 'system', label: 'Auto', icon: 'brightness-auto' },
              { value: 'dark', label: 'Sombre', icon: 'weather-night' },
            ]}
            style={styles.segmented}
          />
        </View>

        {/* ── Éditeur ── */}
        <List.Subheader style={[styles.subheader, { color: colors.primary }]}>
          Éditeur
        </List.Subheader>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text variant="bodyMedium" style={[styles.settingLabel, { color: colors.onSurface }]}>
            Statut par défaut des nouveaux posts
          </Text>
          <SegmentedButtons
            value={defaultPostStatus}
            onValueChange={(v) => setDefaultPostStatus(v as DefaultPostStatus)}
            buttons={[
              { value: 'draft', label: 'Brouillon', icon: 'pencil' },
              { value: 'published', label: 'Publié', icon: 'send' },
            ]}
            style={styles.segmented}
          />

          <Divider style={styles.inCardDivider} />

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text variant="bodyMedium" style={{ color: colors.onSurface }}>
                Confirmation avant suppression
              </Text>
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                Demander confirmation avant de supprimer un post
              </Text>
            </View>
            <Switch
              value={confirmDelete}
              onValueChange={setConfirmDelete}
              color={colors.primary}
            />
          </View>
        </View>

        {/* ── Instances Ghost ── */}
        <List.Subheader style={[styles.subheader, { color: colors.primary }]}>
          Instances Ghost
        </List.Subheader>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {isLoading ? (
            <ActivityIndicator style={styles.loader} />
          ) : instances.length === 0 ? (
            <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
              Aucune instance configurée. Appuyez sur + pour en ajouter une.
            </Text>
          ) : (
            <FlatList
              data={instances}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <InstanceListItem
                  instance={item}
                  isActive={item.id === activeInstanceId}
                  onPress={handleSelectInstance}
                  onDelete={() => removeInstanceWithConfirm(item)}
                />
              )}
              ItemSeparatorComponent={() => <Divider />}
            />
          )}
        </View>

        {/* ── À propos ── */}
        <List.Subheader style={[styles.subheader, { color: colors.primary }]}>
          À propos
        </List.Subheader>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <List.Item
            title="Version"
            right={() => (
              <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, alignSelf: 'center' }}>
                {appVersion}
              </Text>
            )}
            titleStyle={{ color: colors.onSurface }}
          />
          <Divider />
          <List.Item
            title="Ghost Admin API"
            description="v5 compatible"
            titleStyle={{ color: colors.onSurface }}
            descriptionStyle={{ color: colors.onSurfaceVariant }}
          />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      <FAB icon="plus" style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openModal} />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={closeModal}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView>
              <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.onSurface }]}>
                Nouvelle instance Ghost
              </Text>
              <Divider style={styles.divider} />

              <TextInput
                label="Nom"
                value={form.name}
                onChangeText={(v) => updateField('name', v)}
                mode="outlined"
                placeholder="Ex : Blog perso, Billisdead"
                error={!!formErrors.name}
                style={styles.input}
                disabled={isSubmitting}
              />
              <HelperText type="error" visible={!!formErrors.name}>
                {formErrors.name}
              </HelperText>

              <TextInput
                label="URL de base"
                value={form.url}
                onChangeText={(v) => updateField('url', v)}
                mode="outlined"
                placeholder="https://ghost.example.fr"
                keyboardType="url"
                autoCapitalize="none"
                error={!!formErrors.url}
                style={styles.input}
                disabled={isSubmitting}
              />
              <HelperText type="error" visible={!!formErrors.url}>
                {formErrors.url}
              </HelperText>

              <TextInput
                label="Clé Admin API"
                value={form.apiKey}
                onChangeText={(v) => updateField('apiKey', v)}
                mode="outlined"
                placeholder="id:secret (format hexadécimal)"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                error={!!formErrors.apiKey}
                style={styles.input}
                disabled={isSubmitting}
              />
              <HelperText type="error" visible={!!formErrors.apiKey}>
                {formErrors.apiKey}
              </HelperText>

              <HelperText type="info" visible>
                Générez votre clé dans Ghost Admin → Paramètres → Intégrations.
              </HelperText>

              <View style={styles.modalActions}>
                <Button onPress={closeModal} disabled={isSubmitting}>
                  Annuler
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Test en cours…' : 'Ajouter'}
                </Button>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage(null)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 100,
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
  settingLabel: {
    fontWeight: '500',
    marginBottom: 4,
  },
  segmented: {
    marginTop: 4,
  },
  inCardDivider: {
    marginVertical: 4,
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
    paddingVertical: 8,
  },
  bottomPad: {
    height: 16,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
  },
  modal: {
    margin: 20,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  divider: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 2,
    backgroundColor: 'transparent',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
});
