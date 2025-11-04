'use client';

import { useState, useEffect } from 'react';
import { Recording } from '@/lib/types';
import { getRecordingUrl, deleteRecording, updateRecordingTranscription } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Play, Square, Trash2, Loader2, FileText, Edit, Save, X } from 'lucide-react';

interface RecordingListProps {
  recordings?: Recording[];
  onUpdate?: () => void | Promise<void>;
}

export default function RecordingList({ recordings: propRecordings, onUpdate }: RecordingListProps = {}) {
  const [recordings, setRecordings] = useState<Recording[]>(propRecordings || []);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<{ id: string; filePath: string } | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [editingTranscriptionId, setEditingTranscriptionId] = useState<string | null>(null);
  const [editingTranscriptionText, setEditingTranscriptionText] = useState('');
  const [savingTranscriptionId, setSavingTranscriptionId] = useState<string | null>(null);

  // propRecordingsが変更されたら内部stateを更新
  useEffect(() => {
    setRecordings(propRecordings || []);
  }, [propRecordings]);

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

  async function handleTranscribe(id: string, filePath: string, isRegenerate: boolean = false) {
    try {
      setTranscribingId(id);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordingId: id,
          filePath,
          skipSave: isRegenerate // 編集モード時の再生成はDB保存をスキップ
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '文字起こしに失敗しました');
      }

      if (isRegenerate && editingTranscriptionId === id) {
        // 編集モード時の再生成: テキストエリアだけを更新（DBもローカルstateも更新しない）
        setEditingTranscriptionText(data.transcription);
      } else {
        // 初回生成: ローカルのrecordings stateを更新（DBには既に保存済み）
        setRecordings((prevRecordings) =>
          prevRecordings.map((recording) =>
            recording.id === id
              ? { ...recording, transcription: data.transcription }
              : recording
          )
        );
      }
    } catch (err) {
      console.error('文字起こしエラー:', err);
      const errorMessage = err instanceof Error ? err.message : '不明なエラー';
      alert(`文字起こしに失敗しました: ${errorMessage}`);
    } finally {
      setTranscribingId(null);
    }
  }

  function handleEditTranscription(id: string, currentText: string) {
    setEditingTranscriptionId(id);
    setEditingTranscriptionText(currentText);
  }

  function handleCancelEdit() {
    setEditingTranscriptionId(null);
    setEditingTranscriptionText('');
  }

  async function handleSaveTranscription(id: string) {
    try {
      setSavingTranscriptionId(id);
      await updateRecordingTranscription(id, editingTranscriptionText);

      // ローカルのrecordings stateを更新
      setRecordings((prevRecordings) =>
        prevRecordings.map((recording) =>
          recording.id === id
            ? { ...recording, transcription: editingTranscriptionText }
            : recording
        )
      );

      setEditingTranscriptionId(null);
      setEditingTranscriptionText('');
    } catch (err) {
      console.error('保存エラー:', err);
      alert('文字起こしの保存に失敗しました');
    } finally {
      setSavingTranscriptionId(null);
    }
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
                      {editingTranscriptionId === recording.id ? (
                        <div className="max-w-md space-y-2">
                          <Textarea
                            value={editingTranscriptionText}
                            onChange={(e) => setEditingTranscriptionText(e.target.value)}
                            className="min-h-[100px]"
                            placeholder="文字起こしを入力..."
                          />
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              onClick={() => handleSaveTranscription(recording.id)}
                              disabled={savingTranscriptionId === recording.id || transcribingId === recording.id}
                              size="sm"
                              variant="default"
                            >
                              {savingTranscriptionId === recording.id ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  保存中...
                                </>
                              ) : (
                                <>
                                  <Save className="mr-1 h-3 w-3" />
                                  保存
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={() => handleTranscribe(recording.id, recording.file_path, true)}
                              disabled={transcribingId === recording.id || savingTranscriptionId === recording.id}
                              size="sm"
                              variant="secondary"
                            >
                              {transcribingId === recording.id ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  生成中...
                                </>
                              ) : (
                                <>
                                  <FileText className="mr-1 h-3 w-3" />
                                  再生成
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={handleCancelEdit}
                              disabled={transcribingId === recording.id || savingTranscriptionId === recording.id}
                              size="sm"
                              variant="outline"
                            >
                              <X className="mr-1 h-3 w-3" />
                              キャンセル
                            </Button>
                          </div>
                        </div>
                      ) : recording.transcription ? (
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
                          <div className="mt-2">
                            <Button
                              onClick={() => handleEditTranscription(recording.id, recording.transcription || '')}
                              size="sm"
                              variant="outline"
                            >
                              <Edit className="mr-1 h-3 w-3" />
                              編集
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="text-muted-foreground italic">なし</span>
                          <div>
                            <Button
                              onClick={() => handleTranscribe(recording.id, recording.file_path)}
                              disabled={transcribingId === recording.id}
                              size="sm"
                              variant="outline"
                            >
                              {transcribingId === recording.id ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  生成中...
                                </>
                              ) : (
                                <>
                                  <FileText className="mr-1 h-3 w-3" />
                                  生成
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
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
