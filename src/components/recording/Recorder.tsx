'use client';

import { useRecorder } from '@/hooks/useRecorder';
import { useEffect, useState, useCallback } from 'react';
import { uploadRecording, addRecordingToPlaylist } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mic, Square, Send, CheckCircle2 } from 'lucide-react';
import type { Recording } from '@/lib/types';

interface RecorderProps {
  playlistId: string;
  onRecordingAdded?: (recording: Recording) => void;
}

/**
 * 録音コンポーネント
 */
export function Recorder({ playlistId, onRecordingAdded }: RecorderProps) {
  const {
    state,
    recordedBlob,
    duration,
    availableDevices,
    selectedDeviceId,
    startRecording,
    stopRecording,
    reset,
    setSelectedDevice,
  } = useRecorder();

  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success'>('idle');

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
      // 録音をアップロード（プレイリストIDを渡して専用ディレクトリに保存）
      const recording: Recording = await uploadRecording(
        recordedBlob,
        duration,
        undefined,
        playlistId
      );

      // プレイリストに録音を追加
      if (playlistId && recording) {
        try {
          await addRecordingToPlaylist(playlistId, recording.id);
          // 親コンポーネントに通知（ページ全体のリフレッシュを避ける）
          onRecordingAdded?.(recording);
        } catch (error) {
          console.error('プレイリストへの追加に失敗:', error);
        }
      }

      setUploadState('success');

      // 2秒後に自動的にリセット
      setTimeout(() => {
        handleNewRecording();
      }, 2000);
    } catch (error) {
      console.error('アップロードエラー:', error);
      // エラーが発生してもリセットして次の録音を受け付ける
      setTimeout(() => {
        handleNewRecording();
      }, 2000);
    }
  }, [recordedBlob, duration, playlistId, handleNewRecording, onRecordingAdded]);

  const handleStartRecording = useCallback(() => {
    if (state === 'stopped') {
      reset();
    }
    // キーボード音が録音に入らないよう、400ms遅延させてから録音開始
    setTimeout(() => {
      startRecording();
    }, 400);
  }, [state, reset, startRecording]);

  // キーボードショートカット
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
    <Card>
      <CardHeader>
        <CardTitle>録音</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* マイク選択 */}
        {state === 'idle' && availableDevices.length > 0 && (
          <Select
            value={selectedDeviceId || ''}
            onValueChange={setSelectedDevice}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 flex-shrink-0" />
                <SelectValue placeholder="マイクを選択" className="truncate" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {availableDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  <span className="truncate">{device.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {uploadState === 'success' && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                録音が完了しました
              </p>
            </div>
          </div>
        )}

        {uploadState === 'uploading' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                アップロード中...
              </p>
            </div>
          </div>
        )}

        {uploadState === 'idle' && (
          <>
            {/* 録音中の表示 */}
            {state === 'recording' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      録音中...
                    </p>
                    <p className="text-2xl font-mono font-bold text-red-900 dark:text-red-100">
                      {formatDuration(duration)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 録音完了の表示 */}
            {state === 'stopped' && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      録音完了
                    </p>
                    <p className="text-2xl font-mono font-bold text-green-900 dark:text-green-100">
                      {formatDuration(duration)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ボタン */}
            <div className="flex gap-2">
              {(state === 'idle' || state === 'stopped') && (
                <Button
                  onClick={handleStartRecording}
                  size="default"
                  className="flex-1"
                >
                  <Mic className="mr-2 h-4 w-4" />
                  {state === 'stopped' ? '再録音' : '録音開始'}
                </Button>
              )}

              {state === 'recording' && (
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  size="default"
                  className="flex-1"
                >
                  <Square className="mr-2 h-4 w-4" />
                  録音停止
                </Button>
              )}

              {state === 'stopped' && (
                <Button
                  onClick={handleUpload}
                  size="default"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Send className="mr-2 h-4 w-4" />
                  アップロード
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
