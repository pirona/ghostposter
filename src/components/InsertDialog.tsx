// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useEffect, useState } from 'react';
import { Button, Dialog, HelperText, Portal, TextInput } from 'react-native-paper';

export type InsertKind = 'link' | 'embed' | 'bookmark' | 'codeBlock';

const COPY: Record<InsertKind, { title: string; label: string; help: string; placeholder: string }> = {
  link: {
    title: 'Insérer un lien',
    label: 'URL',
    help: 'Le texte sélectionné devient le libellé du lien.',
    placeholder: 'https://',
  },
  embed: {
    title: 'Vidéo / embed',
    label: 'URL de la page',
    help: 'YouTube, Vimeo, SoundCloud, Spotify, CodePen… — résolu par Ghost comme dans l’éditeur web.',
    placeholder: 'https://www.youtube.com/watch?v=…',
  },
  bookmark: {
    title: 'Carte lien',
    label: 'URL',
    help: 'Ghost récupère titre, description et vignette de la page.',
    placeholder: 'https://',
  },
  codeBlock: {
    title: 'Bloc de code',
    label: 'Langage (optionnel)',
    help: 'Ex. bash, yaml, python, haproxy… — utilisé pour la coloration du thème.',
    placeholder: 'bash',
  },
};

interface Props {
  kind: InsertKind | null;
  onDismiss: () => void;
  onSubmit: (kind: InsertKind, value: string) => void;
}

export function InsertDialog({ kind, onDismiss, onSubmit }: Props): React.JSX.Element {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue('');
    setError(null);
  }, [kind]);

  const copy = kind ? COPY[kind] : null;

  function submit(): void {
    if (!kind) return;
    const trimmed = value.trim();
    if (kind === 'codeBlock') {
      if (trimmed && !/^[\w+#-]+$/.test(trimmed)) {
        setError('Un seul mot, sans espace.');
        return;
      }
    } else if (!/^https?:\/\/\S+\.\S+$/.test(trimmed)) {
      setError('URL invalide (http:// ou https://).');
      return;
    }
    onSubmit(kind, trimmed);
  }

  return (
    <Portal>
      <Dialog visible={!!kind} onDismiss={onDismiss}>
        <Dialog.Title>{copy?.title}</Dialog.Title>
        <Dialog.Content>
          <TextInput
            mode="outlined"
            label={copy?.label}
            placeholder={copy?.placeholder}
            value={value}
            onChangeText={(v) => {
              setValue(v);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={kind === 'codeBlock' ? 'default' : 'url'}
            autoFocus
            onSubmitEditing={submit}
            error={!!error}
          />
          <HelperText type={error ? 'error' : 'info'} visible>
            {error ?? copy?.help}
          </HelperText>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Annuler</Button>
          <Button onPress={submit}>Insérer</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
