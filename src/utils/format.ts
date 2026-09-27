// SPDX-License-Identifier: GPL-3.0-or-later
import { getLocales } from 'expo-localization';

const locale = getLocales()[0]?.languageTag ?? 'fr-FR';

export function formatDate(iso: string, withTime = false): string {
  return new Date(iso).toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
