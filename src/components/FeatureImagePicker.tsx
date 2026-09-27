// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react';
import { View, Image, StyleSheet, Pressable } from 'react-native';
import { Text, IconButton, ActivityIndicator, useTheme } from 'react-native-paper';

import { useEditorStore } from '../store/editorStore';
import { useImageUpload } from '../hooks/useImageUpload';

const MAX_WIDTH = 2000;

interface Props {
  disabled?: boolean;
}

export function FeatureImagePicker({ disabled = false }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const featureImage = useEditorStore((s) => s.fields.featureImage);
  const update = useEditorStore((s) => s.update);
  const { isUploading, pickAndUpload } = useImageUpload(MAX_WIDTH);

  async function pick(): Promise<void> {
    const url = await pickAndUpload();
    if (url) update({ featureImage: url });
  }

  const isDisabled = disabled || isUploading;

  if (featureImage) {
    return (
      <View style={styles.imageWrapper}>
        <Pressable onPress={pick} disabled={isDisabled}>
          <Image source={{ uri: featureImage }} style={styles.thumbnail} resizeMode="cover" />
          {isUploading && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </Pressable>
        <IconButton
          icon="close-circle"
          size={20}
          iconColor="#fff"
          containerColor="rgba(0,0,0,0.55)"
          style={styles.removeButton}
          onPress={() => update({ featureImage: null })}
          disabled={isDisabled}
          accessibilityLabel="Supprimer l'image à la une"
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={pick}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.emptyPicker,
        {
          borderColor: colors.outlineVariant,
          backgroundColor: pressed ? colors.surfaceVariant : 'transparent',
        },
      ]}
    >
      {isUploading ? (
        <ActivityIndicator size="small" />
      ) : (
        <View style={styles.emptyContent}>
          <IconButton
            icon="image-outline"
            size={24}
            iconColor={colors.onSurfaceVariant}
            style={styles.emptyIcon}
          />
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            Image à la une
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageWrapper: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 160,
    borderRadius: 8,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    margin: 0,
  },
  emptyPicker: {
    height: 72,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyIcon: {
    margin: 0,
  },
});
