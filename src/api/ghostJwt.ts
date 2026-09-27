// SPDX-License-Identifier: GPL-3.0-or-later
// HS256 JWT for the Ghost Admin API. Uses @noble/hashes (pure JS) because Hermes has no
// WebCrypto. Tokens live 5 minutes and are never cached; the raw key is never logged.

import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { InvalidApiKeyError, JwtSigningError } from './ghostTypes';

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new InvalidApiKeyError('Longueur du secret invalide (nombre impair de caractères)');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    if (isNaN(byte)) {
      throw new InvalidApiKeyError('Caractère non hexadécimal détecté dans le secret');
    }
    bytes[i / 2] = byte;
  }
  return bytes;
}

// No btoa on Hermes.
function base64url(input: Record<string, unknown> | Uint8Array): string {
  const bytes =
    input instanceof Uint8Array
      ? input
      : new TextEncoder().encode(JSON.stringify(input));

  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let b64 = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    b64 += CHARS[b0 >> 2];
    b64 += CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    b64 += i + 1 < bytes.length ? CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    b64 += i + 2 < bytes.length ? CHARS[b2 & 63] : '=';
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** @param apiKey Admin API key, `id:secret` in hex. */
export function generateGhostJwt(apiKey: string): string {
  const parts = apiKey.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new InvalidApiKeyError(
      'Format de clé Admin API invalide. Attendu : id:secret (valeurs hexadécimales)',
    );
  }

  const [id, secret] = parts;

  if (!/^[a-f0-9]+$/i.test(id) || !/^[a-f0-9]+$/i.test(secret)) {
    throw new InvalidApiKeyError(
      'La clé Admin API doit être composée uniquement de caractères hexadécimaux',
    );
  }

  let secretBytes: Uint8Array;
  try {
    secretBytes = hexToUint8Array(secret.toLowerCase());
  } catch (error) {
    if (error instanceof InvalidApiKeyError) throw error;
    throw new InvalidApiKeyError('Impossible de décoder le secret hexadécimal');
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url({ alg: 'HS256', kid: id });
    const payload = base64url({ aud: '/admin/', iat: now, exp: now + 300 });
    const signingInput = new TextEncoder().encode(`${header}.${payload}`);
    const signature = hmac(sha256, secretBytes, signingInput);

    return `${header}.${payload}.${base64url(signature)}`;
  } catch (error) {
    throw new JwtSigningError(
      `Échec de la signature JWT: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
