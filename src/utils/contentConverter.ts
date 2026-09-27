// SPDX-License-Identifier: GPL-3.0-or-later
// HTML <-> Markdown for the editor. Regex-based because Hermes has no DOM (turndown needs one).
//
// Round-trip contract: anything the editor cannot represent (Ghost cards such as galleries,
// callouts, captioned images, tables...) is kept verbatim as a raw HTML block, never dropped.
// Embeds and bookmarks become readable shortcodes: {{embed: URL}} / {{bookmark: URL}}.

import { Marked, Tokens } from 'marked';

export type EmbedKind = 'embed' | 'bookmark';

export interface EmbedRef {
  kind: EmbedKind;
  url: string;
}

export function embedShortcode({ kind, url }: EmbedRef): string {
  return `{{${kind}: ${url}}}`;
}

export function embedKey({ kind, url }: EmbedRef): string {
  return `${kind}:${url}`;
}

// ---------------------------------------------------------------------------
// HTML -> Markdown
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', euro: '€', copy: '©',
};

/** Single pass, so "&amp;lt;" becomes "&lt;" and not "<". */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const stripTags = (s: string): string => s.replace(/<[^>]+>/g, '');

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
}

/** Index just past the element closing the one opened at `start`, or -1 if unbalanced. */
function balancedEnd(html: string, start: number, tag: string): number {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return re.lastIndex;
  }
  return -1;
}

/** Canonical page URL for iframe players the editor knows how to name. */
function embedUrlFromIframe(src: string): string | null {
  const yt = src.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/watch?v=${yt[1]}`;
  const vimeo = src.match(/player\.vimeo\.com\/video\/(\d+)/);
  if (vimeo) return `https://vimeo.com/${vimeo[1]}`;
  return null;
}

class Protector {
  private readonly slots: string[] = [];

  /** Returns a placeholder the regex passes below won't touch. */
  keep(markdown: string, block: boolean): string {
    const token = `\u0000${this.slots.push(markdown) - 1}\u0000`;
    return block ? `\n\n${token}\n\n` : token;
  }

  keepRawHtml(html: string): string {
    // A CommonMark HTML block ends at the first blank line, so the raw block must have none.
    return this.keep(html.trim().replace(/\n\s*\n/g, '\n'), true);
  }

  restore(s: string): string {
    return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => this.slots[Number(i)]);
  }
}

function convertCard(block: string, openTag: string, p: Protector): string {
  const classes = (attr(openTag, 'class') ?? '').split(/\s+/);
  const hasCaption = /<figcaption\b/i.test(block);

  if (classes.includes('kg-bookmark-card')) {
    const container = block.match(/<a[^>]*kg-bookmark-container[^>]*>/i)?.[0];
    const href = container ? attr(container, 'href') : null;
    if (href && !hasCaption) return p.keep(embedShortcode({ kind: 'bookmark', url: decodeEntities(href) }), true);
  }

  if (classes.includes('kg-embed-card') && !hasCaption) {
    const iframe = block.match(/<iframe[^>]*>/i)?.[0];
    const url = iframe ? embedUrlFromIframe(attr(iframe, 'src') ?? '') : null;
    if (url) return p.keep(embedShortcode({ kind: 'embed', url }), true);
  }

  // Plain full-width-less image / code cards are editable as Markdown; any extra
  // (caption, wide/full width, alt layouts) would be lost, so they stay raw.
  const plain = classes.filter((c) => c && c !== 'kg-card').length === 1 && !hasCaption;
  if (plain && (classes.includes('kg-image-card') || classes.includes('kg-code-card'))) {
    return block.replace(/^<[^>]+>/, '').replace(/<\/(figure|div)>$/i, '');
  }

  return p.keepRawHtml(block);
}

function protectCards(html: string, p: Protector): string {
  const opener = /<(figure|div)\b[^>]*\bclass=["'][^"']*\bkg-card\b[^"']*["'][^>]*>/gi;
  let out = '';
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(html)) !== null) {
    const end = balancedEnd(html, m.index, m[1]);
    if (end < 0) break;
    out += html.slice(cursor, m.index) + convertCard(html.slice(m.index, end), m[0], p);
    cursor = end;
    opener.lastIndex = end;
  }
  return out + html.slice(cursor);
}

function protectElements(html: string, tag: string, p: Protector): string {
  const opener = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  let out = '';
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(html)) !== null) {
    const end = balancedEnd(html, m.index, tag);
    if (end < 0) break;
    out += html.slice(cursor, m.index) + p.keepRawHtml(html.slice(m.index, end));
    cursor = end;
    opener.lastIndex = end;
  }
  return out + html.slice(cursor);
}

