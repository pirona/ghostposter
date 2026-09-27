// SPDX-License-Identifier: GPL-3.0-or-later
import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { uploadImage } from '../api/ghostClient';

const JPEG_QUALITY = 0.85;

/** Picks one gallery image, downsizes it to `maxWidth` and uploads it; resolves to its URL or null. */
export function useImageUpload(maxWidth: number) {
  const [isUploading, setIsUploading] = useState(false);

  async function pickAndUpload(): Promise<string | null> {
    setIsUploading(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission refusée', "L'accès à la galerie est nécessaire pour ajouter des images.");
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 1,
        allowsEditing: false,
        allowsMultipleSelection: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return null;

      const actions: ImageManipulator.Action[] =
        asset.width && asset.width > maxWidth ? [{ resize: { width: maxWidth } }] : [];
      const manipulated = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      return await uploadImage(manipulated.uri);
    } catch (err) {
      Alert.alert("Échec de l'upload", err instanceof Error ? err.message : "Impossible d'uploader l'image.");
      return null;
    } finally {
      setIsUploading(false);
    }
  }

  return { isUploading, pickAndUpload };
}
