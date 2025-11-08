import { useState, useRef, useCallback, useEffect } from 'react';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface AudioDevice {
  deviceId: string;
  label: string;
}

interface UseRecorderReturn {
  state: RecorderState;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  duration: number;
  error: string | null;
  availableDevices: AudioDevice[];
  selectedDeviceId: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
  loadDevices: () => Promise<void>;
  setSelectedDevice: (deviceId: string) => void;
}

export const useRecorder = (): UseRecorderReturn => {
  const [state, setState] = useState<RecorderState>('idle');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // デバイスリストを取得
  const loadDevices = useCallback(async () => {
    try {
      // まず一度許可を求める（デバイスラベルを取得するため）
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // デバイスリストを取得
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput' && device.deviceId !== 'default' && device.deviceId !== '')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `マイク ${device.deviceId.slice(0, 8)}`,
        }));

      setAvailableDevices(audioInputs);

      // 一時的なストリームを停止
      tempStream.getTracks().forEach(track => track.stop());

      // 常にリストの一番上のデバイスを選択
      if (audioInputs.length > 0) {
        const firstDeviceId = audioInputs[0].deviceId;
        setSelectedDeviceId(firstDeviceId);
        console.log('マイクデバイスを自動選択:', audioInputs[0].label);
      }
    } catch {
      setError('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
    }
  }, []); // 依存配列を空にして無限ループを防ぐ

  // デバイスを選択
  const setSelectedDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
  }, []);

  // 初回マウント時にデバイスリストを取得
  useEffect(() => {
    loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回マウント時のみ実行

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // マイクへのアクセスを要求（選択されたデバイスを使用）
      const audioConstraints: MediaTrackConstraints = {
        channelCount: 1,
        sampleRate: 48000,
      };

      // デバイスIDが選択されている場合は、そのデバイスを使用
      if (selectedDeviceId) {
        audioConstraints.deviceId = { exact: selectedDeviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      streamRef.current = stream;

      // MediaRecorderの設定 - WebM形式を使用
      let mimeType: string;
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else {
        mimeType = 'audio/mp4;codecs=mp4a.40.2';
      }

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
      mediaRecorder.start(1000);
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
      setError(
        err instanceof Error
          ? err.message
          : 'マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。'
      );
      setState('idle');
    }
  }, [selectedDeviceId]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

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
    availableDevices,
    selectedDeviceId,
    startRecording,
    stopRecording,
    reset,
    loadDevices,
    setSelectedDevice,
  };
};
