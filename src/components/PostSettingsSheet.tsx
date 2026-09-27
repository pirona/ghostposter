// SPDX-License-Identifier: GPL-3.0-or-later
// Excerpt + SEO / social fields, mirroring Ghost's post settings panel.

import React from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, HelperText, IconButton, Modal, Portal, Text, TextInput, useTheme } from 'react-native-paper';

import { PostMeta } from '../api/ghostTypes';
import { useEditorStore } from '../store/editorStore';
import { plainExcerpt } from '../utils/markdownFormat';

// Ghost admin's recommended lengths — longer values are accepted but truncated by search engines.
const FIELDS: Array<{ key: keyof PostMeta; label: string; recommended: number; multiline?: boolean }> = [
  { key: 'custom_excerpt', label: 'Extrait', recommended: 300, multiline: true },
  { key: 'meta_title', label: 'Meta titre', recommended: 60 },
  { key: 'meta_description', label: 'Meta description', recommended: 145, multiline: true },
  { key: 'og_title', label: 'Facebook / OpenGraph — titre', recommended: 60 },
  { key: 'og_description', label: 'Facebook / OpenGraph — description', recommended: 145, multiline: true },
  { key: 'twitter_title', label: 'X / Twitter — titre', recommended: 60 },
  { key: 'twitter_description', label: 'X / Twitter — description', recommended: 145, multiline: true },
];

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function PostSettingsSheet({ visible, onDismiss }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const meta = useEditorStore((s) => s.fields.meta);
  const title = useEditorStore((s) => s.fields.title);
  const markdown = useEditorStore((s) => s.fields.markdown);
  const updateMeta = useEditorStore((s) => s.updateMeta);

  /** Fills only empty fields, so hand-written values are never overwritten. */
  function autofill(): void {
    const description = meta.custom_excerpt?.trim() || plainExcerpt(markdown);
    const heading = title.trim();
    const defaults: PostMeta = {
      custom_excerpt: plainExcerpt(markdown, 300),
      meta_title: heading,
      meta_description: description,
      og_title: heading,
      og_description: description,
      twitter_title: heading,
      twitter_description: description,
    };
    const patch: Partial<PostMeta> = {};
    for (const { key } of FIELDS) {
      if (!meta[key]?.trim() && defaults[key]) patch[key] = defaults[key];
    }
    if (Object.keys(patch).length > 0) updateMeta(patch);
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
      >
        <KeyboardAvoidingView behavior="height" style={styles.flex}>
          <View style={styles.header}>
            <Text variant="titleLarge" style={styles.flex}>Extrait & SEO</Text>
            <IconButton icon="close" onPress={onDismiss} accessibilityLabel="Fermer" />
          </View>
          <Divider />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Button mode="outlined" icon="auto-fix" onPress={autofill} disabled={!title.trim() && !markdown.trim()}>
              Remplir les champs vides depuis le contenu
            </Button>
            {FIELDS.map(({ key, label, recommended, multiline }) => {
              const value = meta[key] ?? '';
              const over = value.length > recommended;
              return (
                <View key={key}>
                  <TextInput
                    mode="outlined"
                    label={label}
                    value={value}
                    onChangeText={(v) => updateMeta({ [key]: v })}
                    multiline={multiline}
                    style={styles.input}
                  />
                  <HelperText type={over ? 'error' : 'info'} visible style={styles.counter}>
                    {value.length} / {recommended} recommandés
                  </HelperText>
                </View>
              );
            })}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 16,
    borderRadius: 16,
    maxHeight: '90%',
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 4,
    paddingVertical: 4,
  },
  body: {
    padding: 16,
    gap: 4,
  },
  input: {
    backgroundColor: 'transparent',
  },
  counter: {
    textAlign: 'right',
  },
});
