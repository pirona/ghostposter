// SPDX-License-Identifier: GPL-3.0-or-later
// Turns {{embed}} / {{bookmark}} shortcodes into Ghost card HTML (what Koenig itself
// renders, so Ghost re-imports them as real cards) and into safe preview placeholders.

import { fetchOembed } from '../api/ghostClient';
import { GhostOembedResponse } from '../api/ghostTypes';
import { EmbedRef, embedKey, listEmbeds } from './contentConverter';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

function vimeoId(url: string): string | null {
  return url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] ?? null;
}

/** Player iframe built locally when the oEmbed lookup is unavailable. */
function fallbackPlayer(url: string): string | null {
  const yt = youtubeId(url);
  if (yt) {
    return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${yt}?feature=oembed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  }
  const vimeo = vimeoId(url);
  if (vimeo) {
    return `<iframe src="https://player.vimeo.com/video/${vimeo}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  }
  return null;
}

function embedCard(innerHtml: string): string {
  return `<figure class="kg-card kg-embed-card">${innerHtml}</figure>`;
}

function bookmarkCard(url: string, meta: NonNullable<GhostOembedResponse['metadata']>): string {
  const e = (v?: string | null): string => escapeHtml(v ?? '');
  // Ghost swaps author/publisher classes for theme backwards-compatibility — mirror that.
  const metadata = [
    meta.icon ? `<img class="kg-bookmark-icon" src="${e(meta.icon)}" alt="">` : '',
    meta.publisher ? `<span class="kg-bookmark-author">${e(meta.publisher)}</span>` : '',
    meta.author ? `<span class="kg-bookmark-publisher">${e(meta.author)}</span>` : '',
  ].join('');
  const thumbnail = meta.thumbnail
    ? `<div class="kg-bookmark-thumbnail"><img src="${e(meta.thumbnail)}" alt=""></div>`
    : '';
  return `<figure class="kg-card kg-bookmark-card"><a class="kg-bookmark-container" href="${e(url)}">`
    + `<div class="kg-bookmark-content"><div class="kg-bookmark-title">${e(meta.title || url)}</div>`
    + `<div class="kg-bookmark-description">${e(meta.description)}</div>`
    + `<div class="kg-bookmark-metadata">${metadata}</div></div>${thumbnail}</a></figure>`;
}

// Per-session cache: re-saving a post must not re-query every provider.
const resolved = new Map<string, string>();

async function resolveOne(ref: EmbedRef): Promise<string> {
  const key = embedKey(ref);
  const cached = resolved.get(key);
  if (cached) return cached;

  let html: string;
  try {
    const data = await fetchOembed(ref.url, ref.kind === 'bookmark' ? 'bookmark' : undefined);
    if (ref.kind === 'embed' && data.html) html = embedCard(data.html);
    else if (data.metadata) html = bookmarkCard(ref.url, data.metadata);
    else throw new Error('réponse oEmbed vide');
  } catch (error) {
    const player = ref.kind === 'embed' ? fallbackPlayer(ref.url) : null;
    if (player) html = embedCard(player);
    else if (ref.kind === 'bookmark') html = bookmarkCard(ref.url, { title: ref.url });
    else {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Embed impossible pour ${ref.url} (${reason}). Utilisez {{bookmark: …}} à la place.`);
    }
  }
  resolved.set(key, html);
  return html;
}

/** Resolves every shortcode of the document; the returned renderer is synchronous. */
export async function resolveEmbeds(markdown: string): Promise<(ref: EmbedRef) => string> {
  const refs = listEmbeds(markdown);
  const entries = await Promise.all(refs.map(async (ref) => [embedKey(ref), await resolveOne(ref)] as const));
  const table = new Map(entries);
  return (ref) => table.get(embedKey(ref)) ?? '';
}

/** Preview never loads third-party players (JS stays off); it shows a static card instead. */
export function renderEmbedPreview(ref: EmbedRef): string {
  const yt = ref.kind === 'embed' ? youtubeId(ref.url) : null;
  const thumb = yt
    ? `<div class="embed-thumb"><img src="https://img.youtube.com/vi/${yt}/hqdefault.jpg" alt=""><span class="embed-play">▶</span></div>`
    : '';
  const label = ref.kind === 'bookmark' ? '🔖 Bookmark' : yt ? '▶ YouTube' : '⧉ Embed';
  return `<div class="embed-preview">${thumb}<div class="embed-label">${label}</div>`
    + `<div class="embed-url">${escapeHtml(ref.url)}</div></div>`;
}
