// SPDX-License-Identifier: GPL-3.0-or-later
import { useState, useCallback } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { getLocales } from 'expo-localization';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export function useVoice() {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  useSpeechRecognitionEvent('start', () => setState('listening'));

  // Authoritative end-of-session signal — the underlying on-device recognizer is
  // continuous and emits isFinal results per-phrase while still listening, so 'idle'
  // must wait for the real session teardown rather than any single result.
  useSpeechRecognitionEvent('end', () => {
    setState((s) => (s === 'error' ? s : 'idle'));
  });

  useSpeechRecognitionEvent('result', (event) => {
    const best = event.results[0]?.transcript ?? '';
    setTranscript(best);
  });

  useSpeechRecognitionEvent('error', (event) => {
    // The recognizer fires ERROR_NO_MATCH ("no-speech") as a session-teardown artifact
    // even after a valid transcript was already delivered — not a real failure. Let the
    // 'end' event that follows finalize to idle instead of surfacing a false error toast.
    if (event.error === 'no-speech' && transcript.length > 0) return;
    setError(event.error ?? 'Reconnaissance vocale échouée');
    setState('error');
  });

  const start = useCallback(async (contextualStrings?: string[]) => {
    setError(null);
    setTranscript('');
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      setError('Permission microphone refusée');
      setState('error');
      return;
    }
    const lang = getLocales()[0]?.languageTag ?? 'fr-FR';
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      ...(contextualStrings && contextualStrings.length > 0 ? { contextualStrings } : {}),
    });
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
    setState('idle');
  }, []);

  return { state, transcript, error, start, stop, reset };
}
