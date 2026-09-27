// SPDX-License-Identifier: GPL-3.0-or-later
// Tag chips plus a comma-separated input; optional suggestions come from the blog's existing tags.

import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Chip, TextInput } from 'react-native-paper';

const MAX_SUGGESTIONS = 6;

interface Props {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  suggestions?: string[];
  disabled?: boolean;
  onFocus?: () => void;
  placeholder?: string;
}

const sameTag = (a: string, b: string): boolean => a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;

/** Appends new tag names, case-insensitively deduplicated; reuses the blog's existing spelling. */
export function mergeTags(tags: string[], names: string[], known: string[] = []): string[] {
  const next = [...tags];
  for (const raw of names) {
    const name = raw.trim();
    // Reuse the existing spelling so "kubernetes" doesn't create a twin of "Kubernetes".
    const canonical = known.find((k) => sameTag(k, name)) ?? name;
    if (name && !next.some((t) => sameTag(t, canonical))) next.push(canonical);
  }
  return next;
}

export function TagChipList({
  tags,
  onTagsChange,
  suggestions = [],
  disabled = false,
  onFocus,
  placeholder = 'Ajouter des tags (séparés par une virgule)',
}: Props): React.JSX.Element {
  const [input, setInput] = useState('');

  function addTags(names: string[]): void {
    const next = mergeTags(tags, names, suggestions);
    if (next.length !== tags.length) onTagsChange(next);
  }

  function commitInput(): void {
    if (input.trim()) addTags(input.split(','));
    setInput('');
  }

  const matches = useMemo(() => {
    const query = input.split(',').pop()?.trim().toLowerCase() ?? '';
    if (!query) return [];
    return suggestions
      .filter((s) => s.toLowerCase().includes(query) && !tags.some((t) => sameTag(t, s)))
      .slice(0, MAX_SUGGESTIONS);
  }, [input, suggestions, tags]);

  return (
    <View style={styles.container}>
      {tags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {tags.map((tag) => (
            <Chip
              key={tag}
              compact
              onClose={disabled ? undefined : () => onTagsChange(tags.filter((t) => t !== tag))}
            >
              {tag}
            </Chip>
          ))}
        </ScrollView>
      )}
      <TextInput
        value={input}
        onChangeText={setInput}
        onSubmitEditing={commitInput}
        onBlur={commitInput}
        onFocus={onFocus}
        placeholder={placeholder}
        dense
        disabled={disabled}
        returnKeyType="done"
        blurOnSubmit={false}
        style={styles.input}
        mode="outlined"
      />
      {matches.length > 0 && (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {matches.map((name) => (
            <Chip
              key={name}
              compact
              mode="outlined"
              icon="plus"
              onPress={() => {
                const typed = input.split(',').slice(0, -1);
                addTags([...typed, name]);
                setInput('');
              }}
            >
              {name}
            </Chip>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  input: {
    backgroundColor: 'transparent',
  },
});
