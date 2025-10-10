import { useState, useRef, useCallback } from 'react';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

interface UseRecorderReturn {
  state: RecorderState;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  duration: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
}

export const useRecorder = (): UseRecorderReturn => {
  const [state, setState] = useState<RecorderState>('idle');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // マイクへのアクセスを要求
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
        }
      });
      streamRef.current = stream;

      // MediaRecorderの設定
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // データが利用可能になったときのハンドラー
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // 録音停止時のハンドラー
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);

        // URLを生成
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);

        setState('stopped');

        // ストリームを停止
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        // タイマーをクリア
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };

      // 録音開始
      mediaRecorder.start(100); // 100msごとにdataavailableイベントを発火
      setState('recording');
      startTimeRef.current = Date.now();

      // 録音時間のタイマー
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);

        // 最大60秒で自動停止
        if (elapsed >= 60) {
          mediaRecorder.stop();
        }
      }, 100);

    } catch (err) {
      console.error('録音開始エラー:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。'
      );
      setState('idle');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    // URLをクリーンアップ
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }

    // タイマーをクリア
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // ストリームを停止
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    setState('idle');
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    setError(null);
    chunksRef.current = [];
  }, [recordedUrl]);

  return {
    state,
    recordedBlob,
    recordedUrl,
    duration,
    error,
    startRecording,
    stopRecording,
    reset,
  };
};
