import { marked } from 'marked';

// ---------------------------------------------------------------------------
// HTML → Markdown (regex-based, compatible Hermes/React Native)
// Turndown requires DOM APIs absent in React Native — we use regex chains instead.
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return '';

  let s = html;

  // Strip Ghost Koenig card markers and HTML comments
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  // Strip script/style blocks entirely
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, '');

  // Code blocks — before inline code to avoid double-processing
  s = s.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, code) => {
    const lang = (_.match(/class=["'][^"']*language-([a-z]+)/) ?? [])[1] ?? '';
    return `\n\`\`\`${lang}\n${decodeEntities(code.replace(/<[^>]+>/g, ''))}\n\`\`\`\n\n`;
  });

  // Images — before links (images use similar syntax)
  s = s.replace(/<img[^>]+>/gi, (tag) => {
    const src = (tag.match(/src=["']([^"']+)["']/) ?? [])[1] ?? '';
    const alt = (tag.match(/alt=["']([^"']*)["']/) ?? [])[1] ?? '';
    return src ? `![${alt}](${src})` : '';
  });

  // Links
  s = s.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Headings
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n');
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n');
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n');
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n\n');
  s = s.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n\n');
  s = s.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n\n');

  // Inline formatting
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**');
  s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*');
  s = s.replace(/<(del|s|strike)[^>]*>([\s\S]*?)<\/(del|s|strike)>/gi, '~~$2~~');
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Blockquote
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    return text.split('\n').map((l: string) => `> ${l.trim()}`).join('\n') + '\n\n';
  });

  // Lists — li first, then the container
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) =>
    `- ${inner.replace(/<[^>]+>/g, '').trim()}\n`
  );
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

  // Horizontal rule
  s = s.replace(/<hr[^>]*>/gi, '\n---\n\n');

  // Paragraphs and line breaks
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n');
  s = s.replace(/<p[^>]*>/gi, '');

  // Figcaption (keep as italic)
  s = s.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, '\n*$1*\n');

  // Block containers — replace with newlines to preserve spacing
  s = s.replace(/<\/?(div|figure|section|article|aside|header|footer|main)[^>]*>/gi, '\n');

  // Strip all remaining tags
  s = s.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  s = decodeEntities(s);

  // Normalize whitespace
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  return s;
}

// ---------------------------------------------------------------------------
// Markdown → HTML (marked — pure JS, works on Hermes)
// ---------------------------------------------------------------------------

export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  try {
    return marked.parse(markdown, { async: false, gfm: true, breaks: true });
  } catch (error) {
    console.error('Erreur MD→HTML:', error instanceof Error ? error.message : error);
    return markdown;
  }
}
