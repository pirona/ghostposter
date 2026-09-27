// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Banner,
  Button,
  Chip,
  Dialog,
  Divider,
  IconButton,
  Portal,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useNavigation, useRouter } from 'expo-router';

import { ConflictError, PostStatus } from '../../src/api/ghostTypes';
import { useEditorStore, selectIsDirty } from '../../src/store/editorStore';
import { useInstanceStore } from '../../src/store/instanceStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useFieldDictation, DictationField } from '../../src/hooks/useFieldDictation';
import { useImageUpload } from '../../src/hooks/useImageUpload';
import { TagChipList, mergeTags } from '../../src/components/TagChipList';
import { MarkdownPreview } from '../../src/components/MarkdownPreview';
import { FeatureImagePicker } from '../../src/components/FeatureImagePicker';
import { MarkdownToolbar, ToolbarAction } from '../../src/components/MarkdownToolbar';
import { InsertDialog, InsertKind } from '../../src/components/InsertDialog';
import { PostSettingsSheet } from '../../src/components/PostSettingsSheet';
import { embedShortcode } from '../../src/utils/contentConverter';
import { Format, Selection, TextEdit, insertBlock, insertLink, textStats } from '../../src/utils/markdownFormat';
import { formatDate } from '../../src/utils/format';

// On-air / ready mic indicator — independent of theme so the state stays unambiguous.
const MIC_COLOR_ON_AIR = '#C62828';
const MIC_COLOR_READY = '#2E7D32';
const CONTENT_IMAGE_MAX_WIDTH = 1920;

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Brouillon',
  published: 'Publié',
  scheduled: 'Programmé',
};

