import React, { useMemo } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { WebView } from 'react-native-webview';

import { markdownToHtml } from '../utils/contentConverter';

export interface MarkdownPreviewProps {
  markdown: string;
}

function buildCss(dark: boolean): string {
  const bg = dark ? '#15171A' : '#FAFAFA';
  const text = dark ? '#E4E7EB' : '#212121';
  const heading = dark ? '#F0F2F4' : '#111111';
  const link = dark ? '#82B1FF' : '#1565C0';
  const codeBg = dark ? '#252A31' : '#F5F5F5';
  const codeText = dark ? '#E4E7EB' : '#212121';
  const blockquoteBorder = dark ? '#3E4751' : '#BDBDBD';
  const blockquoteText = dark ? '#9BA3AC' : '#616161';
  const hr = dark ? '#3E4751' : '#E0E0E0';
  const tableBorder = dark ? '#3E4751' : '#E0E0E0';
  const thBg = dark ? '#252A31' : '#F5F5F5';

  return `
    body {
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      color: ${text};
      background: ${bg};
      padding: 16px;
      margin: 0;
    }
    h1, h2, h3, h4 { color: ${heading}; margin-top: 1.2em; }
    h1 { font-size: 1.6em; }
    h2 { font-size: 1.4em; }
    h3 { font-size: 1.2em; }
    a { color: ${link}; text-decoration: underline; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    pre {
      background: ${codeBg};
      color: ${codeText};
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 13px;
    }
    code {
      background: ${codeBg};
      color: ${codeText};
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 13px;
    }
    blockquote {
      border-left: 4px solid ${blockquoteBorder};
      margin: 0;
      padding-left: 16px;
      color: ${blockquoteText};
    }
    hr { border: none; border-top: 1px solid ${hr}; margin: 1.5em 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid ${tableBorder}; padding: 8px 12px; }
    th { background: ${thBg}; }
  `;
}

export function MarkdownPreview({ markdown }: MarkdownPreviewProps): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const htmlSource = useMemo(() => {
    const body = markdownToHtml(markdown) || '<p><em>Aperçu vide</em></p>';
    return {
      html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${buildCss(isDark)}</style>
</head>
<body>${body}</body>
</html>`,
    };
  }, [markdown, isDark]);

  return (
    <View style={styles.container}>
      <WebView
        source={htmlSource}
        originWhitelist={[]}
        javaScriptEnabled={false}
        scrollEnabled
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
