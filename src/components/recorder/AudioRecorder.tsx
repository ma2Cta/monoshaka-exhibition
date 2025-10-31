'use client';

import { useRecorder } from '@/hooks/useRecorder';
import { useEffect, useState, useCallback } from 'react';
import { uploadRecording, getActivePlaylist, addRecordingToPlaylist } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, Square, Send, CheckCircle2, Keyboard } from 'lucide-react';
import type { Recording, Playlist } from '@/lib/types';

export default function AudioRecorder() {
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

  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);

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
  }, [recordedBlob, duration, handleNewRecording]);

  const handleStartRecording = useCallback(() => {
    if (state === 'stopped') {
      reset();
    }
    startRecording();
  }, [state, reset, startRecording]);

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

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (uploadState !== 'idle') return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          if (state === 'recording') {
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
  }, [state, uploadState, recordedBlob, stopRecording, handleStartRecording, handleUpload]);

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
                <p className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100 text-center my-6">
                  {formatDuration(duration)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
                  Enterキーを押してアップロードしてください
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
