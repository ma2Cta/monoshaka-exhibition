'use client';

import { useState, useEffect } from 'react';
import { Recording } from '@/lib/types';
import { getRecordingUrl, deleteRecording } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Play, Square, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface RecordingListProps {
  recordings?: Recording[];
  onUpdate?: () => void | Promise<void>;
}

export default function RecordingList({ recordings: propRecordings, onUpdate }: RecordingListProps = {}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [expandedTranscription, setExpandedTranscription] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<{ id: string; filePath: string } | null>(null);

  const recordings = propRecordings || [];

  useEffect(() => {
    // クリーンアップ
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
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
        audioElement.src = '';
        setPlayingId(null);
      }

      setDeleteDialogOpen(false);

      // 更新コールバックがあれば呼び出す
      if (onUpdate) {
        await onUpdate();
      }
    } catch (err) {
      console.error('削除エラー:', err);
    } finally {
      setDeletingId(null);
      setSelectedRecording(null);
    }
  }

  async function confirmDeleteAll() {
    try {
      // すべての録音を削除
      for (const recording of recordings) {
        await deleteRecording(recording.id, recording.file_path);
      }

      // 再生中の音声を停止
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
      setPlayingId(null);

      setDeleteAllDialogOpen(false);

      // 更新コールバックがあれば呼び出す
      if (onUpdate) {
        await onUpdate();
      }
    } catch (err) {
      console.error('削除エラー:', err);
      // 更新コールバックがあれば呼び出す
      if (onUpdate) {
        await onUpdate();
      }
    }
  }

  function handlePlay(id: string, filePath: string) {
    // 既に再生中の場合は停止
    if (playingId === id && audioElement) {
      audioElement.pause();
      audioElement.src = '';
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

    audio.onended = () => {
      setPlayingId(null);
    };

    // 再生を試みる（onerrorは設定しない）
    audio.play().catch((err) => {
      console.error('再生開始エラー:', err);
      // play()のPromiseが失敗した場合のみアラートを表示
      alert('再生に失敗しました');
      setPlayingId(null);
    });

    setAudioElement(audio);
    setPlayingId(id);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function formatDuration(seconds: number | null) {
    if (seconds === null) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>録音一覧（{recordings.length}件）</CardTitle>
          {recordings.length > 0 && (
            <Button
              onClick={() => setDeleteAllDialogOpen(true)}
              variant="destructive"
              size="sm"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              すべて削除
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {recordings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            録音データがありません
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>作成日時</TableHead>
                  <TableHead>再生時間</TableHead>
                  <TableHead>文字起こし</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordings.map((recording) => (
                  <TableRow key={recording.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(recording.created_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDuration(recording.duration)}
                    </TableCell>
                    <TableCell>
                      {recording.transcription ? (
                        <div className="max-w-md">
                          <p className={`text-sm ${expandedTranscription === recording.id ? '' : 'line-clamp-2'}`}>
                            {recording.transcription}
                          </p>
                          {recording.transcription.length > 100 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedTranscription(
                                expandedTranscription === recording.id ? null : recording.id
                              )}
                              className="h-auto p-0 mt-1 text-xs cursor-pointer"
                            >
                              {expandedTranscription === recording.id ? (
                                <>
                                  <ChevronUp className="mr-1 h-3 w-3" />
                                  閉じる
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="mr-1 h-3 w-3" />
                                  もっと見る
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">なし</span>
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
                ))}
              </TableBody>
            </Table>
          </div>
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
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* すべて削除確認ダイアログ */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>すべての録音を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              すべての録音（{recordings.length}件）を削除してもよろしいですか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAll} className="bg-destructive hover:bg-destructive/90">
              すべて削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
