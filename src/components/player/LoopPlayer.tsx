'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePlayer } from '@/hooks/usePlayer';
import { getPlaylists, getActivePlaylist } from '@/lib/supabase';
import { Playlist, Recording } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Play, Pause, Mic, CalendarDays, Clock, Speaker } from 'lucide-react';

// 録音情報コンポーネント（プレースホルダー付き）
const RecordingInfo = ({ recording }: { recording: Recording | null }) => {
  const formattedDate = useMemo(() => {
    if (!recording) return '---';
    return new Date(recording.created_at).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [recording]);

  const duration = recording?.duration ? `${Math.floor(recording.duration)}秒` : '--秒';

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">録音時間</p>
            </div>
            <p className="text-2xl font-bold min-h-[2rem]">
              {duration}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">録音日時</p>
            </div>
            <p className="text-xl font-semibold min-h-[1.75rem]">
              {formattedDate}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function LoopPlayer() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | undefined>(undefined);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [selectedDeviceName, setSelectedDeviceName] = useState<string>('デフォルト');

  const {
    recordings,
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
  } = usePlayer({ playlistId: selectedPlaylistId });

  // プレイリスト一覧を取得し、有効なプレイリストを初期選択
  useEffect(() => {
    loadPlaylists();
  }, []);

  async function loadPlaylists() {
    try {
      setIsLoadingPlaylists(true);
      const [allPlaylists, activePlaylist] = await Promise.all([
        getPlaylists(),
        getActivePlaylist(),
      ]);
      setPlaylists(allPlaylists);

      // 有効なプレイリストがあればそれを選択、なければ最初のプレイリスト
      if (activePlaylist) {
        setSelectedPlaylistId(activePlaylist.id);
      } else if (allPlaylists.length > 0) {
        setSelectedPlaylistId(allPlaylists[0].id);
      }
    } catch (err) {
      console.error('プレイリストの取得に失敗:', err);
    } finally {
      setIsLoadingPlaylists(false);
    }
  }

  function handlePlaylistChange(playlistId: string) {
    // プレイリストが変更されたら再生をリセット
    resetPlayback();
    setSelectedPlaylistId(playlistId);
  }

  // 初回マウント時に保存されたデバイス名を復元
  useEffect(() => {
    const savedDeviceName = localStorage.getItem('audioOutputDeviceName');
    if (savedDeviceName) {
      setSelectedDeviceName(savedDeviceName);
    }
  }, []);

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
      const deviceName = device.label || `デバイス ${device.deviceId.substring(0, 8)}...`;
      setSelectedDeviceName(deviceName);
      localStorage.setItem('audioOutputDeviceName', deviceName);
    }
    setShowDeviceList(false);
  }

  // コンポーネントのアンマウント時に再生を停止
  useEffect(() => {
    return () => {
      console.log('LoopPlayerコンポーネントがアンマウントされました。再生を停止します。');
      resetPlayback();
    };
  }, [resetPlayback]);

  // 波形アニメーションの高さを固定（初回のみ生成）
  const waveHeights = useMemo(() => {
    return Array.from({ length: 20 }, () => Math.random() * 80 + 20);
  }, []);

  const waveAnimationDurations = useMemo(() => {
    return Array.from({ length: 20 }, () => Math.random() * 0.5 + 0.5);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        {/* プレイリスト選択UI */}
        {!isLoadingPlaylists && playlists.length > 0 && (
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-center gap-4">
              <label htmlFor="playlist-select" className="text-foreground text-lg font-semibold">
                プレイリスト:
              </label>
              <Select
                value={selectedPlaylistId || ''}
                onValueChange={handlePlaylistChange}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="プレイリストを選択" />
                </SelectTrigger>
                <SelectContent>
                  {playlists.map((playlist) => (
                    <SelectItem key={playlist.id} value={playlist.id}>
                      {playlist.name} {playlist.is_active && '(有効)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 音声出力デバイス選択ボタン */}
            <div className="flex flex-col items-center justify-center gap-2">
              <Button
                onClick={handleSelectAudioOutput}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!audioOutputSupported}
                title={audioOutputSupported ? '音声出力デバイスを選択' : 'このブラウザではサポートされていません'}
              >
                <Speaker className="h-4 w-4" />
                音声出力デバイスを選択
                {!audioOutputSupported && ' (未サポート)'}
              </Button>
              {audioOutputSupported && currentAudioDevice && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Speaker className="h-3 w-3" />
                  <span>選択中: {selectedDeviceName}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* デバイス選択ダイアログ */}
        {showDeviceList && audioDevices.length > 0 && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
            <Card className="w-full max-w-md mx-4">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">音声出力デバイスを選択</h3>
                <div className="space-y-2">
                  {audioDevices.map((device) => (
                    <Button
                      key={device.deviceId}
                      onClick={() => handleDeviceSelect(device.deviceId)}
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Speaker className="mr-2 h-4 w-4" />
                      {device.label || `デバイス ${device.deviceId.substring(0, 8)}...`}
                    </Button>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => setShowDeviceList(false)}
                    variant="ghost"
                    size="sm"
                  >
                    キャンセル
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* エラーメッセージ */}
        {error && (
          <Alert className="mb-8" variant="destructive">
            <AlertDescription className="text-lg font-semibold text-center">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* メインコンテンツ */}
        <Card>
          <CardContent className="pt-6">

          {/* 再生開始ボタン */}
          {needsUserInteraction && totalCount > 0 && (
            <div className="text-center py-16">
              <Button
                onClick={startPlayback}
                size="lg"
                className="px-12 py-6 text-xl"
              >
                <Play className="mr-3 h-6 w-6" />
                再生開始
              </Button>
              <p className="text-muted-foreground mt-4">
                {totalCount}件の録音があります
              </p>
            </div>
          )}

          {/* 録音がない場合 */}
          {totalCount === 0 && (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                <Mic className="w-12 h-12 text-muted-foreground" />
              </div>
              <p className="text-2xl text-muted-foreground font-semibold">
                まだ録音がありません
              </p>
              <p className="text-lg text-muted-foreground mt-2">
                録音が追加されると自動的に再生されます
              </p>
            </div>
          )}

          {/* 再生情報 */}
          {totalCount > 0 && !needsUserInteraction && (
            <div className="space-y-8">
              {/* 再生状態インジケーター */}
              <div className="flex items-center justify-center gap-4">
                <Badge
                  variant={isPlaying ? "default" : "secondary"}
                  className={`text-lg px-4 py-2 ${isPlaying ? 'animate-pulse' : ''}`}
                >
                  {isPlaying ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                  {isPlaying ? '再生中' : '一時停止中'}
                </Badge>
              </div>

              {/* 現在の再生位置 */}
              <div className="text-center">
                <p className="text-8xl font-bold mb-4 transition-all duration-300">
                  {currentIndex + 1}
                  <span className="text-5xl text-muted-foreground"> / {totalCount}</span>
                </p>
                <p className="text-xl text-muted-foreground">
                  録音番号 / 総録音数
                </p>
              </div>

              {/* プログレスバー */}
              <Progress
                value={((currentIndex + 1) / totalCount) * 100}
                className="h-3"
              />

              {/* 録音情報（常に表示） */}
              <RecordingInfo recording={recordings[currentIndex] || null} />

              {/* 波形アニメーション（常に表示、再生中のみ動く） */}
              <div className="flex items-center justify-center gap-2 h-24">
                {waveHeights.map((height, i) => (
                  <div
                    key={i}
                    className={`w-2 bg-primary rounded-full ${isPlaying ? 'animate-pulse' : ''}`}
                    style={{
                      height: `${height}%`,
                      animationDelay: `${i * 0.05}s`,
                      animationDuration: `${waveAnimationDurations[i]}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          </CardContent>
        </Card>

        {/* フッター */}
        <div className="text-center mt-8">
          <p className="text-muted-foreground text-sm">
            画面を閉じるまで自動的にループ再生されます
          </p>
        </div>
      </div>
    </div>
  );
}
