import { useState, useRef, useCallback, useEffect } from 'react';

// Web Speech API の型定義（TypeScriptのデフォルトには含まれていない場合がある）
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
    };
  }
}

export interface UseSpeechRecognitionReturn {
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export const useSpeechRecognition = (): UseSpeechRecognitionReturn => {
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ブラウザがWeb Speech APIをサポートしているかチェック
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    // SpeechRecognitionのインスタンスを作成
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    // 設定
    recognition.continuous = true; // 連続認識
    recognition.interimResults = true; // 途中結果も取得
    recognition.lang = 'ja-JP'; // 日本語

    // 結果を受け取ったときの処理
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log('[SpeechRecognition] onresult triggered', event);
      let finalTranscript = '';
      let interimTranscript = '';

      // すべての結果を処理
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPart = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcriptPart + ' ';
        } else {
          interimTranscript += transcriptPart;
        }
      }

      console.log('[SpeechRecognition] Final:', finalTranscript, 'Interim:', interimTranscript);

      // 確定した文字起こしを累積
      if (finalTranscript) {
        setTranscript(prev => {
          const newTranscript = prev + finalTranscript;
          console.log('[SpeechRecognition] Updated transcript:', newTranscript);
          return newTranscript;
        });
      }
    };

    // 認識開始時
    recognition.onstart = () => {
      console.log('[SpeechRecognition] Started');
      setIsListening(true);
      setError(null);
    };

    // 認識終了時
    recognition.onend = () => {
      console.log('[SpeechRecognition] Ended');
      setIsListening(false);
    };

    // エラー発生時
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[SpeechRecognition] Error:', event.error, event);
      setError(`音声認識エラー: ${event.error}`);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    // クリーンアップ
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    console.log('[SpeechRecognition] startListening called', {
      hasRecognition: !!recognitionRef.current,
      isListening,
      isSupported
    });

    if (!recognitionRef.current || isListening) {
      console.log('[SpeechRecognition] Cannot start - already listening or no recognition');
      return;
    }

    try {
      console.log('[SpeechRecognition] Calling start()...');
      recognitionRef.current.start();
    } catch (err) {
      console.error('[SpeechRecognition] Failed to start:', err);
      setError('音声認識を開始できませんでした');
    }
  }, [isListening, isSupported]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) {
      return;
    }

    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error('Failed to stop speech recognition:', err);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    transcript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
};
