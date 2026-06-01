import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Snackbar,
  Divider,
  Chip,
  IconButton,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { useFocusEffect } from 'expo-router';

import { usePostStore } from '../../src/store/postStore';
import { usePostEditor } from '../../src/hooks/usePostEditor';
import { TagChipList } from '../../src/components/TagChipList';
import { MarkdownPreview } from '../../src/components/MarkdownPreview';
import { ImagePickerButton } from '../../src/components/ImagePickerButton';

export default function ComposeScreen(): React.JSX.Element {
  const {
    currentPost,
    setTitle,
    setMarkdownContent,
    setTags,
    resetCurrentPost,
  } = usePostStore();

  const { isDirty, isEditMode, originalStatus, isSaving, error, handleSave, confirmLeaveIfDirty } =
    usePostEditor();

  const { colors } = useTheme();

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const title = currentPost?.title ?? '';
  const content = currentPost?.markdownContent ?? '';
  const tags = currentPost?.tags ?? [];

  // Sur focus : réinitialise si on arrive sur un post édité sans l'avoir modifié
  // (évite que l'ancien post reste affiché quand on veut composer du nouveau)
  useFocusEffect(
    useCallback(() => {
      if (isEditMode && !isDirty) {
        resetCurrentPost();
        setIsPreviewMode(false);
        setTitleError(null);
      }
      return () => {
        if (!isDirty) {
          setIsPreviewMode(false);
        }
      };
    }, [isDirty, isEditMode, resetCurrentPost]),
  );

  function handleTitleChange(value: string): void {
    setTitle(value);
    if (titleError) setTitleError(null);
  }

  function handleImageInsert(markdown: string): void {
    setMarkdownContent(content + markdown);
  }

  async function onPressSaveDraft(): Promise<void> {
    const success = await handleSave('draft', (msg) => {
      if (msg.includes('titre')) setTitleError(msg);
      else setSnackbarMessage(msg);
    });
    if (success) setSnackbarMessage('Brouillon sauvegardé.');
  }

  async function onPressPublish(): Promise<void> {
    const success = await handleSave('published', (msg) => {
      if (msg.includes('titre')) setTitleError(msg);
      else setSnackbarMessage(msg);
    });
    if (success) setSnackbarMessage('Article publié.');
  }

  async function onPressDepublish(): Promise<void> {
    const success = await handleSave('draft', (msg) => {
      if (msg.includes('titre')) setTitleError(msg);
      else setSnackbarMessage(msg);
    });
    if (success) setSnackbarMessage('Article dépublié.');
  }

  function onPressReset(): void {
    confirmLeaveIfDirty(() => {
      resetCurrentPost();
      setIsPreviewMode(false);
      setTitleError(null);
    });
  }

  const isPublished = originalStatus === 'published';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={96}
    >
      {isEditMode && (
        <View style={styles.editBanner}>
          <Chip
            compact
            icon={isPublished ? 'eye' : 'pencil'}
            style={[styles.editChip, { backgroundColor: colors.primary + '22' }]}
          >
            {isPublished ? 'Édition — publié' : 'Édition — brouillon'}
          </Chip>
          {isDirty && (
            <Chip compact icon="circle-small" style={styles.dirtyChip} textStyle={styles.dirtyChipText}>
              Modifié
            </Chip>
          )}
        </View>
      )}

      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <IconButton
            icon={isPreviewMode ? 'pencil-outline' : 'eye-outline'}
            onPress={() => setIsPreviewMode((prev) => !prev)}
            accessibilityLabel={isPreviewMode ? 'Passer en mode édition' : 'Aperçu'}
          />
          <ImagePickerButton onInsert={handleImageInsert} disabled={isSaving} />
        </View>
        {isEditMode && (
          <IconButton
            icon="refresh"
            onPress={onPressReset}
            accessibilityLabel="Annuler les modifications"
          />
        )}
      </View>
      <Divider />

      {isPreviewMode ? (
        <MarkdownPreview markdown={content} />
      ) : (
        <ScrollView
          style={styles.editorScroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.editorContent}
        >
          <TextInput
            label="Titre"
            value={title}
            onChangeText={handleTitleChange}
            mode="outlined"
            error={!!titleError}
            style={styles.titleInput}
            disabled={isSaving}
            returnKeyType="next"
          />
          {titleError && (
            <Text style={[styles.fieldError, { color: colors.error }]}>{titleError}</Text>
          )}

          <TextInput
            label="Contenu (Markdown)"
            value={content}
            onChangeText={setMarkdownContent}
            mode="outlined"
            multiline
            style={styles.contentInput}
            disabled={isSaving}
          />

          <TagChipList
            tags={tags}
            onTagsChange={setTags}
            disabled={isSaving}
          />
        </ScrollView>
      )}

      <Divider />
      <View style={[styles.actions, { backgroundColor: colors.surface }]}>
        {isSaving ? (
          <ActivityIndicator style={styles.activityIndicator} />
        ) : isPublished ? (
          <>
            <Button mode="outlined" onPress={onPressDepublish} disabled={isSaving} style={styles.actionButton}>
              Dépublier
            </Button>
            <Button mode="contained" onPress={onPressPublish} disabled={isSaving} style={styles.actionButton}>
              Sauvegarder
            </Button>
          </>
        ) : (
          <>
            <Button mode="outlined" onPress={onPressSaveDraft} disabled={isSaving} style={styles.actionButton}>
              Brouillon
            </Button>
            <Button mode="contained" onPress={onPressPublish} disabled={isSaving} style={styles.actionButton}>
              Publier
            </Button>
          </>
        )}
      </View>

      <Snackbar
        visible={!!error && !snackbarMessage}
        onDismiss={() => {}}
        duration={4000}
        action={{ label: 'OK', onPress: () => {} }}
      >
        {error}
      </Snackbar>

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage(null)}
        duration={2500}
      >
        {snackbarMessage}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  editChip: {},
  dirtyChip: {
    backgroundColor: '#FFF8E1',
  },
  dirtyChipText: {
    color: '#F57F17',
    fontSize: 11,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editorScroll: {
    flex: 1,
  },
  editorContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  titleInput: {
    backgroundColor: 'transparent',
  },
  contentInput: {
    backgroundColor: 'transparent',
    minHeight: 200,
  },
  fieldError: {
    fontSize: 12,
    marginTop: -8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
  },
  actionButton: {
    flex: 1,
  },
  activityIndicator: {
    flex: 1,
    paddingVertical: 8,
  },
});
