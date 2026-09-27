// SPDX-License-Identifier: GPL-3.0-or-later
// Push-to-talk dictation into the focused editor field. Title and body get live splicing at
// the cursor; tags are committed as chips once the session ends.

import { useEffect, useRef } from 'react';

import { useVoice } from './useVoice';
import { Selection } from '../utils/markdownFormat';

export type DictationField = 'title' | 'tags' | 'content';
type TextField = Exclude<DictationField, 'tags'>;

interface Options {
  getText(field: TextField): string;
  setText(field: TextField, value: string): void;
  /** Mutable cursor refs owned by the screen (updated by onSelectionChange). */
  selections: Record<TextField, { current: Selection }>;
  addTags(tags: string[]): void;
  vocabulary: string[];
  onError(message: string): void;
}

export function useFieldDictation({ getText, setText, selections, addTags, vocabulary, onError }: Options) {
  const { state, transcript, error, start, stop, reset } = useVoice();

  // Fixed at press time so a focus change mid-dictation doesn't redirect the session.
  const targetRef = useRef<DictationField>('content');
  // Where the session inserts, and how much of the field the last interim result occupies.
  const anchorRef = useRef<number | null>(null);
  const insertedLengthRef = useRef(0);
  const tagsPendingRef = useRef(false);
  // Finger lifted before the recognizer reported 'listening' (permission prompt, slow start).
  const releasedRef = useRef(false);

  const onAir = state === 'listening' || state === 'processing';

  useEffect(() => {
    const field = targetRef.current;
    if (!transcript || field === 'tags' || anchorRef.current === null) return;
    const current = getText(field);
    const anchor = anchorRef.current;
    setText(field, current.slice(0, anchor) + transcript + current.slice(anchor + insertedLengthRef.current));
    insertedLengthRef.current = transcript.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  useEffect(() => {
    if (state === 'listening' && releasedRef.current) stop();
    if (state !== 'idle' && state !== 'error') return;
    const field = targetRef.current;

    if (field !== 'tags' && anchorRef.current !== null) {
      // Park the cursor after the dictated text so the next session continues from there.
      const end = anchorRef.current + insertedLengthRef.current;
      selections[field].current = { start: end, end };
      anchorRef.current = null;
      insertedLengthRef.current = 0;
    } else if (field === 'tags' && tagsPendingRef.current) {
      tagsPendingRef.current = false;
      const tags = transcript.split(',').map((t) => t.trim()).filter(Boolean);
      if (tags.length > 0) addTags(tags);
    }

    if (state === 'error' && error) {
      onError(error);
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, error]);

  function pressIn(target: DictationField): void {
    if (onAir) return;
    releasedRef.current = false;
    targetRef.current = target;

    if (target === 'tags') {
      tagsPendingRef.current = true;
    } else {
      const pos = Math.min(selections[target].current.start, getText(target).length);
      const current = getText(target);
      const needsSpace = pos > 0 && !/\s/.test(current[pos - 1] ?? '');
      if (needsSpace) setText(target, `${current.slice(0, pos)} ${current.slice(pos)}`);
      anchorRef.current = needsSpace ? pos + 1 : pos;
      insertedLengthRef.current = 0;
    }

    reset();
    void start(vocabulary);
  }

  function pressOut(): void {
    releasedRef.current = true;
    if (onAir) stop();
  }

  return { state, onAir, pressIn, pressOut };
}
