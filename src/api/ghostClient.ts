// SPDX-License-Identifier: GPL-3.0-or-later
// Ghost Admin API client. The JWT is minted per request from the active instance;
// the key itself never leaves SecureStore-backed state and is never logged.

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { generateGhostJwt } from './ghostJwt';
import { useInstanceStore } from '../store/instanceStore';
import {
  GhostPost,
  GhostSite,
  GhostTag,
  GhostPostsResponse,
  GhostOembedResponse,
  CreatePostPayload,
  UpdatePostPayload,
  PostFilter,
  GhostImageUploadResponse,
  AuthenticationError,
  ConflictError,
  ValidationError,
  RateLimitError,
  GhostApiError,
  NotConfiguredError,
} from './ghostTypes';

const PAGE_SIZE = 15;
const ALL_STATUSES = 'status:[draft,published,scheduled]';

const client = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const instance = useInstanceStore.getState().getActiveInstance();
  if (!instance) throw new NotConfiguredError();

  config.baseURL = instance.url;
  config.headers.set('Authorization', `Ghost ${generateGhostJwt(instance.apiKey)}`);
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // Errors raised before dispatch (no instance, bad key) keep their own type.
    if (!axios.isAxiosError(error)) throw error;
    throw toGhostError(error);
  },
);

function toGhostError(error: AxiosError): GhostApiError {
  const status = error.response?.status ?? 0;
  const data = error.response?.data as { errors?: Array<{ message: string; context?: string }> } | undefined;
  const apiError = data?.errors?.[0];
  const message = apiError
    ? [apiError.message, apiError.context].filter(Boolean).join(' — ')
    : status === 0
      ? `Instance injoignable (${error.message})`
      : error.message;

  switch (status) {
    case 401:
    case 403:
      return new AuthenticationError(status, message);
    case 409:
      return new ConflictError(status, message);
    case 422:
      return new ValidationError(status, message);
    case 429:
      return new RateLimitError(status, message);
    default:
      return new GhostApiError(status, message);
  }
}

/** NQL string literal — single quotes delimit, so they must be escaped. */
function nqlString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export async function getPosts(
  page: number,
  filter: PostFilter = 'all',
  search = '',
): Promise<GhostPostsResponse> {
  const clauses = [filter === 'all' ? ALL_STATUSES : `status:${filter}`];
  if (search.trim()) clauses.push(`title:~${nqlString(search.trim())}`);

  // No `formats=html` here: the list only shows metadata, the body is fetched on open.
  const response = await client.get<GhostPostsResponse>('/ghost/api/admin/posts/', {
    params: {
      page,
      limit: PAGE_SIZE,
      filter: clauses.join('+'),
      include: 'tags',
      order: 'updated_at desc',
    },
  });
  return response.data;
}

export async function getPost(id: string): Promise<GhostPost> {
  const response = await client.get<{ posts: GhostPost[] }>(`/ghost/api/admin/posts/${id}/`, {
    params: { include: 'tags', formats: 'html' },
  });
  return response.data.posts[0];
}

// `?source=html` is mandatory: without it Ghost silently drops the `html` field (fixed in v1.3.2).
export async function createPost(payload: CreatePostPayload): Promise<GhostPost> {
  const response = await client.post<{ posts: GhostPost[] }>(
    '/ghost/api/admin/posts/',
    payload,
    { params: { source: 'html', formats: 'html' } },
  );
  return response.data.posts[0];
}

export async function updatePost(id: string, payload: UpdatePostPayload): Promise<GhostPost> {
  const response = await client.put<{ posts: GhostPost[] }>(
    `/ghost/api/admin/posts/${id}/`,
    payload,
    { params: { source: 'html', formats: 'html' } },
  );
  return response.data.posts[0];
}

export async function deletePost(id: string): Promise<void> {
  await client.delete(`/ghost/api/admin/posts/${id}/`);
}

export async function getTags(): Promise<GhostTag[]> {
  const response = await client.get<{ tags: GhostTag[] }>('/ghost/api/admin/tags/', {
    params: { limit: 'all' },
  });
  return response.data.tags;
}

/** Same endpoint the Ghost editor uses to turn a pasted URL into an embed or bookmark card. */
export async function fetchOembed(
  url: string,
  type?: 'embed' | 'bookmark',
): Promise<GhostOembedResponse> {
  const response = await client.get<GhostOembedResponse>('/ghost/api/admin/oembed/', {
    params: type ? { url, type } : { url },
  });
  return response.data;
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

export async function uploadImage(localUri: string): Promise<string> {
  const filename = localUri.split('/').pop() ?? 'image.jpg';
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const type = MIME_BY_EXT[ext] ?? 'image/jpeg';

  const formData = new FormData();
  // React Native takes {uri, name, type} where the web expects a Blob.
  formData.append('file', { uri: localUri, name: filename, type } as unknown as Blob);
  formData.append('purpose', 'image');

  // Content-Type null lets RN's XHR add the multipart boundary itself.
  const response = await client.post<GhostImageUploadResponse>(
    '/ghost/api/admin/images/upload/',
    formData,
    { headers: { 'Content-Type': null } },
  );
  return response.data.images[0].url;
}

/**
 * Bypasses the interceptors so credentials can be checked before they are saved.
 * /site/ is public in Ghost, so an authenticated call is needed to actually validate the key.
 */
export async function testGhostConnection(baseUrl: string, apiKey: string): Promise<GhostSite> {
  const headers = { Authorization: `Ghost ${generateGhostJwt(apiKey)}` };
  try {
    const [site] = await Promise.all([
      axios.get<{ site: GhostSite }>(`${baseUrl}/ghost/api/admin/site/`, { headers, timeout: 15000 }),
      // Integration keys have no user, so probe a resource they can read.
      axios.get(`${baseUrl}/ghost/api/admin/posts/`, { headers, timeout: 15000, params: { limit: 1 } }),
    ]);
    return site.data.site;
  } catch (error) {
    throw axios.isAxiosError(error) ? toGhostError(error) : error;
  }
}
