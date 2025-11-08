"use client";

import React, { useState, useEffect } from "react";
import { Recording } from "@/lib/types";

// setSinkIdの型定義（実験的API）
interface HTMLAudioElementWithSinkId extends HTMLAudioElement {
  setSinkId(deviceId: string): Promise<void>;
}
import {
  getRecordingUrl,
  deleteRecording,
  reorderPlaylistRecordings,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Square,
  Trash2,
  Loader2,
  FileText,
  GripVertical,
  RefreshCcw,
  Upload,
  Speaker,
  Volume2,
} from "lucide-react";
import VolumeAnalyzerModal from "@/components/audio/VolumeAnalyzerModal";
import TranscriptionModal from "@/components/audio/TranscriptionModal";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface RecordingListProps {
  recordings?: Recording[];
  onUpdate?: () => void | Promise<void>;
  playlistId?: string; // プレイリストID（指定時のみドラッグ&ドロップ有効）
  onUploadRequest?: () => void; // アップロードモーダルを開くコールバック
  onRecordingDeleted?: (recordingId: string) => void; // 削除完了時のコールバック
  onRecordingReordered?: (newRecordings: Recording[]) => void; // 並び替え完了時のコールバック
  onAnalysisComplete?: () => void | Promise<void>; // 音量最適化完了時のコールバック
  onTranscriptionComplete?: () => void | Promise<void>; // 文字起こし完了時のコールバック
}

// ヘルパー関数
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "不明";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// SortableRowコンポーネントのProps型定義
interface SortableRowProps {
  recording: Recording;
  isDragEnabled: boolean;
  playingId: string | null;
  deletingId: string | null;
  handlePlay: (id: string, filePath: string) => void;
  openDeleteDialog: (id: string, filePath: string) => void;
}

