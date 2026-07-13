/**
 * @file src/components/TagChipList.tsx
 * @description Affichage et saisie des tags sous forme de chips interactives.
 *              Les tags existants sont affichés avec un bouton de suppression.
 *              Un champ de saisie permet d'ajouter des tags séparés par une virgule.
 *
 * @exports TagChipList
 */

import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Chip, TextInput } from 'react-native-paper';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagChipListProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  disabled?: boolean;
  onFocus?: () => void;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

/**
 * Gestion interactive des tags d'un post.
 * Saisie libre séparée par des virgules — chaque tag est créé à la validation ou au blur.
 */
export function TagChipList({ tags, onTagsChange, disabled = false, onFocus }: TagChipListProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState('');

  function commitInput(): void {
    if (!inputValue.trim()) return;

    const newTags = inputValue
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && !tags.includes(t));

    if (newTags.length > 0) {
      onTagsChange([...tags, ...newTags]);
    }
    setInputValue('');
  }

  function removeTag(tag: string): void {
    onTagsChange(tags.filter((t) => t !== tag));
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {tags.map((tag) => (
          <Chip
            key={tag}
            onClose={disabled ? undefined : () => removeTag(tag)}
            style={styles.chip}
            compact
          >
            {tag}
          </Chip>
        ))}
      </ScrollView>
      <TextInput
        value={inputValue}
        onChangeText={setInputValue}
        onSubmitEditing={commitInput}
        onBlur={commitInput}
        onFocus={onFocus}
        placeholder="Ajouter des tags (séparés par une virgule)"
        dense
        disabled={disabled}
        returnKeyType="done"
        style={styles.input}
        mode="outlined"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  chip: {
    marginRight: 4,
  },
  input: {
    backgroundColor: 'transparent',
  },
});
