"use client";

import { useState, useEffect } from "react";
import { usePlayer } from "@/hooks/usePlayer";
import { getPlaylistRecordings } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Play, Pause, Speaker } from "lucide-react";
import { Visualizer } from "./Visualizer";
import type { Recording } from "@/lib/types";

interface PlaybackControlProps {
  playlistId: string;
  recordingCount?: number;
  recordings?: Recording[];
}

/**
 * プレイリストの自動ループ再生をコントロールするコンポーネント
 * デバイス選択、再生/停止、進捗表示、ビジュアライザーを含む
 */
export function PlaybackControl({
  playlistId,
  recordingCount = 0,
  recordings,
}: PlaybackControlProps) {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [, setSelectedDeviceName] = useState<string>("デフォルト");
  const [actualRecordingCount, setActualRecordingCount] =
    useState<number>(recordingCount);
  const [hasInitializedDevices, setHasInitializedDevices] = useState(false);

  const {
    currentIndex,
    isPlaying,
    error,
    totalCount,
    startPlayback,
    needsUserInteraction,
    pausePlayback,
    selectAudioOutput,
    setOutputDevice,
    currentAudioDevice,
    audioOutputSupported,
  } = usePlayer({ playlistId, recordings });

  // 外部recordingsが渡されていない場合のみ録音数を取得
  useEffect(() => {
    async function fetchRecordingCount() {
      // 外部recordingsがある場合は取得不要
      if (recordings) {
        return;
      }

      try {
        const recordingsData = await getPlaylistRecordings(playlistId);
        setActualRecordingCount(recordingsData.length);
      } catch (error) {
        console.error("録音数の取得に失敗:", error);
      }
    }
    fetchRecordingCount();
  }, [playlistId, recordings]);

  // recordingCount propsまたは外部recordingsが変更されたら更新
  useEffect(() => {
    if (recordings) {
      setActualRecordingCount(recordings.length);
    } else {
      setActualRecordingCount(recordingCount);
    }
  }, [recordingCount, recordings]);

  // 初期化時にデバイス一覧を自動取得
  useEffect(() => {
    if (audioOutputSupported && !showDeviceList && !hasInitializedDevices) {
      setHasInitializedDevices(true);
      selectAudioOutput();
    }
  }, [
    audioOutputSupported,
    showDeviceList,
    hasInitializedDevices,
    selectAudioOutput,
  ]);

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

    window.addEventListener("audioOutputDeviceListAvailable", handleDeviceList);
    window.addEventListener("audioOutputDeviceSelected", handleDeviceSelected);

    return () => {
      window.removeEventListener(
        "audioOutputDeviceListAvailable",
        handleDeviceList
      );
      window.removeEventListener(
        "audioOutputDeviceSelected",
        handleDeviceSelected
      );
    };
  }, []);

  // デバイスリストが取得されたら、一番上のデバイスを自動選択
  useEffect(() => {
    if (audioDevices.length > 0 && !currentAudioDevice) {
      const firstDevice = audioDevices[0];
      handleDeviceSelect(firstDevice.deviceId);
    }
    // handleDeviceSelectは関数宣言で定義されているため、再レンダリングで変わらない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioDevices, currentAudioDevice]);

  async function handleDeviceSelect(deviceId: string) {
    await setOutputDevice(deviceId);

    // 選択されたデバイス名を設定
    const device = audioDevices.find((d) => d.deviceId === deviceId);
    if (device) {
      const deviceName = device.label || "デフォルト";
      setSelectedDeviceName(deviceName);
    } else {
      console.warn("PlaybackControl: デバイスが見つかりません:", deviceId);
    }
  }

  function handlePlayPause() {
    if (isPlaying) {
      // 再生中の場合は一時停止
      pausePlayback();
    } else {
      // 停止中の場合は再生開始または再開
      startPlayback();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span>ループ再生</span>
            {isPlaying && <Badge variant="default">再生中</Badge>}
            {!isPlaying &&
              actualRecordingCount > 0 &&
              !needsUserInteraction && (
                <Badge variant="secondary">一時停止中</Badge>
              )}
          </div>
          {/* デバイス選択 */}
          {showDeviceList && audioDevices.length > 0 ? (
            <Select
              value={currentAudioDevice || undefined}
              onValueChange={handleDeviceSelect}
            >
              <SelectTrigger className="w-[200px]">
                <Speaker className="h-4 w-4 mr-2" />
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
                一時停止
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                {needsUserInteraction ? "再生開始" : "再開"}
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
            <Visualizer isPlaying={isPlaying} />
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
