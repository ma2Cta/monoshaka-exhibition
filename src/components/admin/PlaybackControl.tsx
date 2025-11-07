'use client';

import { useState, useEffect } from 'react';
import { usePlayer } from '@/hooks/usePlayer';
import { getPlaylistRecordings } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, Pause, Speaker } from 'lucide-react';
import { CompactVisualizer } from '@/components/player/CompactVisualizer';

interface PlaybackControlProps {
  playlistId: string;
  recordingCount?: number;
}

/**
 * プレイリストの自動ループ再生をコントロールするコンポーネント
 * デバイス選択、再生/停止、進捗表示、ビジュアライザーを含む
 */
export function PlaybackControl({ playlistId, recordingCount = 0 }: PlaybackControlProps) {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [selectedDeviceName, setSelectedDeviceName] = useState<string>('デフォルト');
  const [actualRecordingCount, setActualRecordingCount] = useState<number>(recordingCount);
  const [hasInitializedDevices, setHasInitializedDevices] = useState(false);

  const {
    currentIndex,
    isPlaying,
    error,
    totalCount,
    startPlayback,
    needsUserInteraction,
    resetPlayback,
    selectAudioOutput,
    setOutputDevice,
    currentAudioDevice,
    audioOutputSupported
  } = usePlayer({ playlistId });

  // プレイリストの録音数を取得
  useEffect(() => {
    async function fetchRecordingCount() {
      try {
        const recordings = await getPlaylistRecordings(playlistId);
        setActualRecordingCount(recordings.length);
      } catch (error) {
        console.error('録音数の取得に失敗:', error);
      }
    }
    fetchRecordingCount();
  }, [playlistId]);

  // recordingCount propsが変更されたら更新
  useEffect(() => {
    setActualRecordingCount(recordingCount);
  }, [recordingCount]);

  // 初回マウント時に保存されたデバイス名を復元
  useEffect(() => {
    const savedDeviceName = localStorage.getItem('audioOutputDeviceName');
    if (savedDeviceName) {
      setSelectedDeviceName(savedDeviceName);
    }
  }, []);

  // 初期化時にデバイス一覧を自動取得
  useEffect(() => {
    if (audioOutputSupported && !showDeviceList && !hasInitializedDevices) {
      setHasInitializedDevices(true);
      selectAudioOutput();
    }
  }, [audioOutputSupported, showDeviceList, hasInitializedDevices, selectAudioOutput]);

  // カスタムイベントでデバイス一覧を受け取る
  useEffect(() => {
    const handleDeviceList = (event: Event) => {
      const customEvent = event as CustomEvent<MediaDeviceInfo[]>;
      setAudioDevices(customEvent.detail);
      setShowDeviceList(true);
    };

    const handleDeviceSelected = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setSelectedDeviceName(customEvent.detail);
    };

    window.addEventListener('audioOutputDeviceListAvailable', handleDeviceList);
    window.addEventListener('audioOutputDeviceSelected', handleDeviceSelected);

    return () => {
      window.removeEventListener('audioOutputDeviceListAvailable', handleDeviceList);
      window.removeEventListener('audioOutputDeviceSelected', handleDeviceSelected);
    };
  }, []);

  async function handleSelectAudioOutput() {
    await selectAudioOutput();
  }

  async function handleDeviceSelect(deviceId: string) {
    await setOutputDevice(deviceId);
    // 選択されたデバイス名を保存
    const device = audioDevices.find(d => d.deviceId === deviceId);
    if (device) {
      const deviceName = device.label || 'デフォルト';
      setSelectedDeviceName(deviceName);
      localStorage.setItem('audioOutputDeviceName', deviceName);
    }
  }

  function handlePlayPause() {
    if (needsUserInteraction) {
      startPlayback();
    } else {
      // すでに再生が開始されている場合は停止（リセット）
      resetPlayback();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Speaker className="h-5 w-5" />
            <span>ループ再生</span>
            {isPlaying && (
              <Badge variant="default">再生中</Badge>
            )}
            {!isPlaying && actualRecordingCount > 0 && !needsUserInteraction && (
              <Badge variant="secondary">一時停止中</Badge>
            )}
          </div>
          {/* デバイス選択 */}
          {showDeviceList ? (
            <Select
              value={currentAudioDevice || 'default'}
              onValueChange={handleDeviceSelect}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="デバイスを選択" />
              </SelectTrigger>
              <SelectContent>
                {audioDevices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `デバイス ${device.deviceId.slice(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 再生コントロール */}
        <div className="flex items-center gap-4">
          <Button
            size="lg"
            onClick={handlePlayPause}
            disabled={actualRecordingCount === 0}
            className="flex-shrink-0"
          >
            {isPlaying ? (
              <>
                <Pause className="h-5 w-5 mr-2" />
                停止
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                {needsUserInteraction ? '再生開始' : '再開'}
              </>
            )}
          </Button>

          {/* 再生位置 */}
          {totalCount > 0 && (
            <div className="text-sm font-medium">
              {currentIndex + 1} / {totalCount}
            </div>
          )}

          {/* ビジュアライザー */}
          <div className="ml-auto">
            <CompactVisualizer isPlaying={isPlaying} />
          </div>
        </div>

        {/* プログレスバー */}
        {totalCount > 0 && (
          <Progress
            value={((currentIndex + 1) / totalCount) * 100}
            className="h-2"
          />
        )}

        {/* 録音がない場合のメッセージ */}
        {actualRecordingCount === 0 && (
          <Alert>
            <AlertDescription>
              このプレイリストには録音がありません。音声をアップロードしてください。
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
