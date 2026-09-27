// SPDX-License-Identifier: GPL-3.0-or-later
import { Alert } from 'react-native';

import { useEditorStore, selectIsDirty } from '../store/editorStore';

/** Runs `onConfirm` right away when the editor is clean, otherwise after the user agrees to discard. */
export function confirmDiscardChanges(onConfirm: () => void): void {
  const editor = useEditorStore.getState();
  if (!selectIsDirty(editor)) {
    onConfirm();
    return;
  }
  Alert.alert(
    'Modifications non sauvegardées',
    'Le post en cours contient des modifications non sauvegardées. Les abandonner ?',
    [
      { text: 'Rester', style: 'cancel' },
      {
        text: 'Abandonner',
        style: 'destructive',
        onPress: () => {
          void editor.discardAutosave();
          editor.newPost();
          onConfirm();
        },
      },
    ],
  );
}
