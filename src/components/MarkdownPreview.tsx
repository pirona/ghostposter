// SPDX-License-Identifier: GPL-3.0-or-later
// Sandboxed preview: JS off, no navigation, embeds shown as static cards (no third-party players).

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from 'react-native-paper';

import { markdownToHtml } from '../utils/contentConverter';
import { escapeHtml, renderEmbedPreview } from '../utils/embeds';

interface Props {
  markdown: string;
  title?: string;
  featureImage?: string | null;
}

function buildCss(dark: boolean): string {
  const c = dark
    ? { bg: '#15171A', text: '#E4E7EB', heading: '#F0F2F4', link: '#82B1FF', code: '#252A31', muted: '#9BA3AC', line: '#3E4751' }
    : { bg: '#FAFAFA', text: '#212121', heading: '#111111', link: '#1565C0', code: '#F0F0F0', muted: '#616161', line: '#E0E0E0' };

  return `
    body { font-family: -apple-system, system-ui, sans-serif; font-size: 16px; line-height: 1.7;
      color: ${c.text}; background: ${c.bg}; padding: 16px; margin: 0; overflow-wrap: anywhere; }
    h1, h2, h3, h4 { color: ${c.heading}; margin-top: 1.2em; line-height: 1.3; }
    h1 { font-size: 1.6em; } h2 { font-size: 1.4em; } h3 { font-size: 1.2em; }
    a { color: ${c.link}; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    pre { background: ${c.code}; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
    code { background: ${c.code}; padding: 2px 5px; border-radius: 3px; font-size: 13px; }
    pre code { padding: 0; }
    blockquote { border-left: 4px solid ${c.line}; margin: 0; padding-left: 16px; color: ${c.muted}; }
    hr { border: none; border-top: 1px solid ${c.line}; margin: 1.5em 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid ${c.line}; padding: 8px 12px; }
    figure { margin: 1em 0; }
    figcaption { color: ${c.muted}; font-size: 0.85em; text-align: center; }
    .kg-card { border: 1px dashed ${c.line}; border-radius: 8px; padding: 8px; }
    .kg-gallery-row { display: flex; gap: 4px; }
    .preview-title { font-size: 1.9em; font-weight: 700; color: ${c.heading}; margin: 0 0 0.6em; line-height: 1.25; }
    .preview-feature-image { width: 100%; margin-bottom: 1.2em; display: block; }
    .embed-preview { border: 1px solid ${c.line}; border-radius: 8px; padding: 12px; margin: 1em 0; }
    .embed-thumb { position: relative; margin-bottom: 8px; }
    .embed-thumb img { display: block; width: 100%; border-radius: 6px; }
    .embed-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 48px; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,.6); }
    .embed-label { font-weight: 600; }
    .embed-url { color: ${c.muted}; font-size: 0.85em; }
  `;
}

export function MarkdownPreview({ markdown, title, featureImage }: Props): React.JSX.Element {
  const { dark } = useTheme();

  const source = useMemo(() => {
    // Iframes kept verbatim from Ghost cards would still hit third parties even with JS off.
    const body = markdownToHtml(markdown, renderEmbedPreview)
      .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '<div class="embed-preview"><div class="embed-label">⧉ Embed</div></div>')
      || '<p><em>Aperçu vide</em></p>';
    const titleHtml = title ? `<h1 class="preview-title">${escapeHtml(title)}</h1>` : '';
    const imageHtml = featureImage
      ? `<img class="preview-feature-image" src="${escapeHtml(featureImage)}" alt="" />`
      : '';
    return {
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${buildCss(dark)}</style></head>
<body>${imageHtml}${titleHtml}${body}</body></html>`,
    };
  }, [markdown, title, featureImage, dark]);

  return (
    <View style={styles.container}>
      <WebView
        source={source}
        originWhitelist={['about:*']}
        javaScriptEnabled={false}
        onShouldStartLoadWithRequest={(req) => req.url.startsWith('about:')}
        style={styles.container}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