export default function ComposeScreen(): React.JSX.Element {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const editor = useEditorStore();
  const isDirty = useEditorStore(selectIsDirty);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const vocabulary = useSettingsStore((s) => s.voiceVocabulary);
  const { fields, status, ghostId, url, isSaving, isLoading } = editor;

  const [isPreview, setIsPreview] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [insertKind, setInsertKind] = useState<InsertKind | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<DictationField>('content');

  const contentInputRef = useRef<NativeTextInput>(null);
  const titleSelection = useRef<Selection>({ start: 0, end: 0 });
  const contentSelection = useRef<Selection>({ start: 0, end: 0 });
  const image = useImageUpload(CONTENT_IMAGE_MAX_WIDTH);

  useEffect(() => {
    if (!activeInstanceId) return;
    void useEditorStore.getState().loadTags();
    void useEditorStore.getState().checkAutosave();
  }, [activeInstanceId]);

  useEffect(() => {
    navigation.setOptions({ title: ghostId ? 'Édition' : 'Nouveau post' });
  }, [navigation, ghostId]);

  const dictation = useFieldDictation({
    getText: (field) => {
      const f = useEditorStore.getState().fields;
      return field === 'title' ? f.title : f.markdown;
    },
    setText: (field, value) => {
      useEditorStore.getState().update(field === 'title' ? { title: value } : { markdown: value });
      if (field === 'title') setTitleError(null);
    },
    selections: { title: titleSelection, content: contentSelection },
    addTags: (names) => {
      const s = useEditorStore.getState();
      s.update({ tags: mergeTags(s.fields.tags, names, s.availableTags) });
    },
    vocabulary,
    onError: setSnackbar,
  });

  // -------------------------------------------------------------------------
  // Body editing helpers
  // -------------------------------------------------------------------------

  function applyEdit(edit: TextEdit): void {
    editor.update({ markdown: edit.text });
    contentSelection.current = edit.selection;
    // The native input needs the new value before it can take the selection.
    requestAnimationFrame(() => {
      contentInputRef.current?.focus();
      contentInputRef.current?.setSelection(edit.selection.start, edit.selection.end);
    });
  }

  function currentSelection(): Selection {
    const max = fields.markdown.length;
    const { start, end } = contentSelection.current;
    return { start: Math.min(start, max), end: Math.min(end, max) };
  }

  async function handleToolbar(action: ToolbarAction): Promise<void> {
    const text = fields.markdown;
    const sel = currentSelection();
    switch (action) {
      case 'link':
      case 'embed':
      case 'bookmark':
      case 'codeBlock':
        setInsertKind(action);
        return;
      case 'image': {
        const imageUrl = await image.pickAndUpload();
        // Re-read: the body may have changed while the gallery was open.
        if (imageUrl) applyEdit(insertBlock(useEditorStore.getState().fields.markdown, currentSelection(), `![](${imageUrl})`));
        return;
      }
      default:
        applyEdit(Format[action](text, sel));
    }
  }

  function handleInsert(kind: InsertKind, value: string): void {
    setInsertKind(null);
    const text = fields.markdown;
    const sel = currentSelection();
    if (kind === 'link') applyEdit(insertLink(text, sel, value));
    else if (kind === 'codeBlock') applyEdit(Format.codeBlock(text, sel, value));
    else applyEdit(insertBlock(text, sel, embedShortcode({ kind, url: value })));
  }

  // -------------------------------------------------------------------------
  // Save / publish
  // -------------------------------------------------------------------------

  async function runSave(target: PostStatus, success: string): Promise<void> {
    if (!fields.title.trim()) {
      setTitleError('Le titre est obligatoire.');
      setIsPreview(false);
      return;
    }
    try {
      await editor.save(target);
      setSnackbar(success);
    } catch (err) {
      if (err instanceof ConflictError) {
        Alert.alert(
          'Conflit de version',
          'Ce post a été modifié ailleurs depuis son ouverture.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Recharger (perdre mes modifs)', style: 'destructive', onPress: () => void reloadPost() },
            { text: 'Écraser', onPress: () => void overwrite(target, success) },
          ],
        );
      } else {
        setSnackbar(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
      }
    }
  }

  async function overwrite(target: PostStatus, success: string): Promise<void> {
    try {
      await editor.overwrite(target);
      setSnackbar(success);
    } catch (err) {
      setSnackbar(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    }
  }

  async function reloadPost(): Promise<void> {
    try {
      await editor.reload();
    } catch (err) {
      setSnackbar(err instanceof Error ? err.message : 'Rechargement impossible.');
    }
  }

  /** Public posts should not go out without a cover and search/social metadata. */
  function publish(target: 'published' | 'scheduled', success: string): void {
    const { meta } = fields;
    const missingMeta = [
      !meta.meta_title?.trim() && 'meta titre',
      !meta.meta_description?.trim() && 'meta description',
      !meta.og_title?.trim() && !meta.twitter_title?.trim() && 'titres réseaux sociaux',
    ].filter(Boolean);
    const missing = [!fields.featureImage && 'image à la une', ...missingMeta].filter(Boolean);

    if (missing.length === 0) {
      void runSave(target, success);
      return;
    }
    Alert.alert('Champs manquants', `Il manque : ${missing.join(', ')}.`, [
      // The cover picker sits at the top of the form; metadata lives in the settings sheet.
      { text: 'Compléter', onPress: () => { setIsPreview(false); setSettingsOpen(missingMeta.length > 0); } },
      { text: 'Publier quand même', style: 'destructive', onPress: () => void runSave(target, success) },
    ]);
  }

  function unpublish(target: 'draft', label: string): void {
    Alert.alert(label, 'Le post repassera en brouillon et ne sera plus visible sur le blog.', [
      { text: 'Annuler', style: 'cancel' },
      { text: label, onPress: () => void runSave(target, 'Post repassé en brouillon.') },
    ]);
  }

  async function confirmDelete(): Promise<void> {
    setShowDelete(false);
    try {
      await editor.deleteCurrent();
      router.replace('/(drawer)/posts');
    } catch (err) {
      setSnackbar(err instanceof Error ? err.message : 'Impossible de supprimer le post.');
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const stats = textStats(fields.markdown);
  const micColor = dictation.onAir ? MIC_COLOR_ON_AIR : dictation.state === 'error' ? colors.error : MIC_COLOR_READY;
  const voiceTargetLabel = voiceTarget === 'title' ? 'le titre' : voiceTarget === 'tags' ? 'les tags' : 'le contenu';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={96}
    >
      <Banner
        visible={!!editor.restorable}
        icon="history"
        actions={[
          { label: 'Ignorer', onPress: () => void editor.discardAutosave() },
          { label: 'Restaurer', onPress: editor.restoreAutosave },
        ]}
      >
        {editor.restorable
          ? `Modifications non sauvegardées retrouvées (« ${editor.restorable.fields.title || 'Sans titre'} », `
            + `${formatDate(editor.restorable.savedAt, true)}).`
          : ''}
      </Banner>

      <View style={styles.statusRow}>
        <Chip compact icon={status === 'published' ? 'eye' : status === 'scheduled' ? 'clock-outline' : 'pencil'}>
          {status ? STATUS_LABEL[status] : 'Nouveau'}
        </Chip>
        {isDirty && (
          <Chip compact style={{ backgroundColor: colors.primaryContainer }} textStyle={styles.smallText}>
            Modifié
          </Chip>
        )}
        <Text variant="labelSmall" style={[styles.stats, { color: colors.onSurfaceVariant }]}>
          {stats.words} mots · {stats.minutes} min
        </Text>
      </View>

      <View style={[styles.toolbar, { backgroundColor: colors.surfaceVariant }]}>
        <View style={styles.row}>
          <IconButton icon="undo" size={22} onPress={editor.undo} disabled={editor.past.length === 0 || isSaving}
            accessibilityLabel="Annuler" />
          <IconButton icon="redo" size={22} onPress={editor.redo} disabled={editor.future.length === 0 || isSaving}
            accessibilityLabel="Rétablir" />
          <IconButton
            icon={isPreview ? 'pencil-outline' : 'eye-outline'}
            size={22}
            onPress={() => setIsPreview((p) => !p)}
            accessibilityLabel={isPreview ? 'Retour à l’édition' : 'Aperçu'}
          />
          <IconButton
            icon="microphone"
            iconColor={micColor}
            size={22}
            onPressIn={() => dictation.pressIn(voiceTarget)}
            onPressOut={dictation.pressOut}
            disabled={isSaving || isPreview}
            accessibilityLabel={dictation.onAir ? 'Relâcher pour arrêter la dictée' : `Maintenir pour dicter ${voiceTargetLabel}`}
          />
        </View>
        <View style={styles.row}>
          <IconButton icon="tune-variant" size={22} onPress={() => setSettingsOpen(true)}
            accessibilityLabel="Extrait & SEO" />
          {status === 'published' && url && (
            <IconButton icon="open-in-new" size={22} onPress={() => void Linking.openURL(url)}
              accessibilityLabel="Voir en ligne" />
          )}
          {ghostId && isDirty && (
            <IconButton icon="restore" size={22} onPress={editor.revert} disabled={isSaving}
              accessibilityLabel="Revenir à la version enregistrée" />
          )}
          {ghostId && (
            <IconButton icon="delete-outline" iconColor={colors.error} size={22} onPress={() => setShowDelete(true)}
              disabled={isSaving} accessibilityLabel="Supprimer le post" />
          )}
        </View>
      </View>
      <Divider />

      {isPreview ? (
        <MarkdownPreview markdown={fields.markdown} title={fields.title} featureImage={fields.featureImage} />
      ) : (
        <View style={styles.editorBody}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.meta} style={styles.metaScroll}>
            <FeatureImagePicker disabled={isSaving} />
            <TextInput
              label="Titre"
              value={fields.title}
              onChangeText={(title) => {
                editor.update({ title });
                setTitleError(null);
              }}
              onFocus={() => setVoiceTarget('title')}
              onSelectionChange={(e) => { titleSelection.current = e.nativeEvent.selection; }}
              mode="outlined"
              error={!!titleError}
              style={styles.transparent}
              disabled={isSaving}
            />
            {titleError && <Text style={[styles.fieldError, { color: colors.error }]}>{titleError}</Text>}
            <TagChipList
              tags={fields.tags}
              onTagsChange={(tags) => editor.update({ tags })}
              suggestions={editor.availableTags}
              disabled={isSaving}
              onFocus={() => setVoiceTarget('tags')}
            />
          </ScrollView>

          <MarkdownToolbar onAction={(a) => void handleToolbar(a)} disabled={isSaving} isUploadingImage={image.isUploading} />

          <TextInput
            ref={contentInputRef}
            label="Contenu (Markdown)"
            value={fields.markdown}
            onChangeText={(markdown) => editor.update({ markdown })}
            onFocus={() => setVoiceTarget('content')}
            onSelectionChange={(e) => { contentSelection.current = e.nativeEvent.selection; }}
            mode="outlined"
            multiline
            scrollEnabled
            style={[styles.transparent, styles.content]}
            disabled={isSaving}
            textAlignVertical="top"
          />
        </View>
      )}

      <Divider />
      <View style={[styles.actions, { backgroundColor: colors.surface }]}>
        {isSaving ? (
          <ActivityIndicator style={styles.flex} />
        ) : status === 'published' || status === 'scheduled' ? (
          <>
            <Button mode="outlined" style={styles.flex}
              onPress={() => unpublish('draft', status === 'published' ? 'Dépublier' : 'Déprogrammer')}>
              {status === 'published' ? 'Dépublier' : 'Déprogrammer'}
            </Button>
            <Button mode="contained" style={styles.flex} onPress={() => publish(status, 'Post mis à jour.')}>
              Mettre à jour
            </Button>
          </>
        ) : (
          <>
            <Button mode="outlined" style={styles.flex} onPress={() => void runSave('draft', 'Brouillon sauvegardé.')}>
              Brouillon
            </Button>
            <Button mode="contained" style={styles.flex} onPress={() => publish('published', 'Post publié.')}>
              Publier
            </Button>
          </>
        )}
      </View>

      <InsertDialog kind={insertKind} onDismiss={() => setInsertKind(null)} onSubmit={handleInsert} />
      <PostSettingsSheet visible={settingsOpen} onDismiss={() => setSettingsOpen(false)} />

      <Portal>
        <Dialog visible={showDelete} onDismiss={() => setShowDelete(false)}>
          <Dialog.Title>Supprimer le post</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Supprimer « {fields.title || '(Sans titre)'} » définitivement du blog ?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDelete(false)}>Annuler</Button>
            <Button textColor={colors.error} onPress={() => void confirmDelete()}>Supprimer</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar(null)}
        duration={4000}
        action={{ label: 'OK', onPress: () => setSnackbar(null) }}
      >
        {snackbar}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  smallText: {
    fontSize: 11,
  },
  stats: {
    marginLeft: 'auto',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editorBody: {
    flex: 1,
  },
  // The header block may scroll, but never takes more than ~half the screen from the body.
  metaScroll: {
    flexGrow: 0,
    maxHeight: '45%',
  },
  meta: {
    padding: 16,
    gap: 12,
    paddingBottom: 4,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  content: {
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
    gap: 12,
    padding: 16,
  },
});
