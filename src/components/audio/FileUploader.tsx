'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2, FileAudio, X, CheckCircle2, AlertCircle, Play, Pause, GripVertical } from 'lucide-react';
import { uploadRecording, addRecordingToPlaylist } from '@/lib/supabase';
import type { Recording } from '@/lib/types';
import { analyzeAudioVolume, type VolumeMetadata } from '@/lib/audio-analysis';

interface FileUploaderProps {
  playlistId: string;
  onUploadComplete: (newRecordings: Recording[]) => void;
}

type FileStatus = 'pending' | 'loading_metadata' | 'ready' | 'uploading' | 'completed' | 'error';

interface FileItem {
  file: File;
  id: string;
  status: FileStatus;
  duration: number | null;
  volumeMetadata?: VolumeMetadata;
  error?: string;
  audioUrl?: string;
}

export default function FileUploader({ playlistId, onUploadComplete }: FileUploaderProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setGlobalError('');

    // 新しいファイルを追加
    const newFileItems: FileItem[] = selectedFiles.map((file) => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      status: 'loading_metadata' as FileStatus,
      duration: null,
      audioUrl: URL.createObjectURL(file),
    }));

    setFiles((prev) => [...prev, ...newFileItems]);

    // 各ファイルのメタデータ（長さ）を取得
    for (const fileItem of newFileItems) {
      const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
      if (!allowedTypes.includes(fileItem.file.type) && !fileItem.file.name.match(/\.(webm|wav|mp3|ogg)$/i)) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, status: 'error' as FileStatus, error: '対応していないファイル形式です' }
              : f
          )
        );
        continue;
      }

      try {
        // durationと音量メタデータを並列で取得
        const [duration, volumeMetadata] = await Promise.all([
          getAudioDuration(fileItem.file),
          analyzeAudioVolume(fileItem.file),
        ]);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, status: 'ready' as FileStatus, duration, volumeMetadata }
              : f
          )
        );
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, status: 'error' as FileStatus, error: '音声ファイルの解析に失敗しました' }
              : f
          )
        );
      }
    }

    // input要素をリセット（同じファイルを再度選択できるように）
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);

      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      });

      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('音声ファイルの読み込みに失敗しました'));
      });

      audio.src = url;
    });
  };

  const handleRemoveFile = (id: string) => {
    const fileItem = files.find((f) => f.id === id);
    if (fileItem?.audioUrl) {
      URL.revokeObjectURL(fileItem.audioUrl);
    }
    if (audioRefs.current.has(id)) {
      audioRefs.current.delete(id);
    }
    if (playingId === id) {
      setPlayingId(null);
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUploadAll = async () => {
    const readyFiles = files.filter((f) => f.status === 'ready');
    if (readyFiles.length === 0) {
      setGlobalError('アップロード可能なファイルがありません');
      return;
    }

    setIsUploading(true);
    setGlobalError('');

    let completedCount = 0;
    let errorCount = 0;
    const uploadedRecordings: Recording[] = [];

    // 各ファイルを順次アップロード
    for (const fileItem of readyFiles) {
      try {
        // ステータスを「アップロード中」に更新
        setFiles((prev) =>
          prev.map((f) => (f.id === fileItem.id ? { ...f, status: 'uploading' as FileStatus } : f))
        );

        // 1. ファイルをアップロード
        const recording = await uploadRecording(
          fileItem.file,
          fileItem.duration!,
          undefined,
          playlistId,
          fileItem.volumeMetadata
        );

        // 2. プレイリストに追加
        await addRecordingToPlaylist(playlistId, recording.id);

        // アップロードされたレコーディングを配列に追加
        uploadedRecordings.push(recording);

        // ステータスを「完了」に更新
        setFiles((prev) =>
          prev.map((f) => (f.id === fileItem.id ? { ...f, status: 'completed' as FileStatus } : f))
        );

        completedCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'アップロードに失敗しました';
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id ? { ...f, status: 'error' as FileStatus, error: message } : f
          )
        );
        errorCount++;
      }
    }

    setIsUploading(false);

    // 全て完了したら親コンポーネントに通知（新しいレコーディングを渡す）
    if (completedCount > 0) {
      onUploadComplete(uploadedRecordings);
    }

    // 完了したファイルを自動削除
    setTimeout(() => {
      setFiles((prev) => prev.filter((f) => f.status !== 'completed'));
    }, 2000);

    if (errorCount > 0) {
      setGlobalError(`${errorCount}件のファイルのアップロードに失敗しました`);
    }
  };

  const handleClearAll = () => {
    // すべての音声URLをクリーンアップ
    files.forEach((fileItem) => {
      if (fileItem.audioUrl) {
        URL.revokeObjectURL(fileItem.audioUrl);
      }
    });
    audioRefs.current.clear();
    setPlayingId(null);
    setFiles([]);
    setGlobalError('');
  };

  const handlePlayPause = (id: string) => {
    const audio = audioRefs.current.get(id);
    if (!audio) return;

    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
    } else {
      // 他の再生中の音声を停止
      audioRefs.current.forEach((a, audioId) => {
        if (audioId !== id) {
          a.pause();
        }
      });
      audio.currentTime = 0;
      audio.play();
      setPlayingId(id);
    }
  };

  const handleAudioEnded = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newFiles = [...files];
    const draggedItem = newFiles[draggedIndex];
    newFiles.splice(draggedIndex, 1);
    newFiles.splice(index, 0, draggedItem);

    setFiles(newFiles);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case 'loading_metadata':
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <FileAudio className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (fileItem: FileItem) => {
    switch (fileItem.status) {
      case 'loading_metadata':
        return '読み込み中...';
      case 'ready':
        return '準備完了';
      case 'uploading':
        return 'アップロード中...';
      case 'completed':
        return '完了';
      case 'error':
        return fileItem.error || 'エラー';
      default:
        return '待機中';
    }
  };

  const readyCount = files.filter((f) => f.status === 'ready').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;
  const uploadingCount = files.filter((f) => f.status === 'uploading').length;
  const totalFiles = files.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>音声ファイルをアップロード</CardTitle>
        <CardDescription>
          複数の音声ファイルを一度にこのプレイリストに追加できます
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* グローバルエラー表示 */}
        {globalError && (
          <Alert variant="destructive">
            <AlertDescription>{globalError}</AlertDescription>
          </Alert>
        )}

        {/* ファイル選択 */}
        <div className="space-y-2">
          <Label htmlFor="audio-files">音声ファイル（複数選択可）</Label>
          <Input
            id="audio-files"
            ref={fileInputRef}
            type="file"
            accept="audio/webm,audio/wav,audio/mp3,audio/mpeg,audio/ogg,.webm,.wav,.mp3,.ogg"
            onChange={handleFileSelect}
            disabled={isUploading}
            multiple
          />
          <p className="text-xs text-muted-foreground">
            対応形式: WebM, WAV, MP3, OGG • ドラッグして順序を変更 • 再生ボタンで内容を確認
          </p>
        </div>

        {/* 進捗表示 */}
        {totalFiles > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {completedCount + uploadingCount} / {totalFiles} ファイル
              </span>
              <span className="text-muted-foreground">
                準備完了: {readyCount}件
              </span>
            </div>
            {isUploading && (
              <Progress value={(completedCount / totalFiles) * 100} className="h-2" />
            )}
          </div>
        )}

        {/* ファイルリスト */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {files.map((fileItem, index) => (
              <div
                key={fileItem.id}
                draggable={!isUploading && fileItem.status !== 'uploading' && fileItem.status !== 'completed'}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 bg-muted rounded-md transition-opacity ${
                  draggedIndex === index ? 'opacity-50' : 'opacity-100'
                } ${
                  !isUploading && fileItem.status !== 'uploading' && fileItem.status !== 'completed'
                    ? 'cursor-move'
                    : ''
                }`}
              >
                {/* ドラッグハンドル */}
                {!isUploading && fileItem.status !== 'uploading' && fileItem.status !== 'completed' && (
                  <div className="flex-shrink-0 cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                {/* ステータスアイコン */}
                <div className="flex-shrink-0">{getStatusIcon(fileItem.status)}</div>

                {/* ファイル情報 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(fileItem.file.size)}
                    {fileItem.duration !== null && ` • ${formatDuration(fileItem.duration)}`}
                    {fileItem.volumeMetadata && ` • ${fileItem.volumeMetadata.lufs.toFixed(1)} LUFS`}
                    {' • '}
                    {getStatusText(fileItem)}
                  </p>
                </div>

                {/* 再生ボタン */}
                {fileItem.status === 'ready' && fileItem.audioUrl && (
                  <>
                    <audio
                      ref={(el) => {
                        if (el) audioRefs.current.set(fileItem.id, el);
                      }}
                      src={fileItem.audioUrl}
                      onEnded={() => handleAudioEnded(fileItem.id)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlayPause(fileItem.id)}
                      disabled={isUploading}
                      title={playingId === fileItem.id ? '停止' : '再生'}
                    >
                      {playingId === fileItem.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}

                {/* 削除ボタン */}
                {fileItem.status !== 'uploading' && fileItem.status !== 'completed' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveFile(fileItem.id)}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* アクションボタン */}
        {files.length > 0 && (
          <div className="flex gap-2">
            <Button
              onClick={handleUploadAll}
              disabled={readyCount === 0 || isUploading}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  アップロード中 ({completedCount}/{totalFiles})
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {readyCount}件をアップロード
                </>
              )}
            </Button>
            {!isUploading && (
              <Button type="button" variant="outline" onClick={handleClearAll}>
                クリア
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