export function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return '';
  const p = new Protector();
  let s = html;

  // Ghost HTML cards are delimited by comments; the markers are what makes Ghost
  // re-import the block as an HTML card, so they are kept with it.
  s = s.replace(
    /<!--kg-card-begin: html-->[\s\S]*?<!--kg-card-end: html-->/g,
    (block: string) => p.keepRawHtml(block),
  );
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  s = protectCards(s, p);
  for (const tag of ['table', 'iframe', 'video', 'audio', 'details']) {
    s = protectElements(s, tag, p);
  }
  // Scripts outside cards are not something the editor should carry around.
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');

  s = s.replace(/<pre[^>]*>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, codeAttrs: string, code: string) => {
    const lang = codeAttrs.match(/language-([\w+#-]+)/)?.[1] ?? '';
    const body = decodeEntities(stripTags(code)).replace(/\n$/, '');
    return p.keep(`\`\`\`${lang}\n${body}\n\`\`\``, true);
  });
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code: string) => {
    const text = decodeEntities(stripTags(code));
    const fence = text.includes('`') ? '``' : '`';
    return p.keep(`${fence}${text}${fence}`, false);
  });

  s = s.replace(/<img[^>]*>/gi, (tag) => {
    const src = attr(tag, 'src');
    return src ? `![${attr(tag, 'alt') ?? ''}](${src})` : '';
  });
  s = s.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level: string, text: string) =>
    `\n\n${'#'.repeat(Number(level))} ${stripTags(text).trim()}\n\n`);

  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  s = s.replace(/<(del|s|strike)\b[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~');

  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner: string) => {
    const text = stripTags(inner.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n')).trim();
    return '\n\n' + text.split('\n').map((l) => (l.trim() ? `> ${l.trim()}` : '>')).join('\n') + '\n\n';
  });

  // Lists — innermost first so nesting (up to a few levels) survives as indentation.
  {
    let prev: string;
    let pass = 0;
    do {
      prev = s;
      s = s.replace(
        /<(ul|ol)[^>]*>((?:(?!<(?:ul|ol)\b)[\s\S])*?)<\/\1>/gi,
        (_match: string, tag: string, inner: string) => {
          let n = 0;
          const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_li: string, content: string) => {
            const lines = stripTags(content).trim().split('\n').filter((l) => l.trim());
            if (lines.length === 0) return '';
            const bullet = tag.toLowerCase() === 'ol' ? `${++n}.` : '-';
            return [`${bullet} ${lines[0]}`, ...lines.slice(1).map((l) => `  ${l.trim()}`)].join('\n') + '\n';
          });
          // Whitespace between <li> tags would otherwise turn it into a loose list.
          return '\n' + items.replace(/\n\s*\n/g, '\n').trim() + '\n\n';
        },
      );
      pass++;
    } while (s !== prev && pass < 6);
    s = s.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
  }

  s = s.replace(/<hr[^>]*>/gi, '\n\n---\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n').replace(/<p[^>]*>/gi, '');
  s = s.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, '\n*$1*\n');
  s = s.replace(/<\/?(div|figure|section|article|aside|header|footer|main|span)[^>]*>/gi, '\n');
  s = stripTags(s);

  // Decoded text must not be re-read as markup by marked on save: literal entities
  // and tag-like "<" get escaped again.
  s = decodeEntities(s)
    .replace(/&(?=#?\w+;)/g, '&amp;')
    .replace(/<(?=[A-Za-z/!?])/g, '&lt;');

  s = p.restore(s);
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Markdown -> HTML
// ---------------------------------------------------------------------------

const SHORTCODE_RE = /^\{\{(embed|bookmark):\s*(https?:\/\/[^\s}]+)\s*\}\}[ \t]*(?:\n+|$)/;

interface ShortcodeToken extends Tokens.Generic {
  type: 'ghostShortcode';
  kind: EmbedKind;
  url: string;
}

function createMarked(renderEmbed: (ref: EmbedRef) => string): Marked {
  return new Marked({
    gfm: true,
    breaks: true,
    async: false,
    extensions: [
      {
        name: 'ghostShortcode',
        level: 'block',
        start: (src: string) => {
          const i = src.indexOf('{{');
          return i < 0 ? undefined : i;
        },
        tokenizer: (src: string): ShortcodeToken | undefined => {
          const m = SHORTCODE_RE.exec(src);
          if (!m) return undefined;
          return { type: 'ghostShortcode', raw: m[0], kind: m[1] as EmbedKind, url: m[2] };
        },
        renderer: (token) => `${renderEmbed(token as ShortcodeToken)}\n`,
      },
    ],
  });
}

/** Shortcodes outside code blocks, deduplicated. */
export function listEmbeds(markdown: string): EmbedRef[] {
  const found = new Map<string, EmbedRef>();
  const marked = createMarked(() => '');
  marked.walkTokens(marked.lexer(markdown), (token) => {
    if (token.type === 'ghostShortcode') {
      const { kind, url } = token as ShortcodeToken;
      found.set(embedKey({ kind, url }), { kind, url });
    }
  });
  return [...found.values()];
}

/** `renderEmbed` gets each shortcode; callers resolve embeds beforehand (see utils/embeds). */
export function markdownToHtml(markdown: string, renderEmbed: (ref: EmbedRef) => string): string {
  if (!markdown) return '';
  return createMarked(renderEmbed).parse(markdown) as string;
}
