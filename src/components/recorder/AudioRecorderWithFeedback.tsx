'use client';

import { useRecorder } from '@/hooks/useRecorder';
import { useRef, useEffect, useState, useCallback } from 'react';
import { uploadRecording, getActivePlaylist, addRecordingToPlaylist } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, Square, Send, CheckCircle2, Keyboard } from 'lucide-react';
import type { Recording, Playlist } from '@/lib/types';

// webkitAudioContextの型定義
interface WindowWithWebkit extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export default function AudioRecorderWithFeedback() {
  const {
    state,
    recordedBlob,
    recordedUrl,
    duration,
    availableDevices,
    selectedDeviceId,
    startRecording,
    stopRecording,
    reset,
    setSelectedDevice,
  } = useRecorder();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);

  // スピーカー選択関連のstate
  const [availableOutputDevices, setAvailableOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string>('');
  const [audioOutputSupported, setAudioOutputSupported] = useState<boolean>(false);

  // 共有のAudioContextを管理
  const audioContextRef = useRef<AudioContext | null>(null);

  // スピーカーデバイス一覧を取得
  const fetchAudioOutputDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      setAvailableOutputDevices(audioOutputs);
      console.log('利用可能なスピーカーデバイス:', audioOutputs);

      // localStorageから保存されたデバイスIDを復元
      const savedDeviceId = localStorage.getItem('recordingAudioOutputDeviceId');
      if (savedDeviceId && audioOutputs.some(d => d.deviceId === savedDeviceId)) {
        setSelectedOutputDeviceId(savedDeviceId);
      } else if (audioOutputs.length > 0) {
        // デフォルトデバイスを選択
        setSelectedOutputDeviceId(audioOutputs[0].deviceId);
      }
    } catch (error) {
      console.error('スピーカーデバイス一覧の取得に失敗:', error);
    }
  }, []);

  // AudioContextを取得または作成
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as WindowWithWebkit).webkitAudioContext!)();
    }
    return audioContextRef.current;
  }, []);

  // AudioContextのsinkIdを設定
  const setAudioContextSinkId = useCallback(async (deviceId: string) => {
    try {
      const context = getAudioContext();
      if ('setSinkId' in context) {
        await (context as AudioContext & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
        console.log(`AudioContextの出力デバイスを設定: ${deviceId}`);
      }
    } catch (error) {
      console.error('AudioContextの出力デバイス設定に失敗:', error);
    }
  }, [getAudioContext]);

  // スピーカーデバイスを変更
  const handleOutputDeviceChange = useCallback(async (deviceId: string) => {
    setSelectedOutputDeviceId(deviceId);
    localStorage.setItem('recordingAudioOutputDeviceId', deviceId);
    await setAudioContextSinkId(deviceId);
  }, [setAudioContextSinkId]);

  // Audio Output Devices APIのサポートを確認
  useEffect(() => {
    const checkAudioOutputSupport = () => {
      const hasSetsinkId = 'setSinkId' in HTMLAudioElement.prototype;
      const hasMediaDevices = 'mediaDevices' in navigator;
      const hasEnumerateDevices = hasMediaDevices && 'enumerateDevices' in navigator.mediaDevices;

      const supported = hasSetsinkId && hasMediaDevices && hasEnumerateDevices;
      setAudioOutputSupported(supported);

      if (supported) {
        fetchAudioOutputDevices();
      }
    };

    checkAudioOutputSupport();
  }, [fetchAudioOutputDevices]);

  // 選択されたデバイスが変更されたらAudioContextに適用
  useEffect(() => {
    if (selectedOutputDeviceId) {
      setAudioContextSinkId(selectedOutputDeviceId);
    }
  }, [selectedOutputDeviceId, setAudioContextSinkId]);

  // 音声フィードバック用の関数（共有AudioContextを使用）
  const playBeep = useCallback((frequency: number, duration: number, volume: number = 0.3) => {
    try {
      const audioContext = getAudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.error('ビープ音の再生エラー:', error);
    }
  }, [getAudioContext]);

  // テキスト読み上げ用の関数
  const playTextToSpeech = useCallback((text: string) => {
    try {
      if ('speechSynthesis' in window) {
        // 既存の読み上げをキャンセル
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP'; // 日本語
        utterance.rate = 1.0; // 読み上げ速度
        utterance.pitch = 1.0; // 音の高さ
        utterance.volume = 0.8; // 音量

        window.speechSynthesis.speak(utterance);
        console.log('音声読み上げ:', text);
      } else {
        console.warn('このブラウザはWeb Speech APIをサポートしていません');
      }
    } catch (error) {
      console.error('音声読み上げエラー:', error);
    }
  }, []);

  // 録音開始音（シンプルな「ピッ」）
  const playStartSound = useCallback(() => {
    playBeep(880, 0.15); // A5音、150ms
  }, [playBeep]);

  // 録音停止音（2回の「ピピッ」）
  const playStopSound = useCallback(() => {
    playBeep(880, 0.1); // 1回目
    setTimeout(() => {
      playBeep(880, 0.1); // 2回目
    }, 150);
  }, [playBeep]);

  // アップロード成功効果音（3音階で上昇するメロディ）
  const playSuccessSound = useCallback(() => {
    // ド→ミ→ソの和音的な成功音
    playBeep(523.25, 0.15, 0.3); // ド (C5)
    setTimeout(() => {
      playBeep(659.25, 0.15, 0.3); // ミ (E5)
    }, 100);
    setTimeout(() => {
      playBeep(783.99, 0.3, 0.3); // ソ (G5) - 最後の音は少し長め
    }, 200);
  }, [playBeep]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNewRecording = useCallback(() => {
    reset();
    setUploadState('idle');
  }, [reset]);

  const handleUpload = useCallback(async () => {
    if (!recordedBlob) return;

    setUploadState('uploading');

    try {
      // 有効なプレイリストを取得
      const activePlaylist = await getActivePlaylist();

      // 録音をアップロード（プレイリストIDを渡して専用ディレクトリに保存）
      const recording: Recording = await uploadRecording(
        recordedBlob,
        duration,
        undefined,
        activePlaylist?.id
      );

      // 有効なプレイリストがあれば、その録音を追加
      if (activePlaylist && recording) {
        try {
          await addRecordingToPlaylist(activePlaylist.id, recording.id);
        } catch {
          // プレイリストへの追加が失敗しても、録音自体は成功しているので続行
        }
      }

      setUploadState('success');

      // 成功効果音を再生
      playSuccessSound();

      // 2秒後に自動的にリセット
      setTimeout(() => {
        handleNewRecording();
      }, 2000);
    } catch {
      // エラーが発生してもリセットして次の録音を受け付ける
      setTimeout(() => {
        handleNewRecording();
      }, 2000);
    }
  }, [recordedBlob, duration, handleNewRecording, playSuccessSound]);

  const handleStartRecording = useCallback(() => {
    if (state === 'stopped') {
      reset();
    }
    // 録音開始音を再生
    playStartSound();
    // 効果音が録音に入らないよう、200ms遅延させてから録音開始
    setTimeout(() => {
      startRecording();
    }, 200);
  }, [state, reset, startRecording, playStartSound]);

  // 有効なプレイリストを取得
  useEffect(() => {
    const fetchActivePlaylist = async () => {
      try {
        const playlist = await getActivePlaylist();
        setActivePlaylist(playlist);
      } catch (error) {
        console.error('Failed to fetch active playlist:', error);
      }
    };

    fetchActivePlaylist();
  }, []);

  // 録音URLが変更されたら、オーディオ要素に設定して自動再生
  useEffect(() => {
    const setupAudioPlayback = async () => {
      if (audioRef.current && recordedUrl) {
        // スピーカーデバイスを設定
        if (audioOutputSupported && selectedOutputDeviceId && 'setSinkId' in audioRef.current) {
          try {
            await (audioRef.current as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(selectedOutputDeviceId);
            console.log('録音再生用のスピーカーを設定:', selectedOutputDeviceId);
          } catch (error) {
            console.error('録音再生用のスピーカー設定に失敗:', error);
          }
        }

        audioRef.current.src = recordedUrl;
        // 自動再生
        audioRef.current.play().catch((error) => {
          console.error('自動再生エラー:', error);
        });
      }
    };

    setupAudioPlayback();
  }, [recordedUrl, audioOutputSupported, selectedOutputDeviceId]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (uploadState !== 'idle') return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // 長押しによるリピートイベントを無視
      if (e.repeat) return;

      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          if (state === 'recording') {
            playStopSound();
            stopRecording();
          } else if (state === 'idle' || state === 'stopped') {
            handleStartRecording();
          }
          break;
        case 'enter':
          if (state === 'stopped' && recordedBlob) {
            e.preventDefault();
            handleUpload();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [state, uploadState, recordedBlob, stopRecording, handleStartRecording, handleUpload, playStopSound]);

  // Bluetoothスピーカーのオートパワーオフを防ぐためのキープアライブ音声
  useEffect(() => {
    const KEEPALIVE_INTERVAL = 45000; // 45秒

    const playKeepAliveMessage = () => {
      // 録音中は音を鳴らさない（録音に混入しないように）
      if (state !== 'recording') {
        playTextToSpeech('録音を待機しています。');
      }
    };

    const intervalId = setInterval(playKeepAliveMessage, KEEPALIVE_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [state, playTextToSpeech]);

  // クリーンアップ: AudioContextをクローズ、音声読み上げをキャンセル
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      // 音声読み上げが残っていればキャンセル
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      {uploadState === 'success' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-sm w-full mx-4 animate-in zoom-in duration-200">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                録音が完了しました
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ありがとうございました
              </p>
            </div>
          </div>
        </div>
      )}

      {uploadState === 'uploading' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-sm w-full mx-4">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                アップロード中...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl">
        {/* 現在有効なプレイリスト表示 */}
        {activePlaylist && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="text-center">
              <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                現在のプレイリスト
              </p>
              <p className="text-lg font-semibold text-blue-900 dark:text-blue-100 mt-1">
                {activePlaylist.name}
              </p>
            </div>
          </div>
        )}

        <div className="text-center space-y-8">
          {state === 'recording' && (
            <div className="space-y-6">
              <div className="relative">
                <div className="w-24 h-24 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                  <Mic className="h-12 w-12 text-red-600 dark:text-red-500 relative z-10" />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <p className="text-4xl font-mono font-bold text-gray-900 dark:text-gray-100">
                  {formatDuration(duration)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  録音中...
                </p>
              </div>
            </div>
          )}

          {state === 'idle' && uploadState === 'idle' && (
            <div className="space-y-6">
              <div className="w-24 h-24 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Mic className="h-12 w-12 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  録音を開始
                </h2>

                {availableDevices.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      マイクを選択
                    </label>
                    <select
                      value={selectedDeviceId || ''}
                      onChange={(e) => setSelectedDevice(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
                    >
                      {availableDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {audioOutputSupported && availableOutputDevices.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      スピーカーを選択
                    </label>
                    <select
                      value={selectedOutputDeviceId}
                      onChange={(e) => handleOutputDeviceChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100"
                    >
                      {availableOutputDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `スピーカー ${device.deviceId.substring(0, 8)}...`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  下のボタンを押して録音を開始してください
                </p>
              </div>
            </div>
          )}

          {state === 'stopped' && recordedUrl && uploadState === 'idle' && (
            <div className="space-y-6">
              <div className="w-24 h-24 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  録音が完了しました
                </h3>
                <audio
                  ref={audioRef}
                  controls
                  loop
                  className="w-full"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  内容を確認してアップロードしてください
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4">
            {(state === 'idle' || state === 'stopped') && uploadState === 'idle' && (
              <Button
                onClick={handleStartRecording}
                size="lg"
                className="px-8 py-6 text-base font-medium"
              >
                <Mic className="mr-2 h-5 w-5" />
                {state === 'stopped' ? '再録音' : '録音開始'}
              </Button>
            )}

            {state === 'recording' && (
              <Button
                onClick={() => {
                  playStopSound();
                  stopRecording();
                }}
                variant="destructive"
                size="lg"
                className="px-8 py-6 text-base font-medium"
              >
                <Square className="mr-2 h-5 w-5" />
                録音停止
              </Button>
            )}

            {state === 'stopped' && uploadState === 'idle' && (
              <Button
                onClick={handleUpload}
                size="lg"
                className="px-8 py-6 text-base font-medium bg-green-600 hover:bg-green-700"
              >
                <Send className="mr-2 h-5 w-5" />
                アップロード
              </Button>
            )}
          </div>

          {uploadState === 'idle' && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Keyboard className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  キーボードショートカット
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {(state === 'idle' || state === 'stopped') && (
                  <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs">
                      S
                    </kbd>
                    <span>{state === 'stopped' ? '再録音' : '録音開始'}</span>
                  </div>
                )}
                {state === 'recording' && (
                  <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs">
                      S
                    </kbd>
                    <span>録音停止</span>
                  </div>
                )}
                {state === 'stopped' && (
                  <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs">
                      Enter
                    </kbd>
                    <span>アップロード</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
