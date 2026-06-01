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
  useTheme,
} from 'react-native-paper';

import { useInstances, InstanceFormData, InstanceFormErrors } from '../src/hooks/useInstances';
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

  const { colors } = useTheme();

  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<InstanceFormErrors>({});
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

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
    const data: InstanceFormData = {
      name: form.name,
      url: form.url,
      apiKey: form.apiKey,
    };

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
      {isLoading ? (
        <ActivityIndicator style={styles.loader} />
      ) : instances.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="bodyLarge" style={[styles.emptyText, { color: colors.onBackground }]}>
            Aucune instance Ghost configurée.
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>
            Appuyez sur + pour ajouter votre première instance.
          </Text>
        </View>
      ) : (
        <FlatList
          data={instances}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <InstanceListItem
              instance={item}
              isActive={item.id === activeInstanceId}
              onPress={handleSelectInstance}
              onDelete={() => removeInstanceWithConfirm(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
        />
      )}

      <FAB icon="plus" style={styles.fab} onPress={openModal} />

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
  loader: {
    marginTop: 48,
  },
  list: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  separator: {
    height: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontWeight: '600',
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
