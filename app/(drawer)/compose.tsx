// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useState, useRef, useEffect } from 'react';
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
  Dialog,
  Portal,
  useTheme,
} from 'react-native-paper';
import { useRouter } from 'expo-router';

import { usePostStore } from '../../src/store/postStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { usePostEditor } from '../../src/hooks/usePostEditor';
import { useVoice } from '../../src/hooks/useVoice';
import { TagChipList } from '../../src/components/TagChipList';
import { MarkdownPreview } from '../../src/components/MarkdownPreview';
import { ImagePickerButton } from '../../src/components/ImagePickerButton';
import { FeatureImagePicker } from '../../src/components/FeatureImagePicker';

export default function ComposeScreen(): React.JSX.Element {
  const router = useRouter();
  const {
    currentPost,
    setTitle,
    setMarkdownContent,
    setTags,
    resetCurrentPost,
    deletePost,
    clearError,
  } = usePostStore();

  const { isDirty, isEditMode, originalStatus, isSaving, error, handleSave, confirmLeaveIfDirty } =
    usePostEditor();

  const { colors } = useTheme();

  const { state: voiceState, transcript, error: voiceError, start: startVoice, stop: stopVoice, reset: resetVoice } = useVoice();
  const voiceVocabulary = useSettingsStore((s) => s.voiceVocabulary);

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const title = currentPost?.title ?? '';
  const content = currentPost?.markdownContent ?? '';
  const tags = currentPost?.tags ?? [];
  const ghostId = currentPost?.ghostId;
  const featureImage = currentPost?.featureImage ?? null;

  // Cursor tracking for voice insertion
  const selectionRef = useRef({ start: 0, end: 0 });
  // Position in content where the current voice session started
  const voiceAnchorRef = useRef<number | null>(null);
  // Length of text inserted so far by the current voice interim result
  const voicePrevLengthRef = useRef(0);
  // Always-current content for use in async voice callbacks
  const contentRef = useRef(content);
  useEffect(() => { contentRef.current = content; }, [content]);

  // Insert/replace voice transcript at the anchor position as interim results arrive
  useEffect(() => {
    if (!transcript || voiceAnchorRef.current === null) return;
    const anchor = voiceAnchorRef.current;
    const current = contentRef.current;
    const prefix = current.slice(0, anchor);
    const suffix = current.slice(anchor + voicePrevLengthRef.current);
    setMarkdownContent(prefix + transcript + suffix);
    voicePrevLengthRef.current = transcript.length;
  }, [transcript, setMarkdownContent]);

  // When voice session ends, finalize: move the cursor to the end of the inserted
  // text so a subsequent dictation continues instead of overwriting it.
  useEffect(() => {
    if ((voiceState === 'idle' || voiceState === 'error') && voiceAnchorRef.current !== null) {
      const endPos = voiceAnchorRef.current + voicePrevLengthRef.current;
      selectionRef.current = { start: endPos, end: endPos };
      voiceAnchorRef.current = null;
      voicePrevLengthRef.current = 0;
    }
    if (voiceState === 'error' && voiceError) {
      setSnackbarMessage(voiceError);
      resetVoice();
    }
  }, [voiceState, voiceError, resetVoice]);

  function handleMicPress(): void {
    if (voiceState === 'listening' || voiceState === 'processing') {
      stopVoice();
      return;
    }
    const pos = selectionRef.current.start;
    const current = contentRef.current;
    // Insert a space separator if the cursor is not already after whitespace
    const needsSpace = pos > 0 && !/\s/.test(current[pos - 1] ?? '');
    if (needsSpace) {
      setMarkdownContent(current.slice(0, pos) + ' ' + current.slice(pos));
      voiceAnchorRef.current = pos + 1;
    } else {
      voiceAnchorRef.current = pos;
    }
    voicePrevLengthRef.current = 0;
    resetVoice();
    startVoice(voiceVocabulary);
  }

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

  async function handleConfirmDelete(): Promise<void> {
    setShowDeleteDialog(false);
    if (!ghostId) return;
    try {
      await deletePost(ghostId);
      resetCurrentPost();
      router.replace('/(drawer)/posts');
    } catch {
      setSnackbarMessage('Impossible de supprimer le post.');
    }
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
            <Chip
              compact
              icon="circle-small"
              style={[styles.dirtyChip, { backgroundColor: colors.primaryContainer }]}
              textStyle={[styles.dirtyChipText, { color: colors.onPrimaryContainer }]}
            >
              Modifié
            </Chip>
          )}
        </View>
      )}

      <View style={[styles.toolbar, { backgroundColor: colors.surfaceVariant }]}>
        <View style={styles.toolbarLeft}>
          <IconButton
            icon={isPreviewMode ? 'pencil-outline' : 'eye-outline'}
            iconColor={colors.onSurfaceVariant}
            size={22}
            onPress={() => setIsPreviewMode((prev) => !prev)}
            accessibilityLabel={isPreviewMode ? 'Passer en mode édition' : 'Aperçu'}
          />
          <ImagePickerButton onInsert={handleImageInsert} disabled={isSaving} />
          <IconButton
            icon={voiceState === 'listening' ? 'microphone-off' : 'microphone'}
            iconColor={voiceState === 'listening' ? colors.primary : voiceState === 'error' ? colors.error : colors.onSurfaceVariant}
            size={22}
            onPress={handleMicPress}
            disabled={isSaving || isPreviewMode}
            accessibilityLabel={voiceState === 'listening' ? 'Arrêter la dictée' : 'Dicter du contenu'}
          />
        </View>
        <View style={styles.toolbarRight}>
          {isEditMode && ghostId && (
            <IconButton
              icon="delete-outline"
              iconColor={colors.error}
              size={22}
              onPress={() => setShowDeleteDialog(true)}
              disabled={isSaving}
              accessibilityLabel="Supprimer le post"
            />
          )}
          {isEditMode && (
            <IconButton
              icon="refresh"
              iconColor={colors.onSurfaceVariant}
              size={22}
              onPress={onPressReset}
              accessibilityLabel="Annuler les modifications"
            />
          )}
        </View>
      </View>
      <Divider />

      {isPreviewMode ? (
        <MarkdownPreview markdown={content} title={title} featureImage={featureImage} />
      ) : (
        <View style={styles.editorBody}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.editorMeta}
          >
            <FeatureImagePicker disabled={isSaving} />

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

            <TagChipList
              tags={tags}
              onTagsChange={setTags}
              disabled={isSaving}
            />
          </ScrollView>

          <TextInput
            label="Contenu (Markdown)"
            value={content}
            onChangeText={setMarkdownContent}
            onSelectionChange={(e) => { selectionRef.current = e.nativeEvent.selection; }}
            mode="outlined"
            multiline
            scrollEnabled
            style={styles.contentInput}
            disabled={isSaving}
            textAlignVertical="top"
          />
        </View>
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

      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Supprimer le post</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Supprimer « {title || '(Sans titre)'} » définitivement ?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Annuler</Button>
            <Button textColor={colors.error} onPress={handleConfirmDelete}>
              Supprimer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!error || !!snackbarMessage}
        onDismiss={() => { if (error) clearError(); else setSnackbarMessage(null); }}
        duration={error ? 4000 : 3500}
        action={{ label: 'OK', onPress: () => { if (error) clearError(); else setSnackbarMessage(null); } }}
      >
        {error ?? snackbarMessage}
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
  dirtyChip: {},
  dirtyChipText: {
    fontSize: 11,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editorBody: {
    flex: 1,
  },
  editorMeta: {
    padding: 16,
    gap: 12,
    paddingBottom: 8,
  },
  titleInput: {
    backgroundColor: 'transparent',
  },
  contentInput: {
    backgroundColor: 'transparent',
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 120,
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
