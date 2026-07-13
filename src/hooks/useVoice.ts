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

  useSpeechRecognitionEvent('end', () => {
    setState((s) => (s === 'listening' ? 'processing' : s));
  });

  useSpeechRecognitionEvent('result', (event) => {
    const best = event.results[0]?.transcript ?? '';
    setTranscript(best);
    if (event.isFinal) setState('idle');
  });

  useSpeechRecognitionEvent('error', (event) => {
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
