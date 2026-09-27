// SPDX-License-Identifier: GPL-3.0-or-later
// Ghost Admin API data shapes, payloads and typed errors.

// ---------------------------------------------------------------------------
// Ghost data
// ---------------------------------------------------------------------------

export interface GhostSite {
  title: string;
  description: string;
  url: string;
  version: string;
}

export interface GhostTag {
  id?: string;
  name: string;
  slug?: string;
}

export type PostStatus = 'draft' | 'published' | 'scheduled';

/** SEO / social fields edited from the post settings sheet — null means "unset" in Ghost. */
export interface PostMeta {
  custom_excerpt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
}

export interface GhostPost extends PostMeta {
  id: string;
  uuid: string;
  slug: string;
  title: string;
  /** Only present when requested with `formats=html`. */
  html?: string | null;
  status: PostStatus;
  tags: GhostTag[];
  feature_image: string | null;
  /** ISO 8601 — required in PUT payloads (optimistic lock). */
  updated_at: string;
  published_at: string | null;
  url: string;
}

export interface GhostPagination {
  page: number;
  pages: number;
  limit: number;
  total: number;
  next: number | null;
  prev: number | null;
}

export interface GhostPostsResponse {
  posts: GhostPost[];
  meta: { pagination: GhostPagination };
}

export interface GhostImageUploadResponse {
  images: Array<{ url: string; ref: string | null }>;
}

/** Subset of Ghost's /oembed/ response: either an oEmbed payload (html) or bookmark metadata. */
export interface GhostOembedResponse {
  type?: string;
  html?: string;
  url?: string;
  title?: string;
  metadata?: {
    url?: string;
    title?: string | null;
    description?: string | null;
    author?: string | null;
    publisher?: string | null;
    thumbnail?: string | null;
    icon?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Mutation payloads
// ---------------------------------------------------------------------------

export interface PostWriteFields extends PostMeta {
  title: string;
  html: string;
  status: PostStatus;
  tags: Array<{ name: string }>;
  feature_image: string | null;
}

export interface CreatePostPayload {
  posts: [PostWriteFields];
}

export interface UpdatePostPayload {
  /** updated_at is mandatory — Ghost answers 409 when it is missing or stale. */
  posts: [PostWriteFields & { updated_at: string }];
}

export type PostFilter = 'all' | PostStatus;

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

export class GhostApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GhostApiError';
  }
}

export class AuthenticationError extends GhostApiError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = 'AuthenticationError';
  }
}

/** 409 — the post changed on the server since it was loaded. */
export class ConflictError extends GhostApiError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends GhostApiError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends GhostApiError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = 'RateLimitError';
  }
}

export class NotConfiguredError extends Error {
  constructor(message = 'Aucune instance Ghost configurée') {
    super(message);
    this.name = 'NotConfiguredError';
  }
}

export class InvalidApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidApiKeyError';
  }
}

export class JwtSigningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtSigningError';
  }
}
