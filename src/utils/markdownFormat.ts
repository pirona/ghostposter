// SPDX-License-Identifier: GPL-3.0-or-later
// Pure text transforms behind the Markdown toolbar: each returns the new text and the
// selection to restore, so the caller can push them to the TextInput in one step.

export interface Selection {
  start: number;
  end: number;
}

export interface TextEdit {
  text: string;
  selection: Selection;
}

/** Wraps the selection (or a placeholder) in `marker`; unwraps if it is already wrapped. */
export function toggleWrap(text: string, sel: Selection, marker: string, placeholder: string): TextEdit {
  const before = text.slice(0, sel.start);
  const selected = text.slice(sel.start, sel.end);
  const after = text.slice(sel.end);
  const m = marker.length;

  if (before.endsWith(marker) && after.startsWith(marker)) {
    return {
      text: before.slice(0, -m) + selected + after.slice(m),
      selection: { start: sel.start - m, end: sel.end - m },
    };
  }
  const inner = selected || placeholder;
  return {
    text: before + marker + inner + marker + after,
    selection: { start: sel.start + m, end: sel.start + m + inner.length },
  };
}

function lineBounds(text: string, sel: Selection): Selection {
  const start = text.lastIndexOf('\n', sel.start - 1) + 1;
  const nl = text.indexOf('\n', sel.end);
  return { start, end: nl < 0 ? text.length : nl };
}

/**
 * Prefixes every selected line; removes the prefix if all lines already have it.
 * `prefix` may depend on the line index (numbered lists).
 */
export function toggleLinePrefix(
  text: string,
  sel: Selection,
  prefix: string | ((index: number) => string),
  matcher: RegExp,
): TextEdit {
  const bounds = lineBounds(text, sel);
  const lines = text.slice(bounds.start, bounds.end).split('\n');
  const allPrefixed = lines.every((l) => matcher.test(l));
  const nextLines = allPrefixed
    ? lines.map((l) => l.replace(matcher, ''))
    : lines.map((l, i) => (typeof prefix === 'string' ? prefix : prefix(i)) + l.replace(matcher, ''));
  const block = nextLines.join('\n');
  const end = bounds.start + block.length;
  return {
    text: text.slice(0, bounds.start) + block + text.slice(bounds.end),
    selection: { start: sel.start === sel.end ? end : bounds.start, end },
  };
}

/** Replaces the selection with a block, isolated by blank lines as Markdown blocks require. */
export function insertBlock(text: string, sel: Selection, block: string, cursorOffset = block.length): TextEdit {
  const before = text.slice(0, sel.start);
  const after = text.slice(sel.end);
  const lead = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const pos = before.length + lead.length + cursorOffset;
  return { text: before + lead + block + trail + after, selection: { start: pos, end: pos } };
}

export function insertLink(text: string, sel: Selection, url: string): TextEdit {
  const label = text.slice(sel.start, sel.end) || 'lien';
  const link = `[${label}](${url})`;
  const pos = sel.start + link.length;
  return { text: text.slice(0, sel.start) + link + text.slice(sel.end), selection: { start: pos, end: pos } };
}

export function insertInline(text: string, sel: Selection, snippet: string): TextEdit {
  const pos = sel.start + snippet.length;
  return { text: text.slice(0, sel.start) + snippet + text.slice(sel.end), selection: { start: pos, end: pos } };
}

export const Format = {
  bold: (t: string, s: Selection) => toggleWrap(t, s, '**', 'gras'),
  italic: (t: string, s: Selection) => toggleWrap(t, s, '*', 'italique'),
  strike: (t: string, s: Selection) => toggleWrap(t, s, '~~', 'barré'),
  inlineCode: (t: string, s: Selection) => toggleWrap(t, s, '`', 'code'),
  heading: (t: string, s: Selection) => toggleLinePrefix(t, s, '## ', /^#{1,6} /),
  quote: (t: string, s: Selection) => toggleLinePrefix(t, s, '> ', /^> ?/),
  bulletList: (t: string, s: Selection) => toggleLinePrefix(t, s, '- ', /^[-*] /),
  numberedList: (t: string, s: Selection) => toggleLinePrefix(t, s, (i) => `${i + 1}. `, /^\d+\. /),
  divider: (t: string, s: Selection) => insertBlock(t, s, '---'),
  codeBlock: (t: string, s: Selection, lang: string) => {
    const code = t.slice(s.start, s.end);
    const opening = `\`\`\`${lang}\n`;
    return insertBlock(t, s, `${opening}${code}\n\`\`\``, opening.length + code.length);
  },
};

// ---------------------------------------------------------------------------
// Text statistics
// ---------------------------------------------------------------------------

const WORDS_PER_MINUTE = 230;

export function textStats(markdown: string): { words: number; minutes: number } {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ');
  const words = plain.split(/\s+/).filter(Boolean).length;
  return { words, minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)) };
}

/** First sentences of the body as plain text — used to prefill SEO descriptions. */
export function plainExcerpt(markdown: string, maxLength = 155): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6} |^> |^[-*] |^\d+\. /gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  const cut = plain.slice(0, maxLength - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), maxLength - 20))}…`;
}
