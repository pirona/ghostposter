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

// On-air / ready mic indicator — independent of theme so the state stays unambiguous.
const MIC_COLOR_ON_AIR = '#C62828';
const MIC_COLOR_READY = '#2E7D32';

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
  const [voiceTarget, setVoiceTarget] = useState<'title' | 'tags' | 'content'>('content');

  const title = currentPost?.title ?? '';
  const content = currentPost?.markdownContent ?? '';
  const tags = currentPost?.tags ?? [];
  const ghostId = currentPost?.ghostId;
  const featureImage = currentPost?.featureImage ?? null;

  // Cursor tracking for voice insertion — one pair of refs per free-text field.
  // Tags don't use cursor splicing: a finalized dictation is appended as a new chip instead.
  const contentSelectionRef = useRef({ start: 0, end: 0 });
  const titleSelectionRef = useRef({ start: 0, end: 0 });
  // Position in the target field where the current voice session started
  const contentAnchorRef = useRef<number | null>(null);
  const titleAnchorRef = useRef<number | null>(null);
  // Length of text inserted so far by the current voice interim result
  const contentPrevLengthRef = useRef(0);
  const titlePrevLengthRef = useRef(0);
  // Which field the current/last voice session targets — fixed at mic-press time so
  // a focus change mid-dictation doesn't redirect an in-flight session.
  const activeVoiceFieldRef = useRef<'title' | 'tags' | 'content'>('content');
  // Tags has no anchor to null out on commit, so track separately whether the
  // current tags dictation still needs to be turned into a chip.
  const tagsCommitPendingRef = useRef(false);
  // Always-current values for use in async voice callbacks
  const contentRef = useRef(content);
  useEffect(() => { contentRef.current = content; }, [content]);
  const titleRef = useRef(title);
  useEffect(() => { titleRef.current = title; }, [title]);

  // Insert/replace voice transcript at the anchor position as interim results arrive
  useEffect(() => {
    if (!transcript) return;
    if (activeVoiceFieldRef.current === 'content' && contentAnchorRef.current !== null) {
      const anchor = contentAnchorRef.current;
      const current = contentRef.current;
      const prefix = current.slice(0, anchor);
      const suffix = current.slice(anchor + contentPrevLengthRef.current);
      setMarkdownContent(prefix + transcript + suffix);
      contentPrevLengthRef.current = transcript.length;
    } else if (activeVoiceFieldRef.current === 'title' && titleAnchorRef.current !== null) {
      const anchor = titleAnchorRef.current;
      const current = titleRef.current;
      const prefix = current.slice(0, anchor);
      const suffix = current.slice(anchor + titlePrevLengthRef.current);
      handleTitleChange(prefix + transcript + suffix);
      titlePrevLengthRef.current = transcript.length;
    }
    // 'tags' has no live splice — the finalized transcript is committed as a chip below.
  }, [transcript, setMarkdownContent]);

  // When voice session ends, finalize.
  useEffect(() => {
    if (voiceState !== 'idle' && voiceState !== 'error') return;

    if (activeVoiceFieldRef.current === 'content' && contentAnchorRef.current !== null) {
      // Move the cursor to the end of the inserted text so a subsequent dictation continues
      // instead of overwriting it.
      const endPos = contentAnchorRef.current + contentPrevLengthRef.current;
      contentSelectionRef.current = { start: endPos, end: endPos };
      contentAnchorRef.current = null;
      contentPrevLengthRef.current = 0;
    } else if (activeVoiceFieldRef.current === 'title' && titleAnchorRef.current !== null) {
      const endPos = titleAnchorRef.current + titlePrevLengthRef.current;
      titleSelectionRef.current = { start: endPos, end: endPos };
      titleAnchorRef.current = null;
      titlePrevLengthRef.current = 0;
    } else if (activeVoiceFieldRef.current === 'tags' && tagsCommitPendingRef.current) {
      tagsCommitPendingRef.current = false;
      const newTags = transcript
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && !tags.includes(t));
      if (newTags.length > 0) setTags([...tags, ...newTags]);
    }

    if (voiceState === 'error' && voiceError) {
      setSnackbarMessage(voiceError);
      resetVoice();
    }
  }, [voiceState, voiceError, resetVoice, transcript, tags, setTags]);

  function handleMicPress(): void {
    if (voiceState === 'listening' || voiceState === 'processing') {
      stopVoice();
      return;
    }
    activeVoiceFieldRef.current = voiceTarget;

    if (voiceTarget === 'content') {
      const pos = contentSelectionRef.current.start;
      const current = contentRef.current;
      const needsSpace = pos > 0 && !/\s/.test(current[pos - 1] ?? '');
      if (needsSpace) {
        setMarkdownContent(current.slice(0, pos) + ' ' + current.slice(pos));
        contentAnchorRef.current = pos + 1;
      } else {
        contentAnchorRef.current = pos;
      }
      contentPrevLengthRef.current = 0;
    } else if (voiceTarget === 'title') {
      const pos = titleSelectionRef.current.start;
      const current = titleRef.current;
      const needsSpace = pos > 0 && !/\s/.test(current[pos - 1] ?? '');
      if (needsSpace) {
        handleTitleChange(current.slice(0, pos) + ' ' + current.slice(pos));
        titleAnchorRef.current = pos + 1;
      } else {
        titleAnchorRef.current = pos;
      }
      titlePrevLengthRef.current = 0;
    } else if (voiceTarget === 'tags') {
      tagsCommitPendingRef.current = true;
    }

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
            icon={voiceState === 'listening' || voiceState === 'processing' ? 'microphone-off' : 'microphone'}
            iconColor={
              voiceState === 'listening' || voiceState === 'processing'
                ? MIC_COLOR_ON_AIR
                : voiceState === 'error'
                  ? colors.error
                  : MIC_COLOR_READY
            }
            size={22}
            onPress={handleMicPress}
            disabled={isSaving || isPreviewMode}
            accessibilityLabel={
              voiceState === 'listening' || voiceState === 'processing'
                ? 'Arrêter la dictée'
                : `Dicter ${voiceTarget === 'title' ? 'le titre' : voiceTarget === 'tags' ? 'les tags' : 'le contenu'}`
            }
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
              onFocus={() => setVoiceTarget('title')}
              onSelectionChange={(e) => { titleSelectionRef.current = e.nativeEvent.selection; }}
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
              onFocus={() => setVoiceTarget('tags')}
            />
          </ScrollView>

          <TextInput
            label="Contenu (Markdown)"
            value={content}
            onChangeText={setMarkdownContent}
            onFocus={() => setVoiceTarget('content')}
            onSelectionChange={(e) => { contentSelectionRef.current = e.nativeEvent.selection; }}
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