// ドラッグ可能なテーブル行コンポーネント
const SortableRow = React.memo(function SortableRow({
  recording,
  isDragEnabled,
  playingId,
  deletingId,
  handlePlay,
  openDeleteDialog,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: recording.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      {isDragEnabled && (
        <TableCell className="w-10">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </button>
        </TableCell>
      )}
      <TableCell className="whitespace-nowrap">
        {formatDate(recording.created_at)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formatDuration(recording.duration)}
      </TableCell>
      <TableCell>
        {recording.transcription ? (
          <div className="max-w-md">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-sm line-clamp-2 cursor-help">
                    {recording.transcription}
                  </p>
                </TooltipTrigger>
                <TooltipContent className="max-w-md whitespace-pre-wrap">
                  <p className="text-sm">{recording.transcription}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          <span className="text-muted-foreground italic text-sm">なし</span>
        )}
      </TableCell>
      <TableCell className="text-right space-x-2">
        <Button
          onClick={() => handlePlay(recording.id, recording.file_path)}
          variant={playingId === recording.id ? "destructive" : "default"}
          size="sm"
        >
          {playingId === recording.id ? (
            <>
              <Square className="mr-1 h-3 w-3" />
              停止
            </>
          ) : (
            <>
              <Play className="mr-1 h-3 w-3" />
              再生
            </>
          )}
        </Button>
        <Button
          onClick={() => openDeleteDialog(recording.id, recording.file_path)}
          disabled={deletingId === recording.id}
          variant="destructive"
          size="sm"
        >
          {deletingId === recording.id ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              削除中...
            </>
          ) : (
            <>
              <Trash2 className="mr-1 h-3 w-3" />
              削除
            </>
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
});

export default function RecordingList({
  recordings = [],
  onUpdate,
  playlistId,
  onUploadRequest,
  onRecordingDeleted,
  onRecordingReordered,
  onAnalysisComplete,
  onTranscriptionComplete,
}: RecordingListProps = {}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<{
    id: string;
    filePath: string;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [volumeAnalyzerOpen, setVolumeAnalyzerOpen] = useState(false);
  const [transcriptionModalOpen, setTranscriptionModalOpen] = useState(false);

  // 音声デバイス選択用のstate
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [currentAudioDevice, setCurrentAudioDevice] = useState<string | null>(
    null
  );
  const [hasInitializedDevices, setHasInitializedDevices] = useState(false);

  // ドラッグ&ドロップのセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ドラッグ&ドロップが有効かどうか
  const isDragEnabled = !!playlistId;

  // 初期化時にデバイス一覧を取得（既定のデバイスを除外）
  useEffect(() => {
    async function initAudioDevices() {
      if (
        !hasInitializedDevices &&
        "mediaDevices" in navigator &&
        "enumerateDevices" in navigator.mediaDevices
      ) {
        try {
          setHasInitializedDevices(true);
          const devices = await navigator.mediaDevices.enumerateDevices();
          // 既定のデバイス（default）を除外し、実際のデバイスのみを取得
          const audioOutputs = devices.filter(
            (device) =>
              device.kind === "audiooutput" &&
              device.deviceId !== "default" &&
              device.deviceId !== ""
          );
          if (audioOutputs.length > 0) {
            setAudioDevices(audioOutputs);
            setShowDeviceList(true);

            // localStorageから保存されたデバイスを復元
            const savedDeviceId = localStorage.getItem(
              "recordingListAudioDeviceId"
            );
            // 既定のデバイスIDだった場合はクリア（状態不整合を防ぐため）
            if (savedDeviceId === "default" || savedDeviceId === "") {
              localStorage.removeItem("recordingListAudioDeviceId");
            } else if (
              savedDeviceId &&
              audioOutputs.some((d) => d.deviceId === savedDeviceId)
            ) {
              setCurrentAudioDevice(savedDeviceId);
            }
          }
        } catch (error) {
          console.error("デバイス一覧の取得に失敗:", error);
        }
      }
    }
    initAudioDevices();
  }, [hasInitializedDevices]);

  useEffect(() => {
    // クリーンアップ
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = "";
      }
    };
  }, [audioElement]);

  function openDeleteDialog(id: string, filePath: string) {
    setSelectedRecording({ id, filePath });
    setDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!selectedRecording) return;

    try {
      setDeletingId(selectedRecording.id);
      await deleteRecording(selectedRecording.id, selectedRecording.filePath);

      // 削除した録音が再生中だった場合は停止
      if (playingId === selectedRecording.id && audioElement) {
        audioElement.pause();
        audioElement.src = "";
        setPlayingId(null);
      }

      setDeleteDialogOpen(false);

      // 親コンポーネントに削除を通知（ページ全体のリフレッシュを避ける）
      // これによりループ再生側でも削除を検出できる
      onRecordingDeleted?.(selectedRecording.id);
    } catch (err) {
      console.error("削除エラー:", err);
      alert("削除に失敗しました");
    } finally {
      setDeletingId(null);
      setSelectedRecording(null);
    }
  }

  async function handlePlay(id: string, filePath: string) {
    // 既に再生中の場合は停止
    if (playingId === id && audioElement) {
      audioElement.pause();
      audioElement.src = "";
      setPlayingId(null);
      return;
    }

    // 別の音声を再生中の場合は停止
    if (audioElement) {
      audioElement.pause();
    }

    // 新しい音声を再生
    const url = getRecordingUrl(filePath);
    const audio = new Audio(url);

    // 音声出力デバイスを設定（既定デバイスは除外）
    if (currentAudioDevice && "setSinkId" in audio) {
      try {
        await (audio as HTMLAudioElementWithSinkId).setSinkId(
          currentAudioDevice
        );
      } catch (err) {
        console.error("デバイス設定エラー:", err);
      }
    }

    audio.onended = () => {
      setPlayingId(null);
    };

    // 再生を試みる（onerrorは設定しない）
    audio.play().catch((err) => {
      console.error("再生開始エラー:", err);
      // play()のPromiseが失敗した場合のみアラートを表示
      alert("再生に失敗しました");
      setPlayingId(null);
    });

    setAudioElement(audio);
    setPlayingId(id);
  }

  async function handleDeviceSelect(deviceId: string) {
    // 既定のデバイスIDは設定しない（状態不整合を防ぐため）
    if (deviceId === "default" || deviceId === "") {
      console.warn("既定のデバイスIDは設定できません");
      return;
    }

    setCurrentAudioDevice(deviceId);
    localStorage.setItem("recordingListAudioDeviceId", deviceId);

    // 再生中の音声がある場合はデバイスを変更
    if (audioElement && "setSinkId" in audioElement) {
      try {
        await (audioElement as HTMLAudioElementWithSinkId).setSinkId(deviceId);
      } catch (err) {
        console.error("デバイス変更エラー:", err);
      }
    }
  }

  async function handleRefresh() {
    if (!playlistId) return;

    try {
      setIsRefreshing(true);
      // 親コンポーネントに通知して、propsのrecordingsを更新
      if (onUpdate) {
        await onUpdate();
      }
    } catch (err) {
      console.error("再読み込みエラー:", err);
      alert("録音一覧の再読み込みに失敗しました");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleVolumeAnalysisComplete() {
    // 音量最適化が完了したら、親コンポーネントに通知
    // これによりループ再生側でもLUFS値の更新を検出できる
    // handleRefreshは呼ばない（ページリロードでループ再生が途切れるため）
    onAnalysisComplete?.();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id || !playlistId) {
      return;
    }

    const oldIndex = recordings.findIndex((r) => r.id === active.id);
    const newIndex = recordings.findIndex((r) => r.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // 新しい順序を計算
    const newRecordings = arrayMove(recordings, oldIndex, newIndex);

    // 親コンポーネントに並び替えを通知（楽観的更新）
    // これによりループ再生側でも並び替えを検出できる
    onRecordingReordered?.(newRecordings);

    try {
      // バックエンドに順番を保存
      const recordingIds = newRecordings.map((r) => r.id);
      await reorderPlaylistRecordings(playlistId, recordingIds);
    } catch (err) {
      console.error("並び替えエラー:", err);
      alert("並び替えに失敗しました");
      // エラー時はDBから最新データを取得してロールバック
      if (onUpdate) {
        await onUpdate();
      }
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <CardTitle>録音一覧（{recordings.length}件）</CardTitle>
          <div className="flex gap-2 flex-wrap">
            {playlistId && (
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    読み込み中...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    再読み込み
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => setVolumeAnalyzerOpen(true)}
              variant="outline"
              size="sm"
            >
              <Volume2 className="mr-2 h-4 w-4" />
              音量最適化
              {recordings.filter((r) => r.lufs == null).length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                  {recordings.filter((r) => r.lufs == null).length}
                </span>
              )}
            </Button>
            <Button
              onClick={() => setTranscriptionModalOpen(true)}
              variant="outline"
              size="sm"
            >
              <FileText className="mr-2 h-4 w-4" />
              文字起こし
              {recordings.filter((r) => !r.transcription || r.transcription.trim() === '').length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                  {recordings.filter((r) => !r.transcription || r.transcription.trim() === '').length}
                </span>
              )}
            </Button>
            {onUploadRequest && (
              <Button onClick={onUploadRequest} variant="default" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                音声をアップロード
              </Button>
            )}
            {showDeviceList && audioDevices.length > 0 && (
              <Select
                value={currentAudioDevice || undefined}
                onValueChange={handleDeviceSelect}
              >
                <SelectTrigger className="w-[200px]">
                  <Speaker className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="再生デバイスを選択" />
                </SelectTrigger>
                <SelectContent>
                  {audioDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label ||
                        `デバイス ${device.deviceId.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recordings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            録音データがありません
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isDragEnabled && <TableHead className="w-10"></TableHead>}
                    <TableHead>作成日時</TableHead>
                    <TableHead>再生時間</TableHead>
                    <TableHead>文字起こし</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <SortableContext
                  items={recordings.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <TableBody>
                    {recordings.map((recording) => (
                      <SortableRow
                        key={recording.id}
                        recording={recording}
                        isDragEnabled={isDragEnabled}
                        playingId={playingId}
                        deletingId={deletingId}
                        handlePlay={handlePlay}
                        openDeleteDialog={openDeleteDialog}
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </Table>
            </div>
          </DndContext>
        )}
      </CardContent>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>録音を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この録音を削除してもよろしいですか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 音量最適化モーダル */}
      <VolumeAnalyzerModal
        recordings={recordings}
        open={volumeAnalyzerOpen}
        onOpenChange={setVolumeAnalyzerOpen}
        onAnalysisComplete={handleVolumeAnalysisComplete}
      />

      {/* 文字起こしモーダル */}
      <TranscriptionModal
        recordings={recordings}
        open={transcriptionModalOpen}
        onOpenChange={setTranscriptionModalOpen}
        onTranscriptionComplete={onTranscriptionComplete}
      />
    </Card>
  );
}
