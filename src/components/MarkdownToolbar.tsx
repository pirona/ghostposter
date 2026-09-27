// SPDX-License-Identifier: GPL-3.0-or-later
// Formatting bar above the body field. Three groups — inline marks, blocks, inserts —
// separated by hairlines so the eye reads three short rows of intent rather than one long strip.

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, IconButton, useTheme } from 'react-native-paper';

export type ToolbarAction =
  | 'bold' | 'italic' | 'strike' | 'inlineCode'
  | 'heading' | 'quote' | 'bulletList' | 'numberedList'
  | 'link' | 'image' | 'codeBlock' | 'embed' | 'bookmark' | 'divider';

const GROUPS: Array<Array<{ action: ToolbarAction; icon: string; label: string }>> = [
  [
    { action: 'bold', icon: 'format-bold', label: 'Gras' },
    { action: 'italic', icon: 'format-italic', label: 'Italique' },
    { action: 'strike', icon: 'format-strikethrough', label: 'Barré' },
    { action: 'inlineCode', icon: 'code-tags', label: 'Code en ligne' },
    { action: 'link', icon: 'link-variant', label: 'Lien' },
  ],
  [
    { action: 'heading', icon: 'format-header-pound', label: 'Titre de section' },
    { action: 'quote', icon: 'format-quote-close', label: 'Citation' },
    { action: 'bulletList', icon: 'format-list-bulleted', label: 'Liste à puces' },
    { action: 'numberedList', icon: 'format-list-numbered', label: 'Liste numérotée' },
  ],
  [
    { action: 'image', icon: 'image-plus', label: 'Insérer une image' },
    { action: 'codeBlock', icon: 'code-braces-box', label: 'Bloc de code' },
    { action: 'embed', icon: 'youtube', label: 'Vidéo / embed (YouTube, Vimeo…)' },
    { action: 'bookmark', icon: 'bookmark-outline', label: 'Carte lien (bookmark)' },
    { action: 'divider', icon: 'minus', label: 'Séparateur' },
  ],
];

interface Props {
  onAction: (action: ToolbarAction) => void;
  disabled?: boolean;
  isUploadingImage?: boolean;
}

export function MarkdownToolbar({ onAction, disabled = false, isUploadingImage = false }: Props): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.bar}
    >
      {GROUPS.map((group, g) => (
        <View key={g} style={styles.group}>
          {g > 0 && <View style={[styles.separator, { backgroundColor: colors.outlineVariant }]} />}
          {group.map(({ action, icon, label }) =>
            action === 'image' && isUploadingImage ? (
              <ActivityIndicator key={action} size={18} style={styles.spinner} />
            ) : (
              <IconButton
                key={action}
                icon={icon}
                size={20}
                iconColor={colors.onSurfaceVariant}
                disabled={disabled}
                onPress={() => onAction(action)}
                accessibilityLabel={label}
                style={styles.button}
              />
            ),
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    marginHorizontal: 6,
  },
  button: {
    margin: 0,
  },
  spinner: {
    marginHorizontal: 12,
  },
});
