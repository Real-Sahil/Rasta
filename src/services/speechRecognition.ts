/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// SpeechRecognition type declarations for cross-browser Web Speech API
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  errorMessage: string | null;
  startListening: (lang?: 'ur-PK' | 'en-US' | 'pa-PK') => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceInput(onResult?: (finalText: string) => void): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult; // always call the latest callback without re-creating the recogniser

  const isSupported = typeof window !== 'undefined' && Boolean(
    (window as unknown as IWindow).SpeechRecognition ||
    (window as unknown as IWindow).webkitSpeechRecognition
  );

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionClass =
      (window as unknown as IWindow).SpeechRecognition ||
      (window as unknown as IWindow).webkitSpeechRecognition;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorMessage(null);
    };

    recognition.onresult = (event: any) => {
      let currentInterim = '';
      let currentFinal = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          currentFinal += item[0].transcript;
        } else {
          currentInterim += item[0].transcript;
        }
      }

      setInterimTranscript(currentInterim);

      if (currentFinal) {
        setTranscript(currentFinal);
        onResultRef.current?.(currentFinal);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition event error:', event.error);
      if (event.error === 'not-allowed') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions.');
      } else if (event.error === 'no-speech') {
        setErrorMessage('No speech was detected. Please try speaking again.');
      } else {
        setErrorMessage(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSupported]);

  const startListening = useCallback((lang: 'ur-PK' | 'en-US' | 'pa-PK' = 'ur-PK') => {
    if (!recognitionRef.current) {
      setErrorMessage('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      setErrorMessage(null);
      setInterimTranscript('');
      setTranscript('');
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
    } catch (err: any) {
      // If already started or aborting, stop and restart cleanly
      recognitionRef.current.stop();
      setTimeout(() => {
        try {
          recognitionRef.current.lang = lang;
          recognitionRef.current.start();
        } catch (e) {
          console.warn('Failed to start speech recognition:', e);
        }
      }, 100);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    errorMessage,
    startListening,
    stopListening,
    resetTranscript
  };
}
