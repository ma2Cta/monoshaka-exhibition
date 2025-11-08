'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Playlist } from '@/lib/types';
import {
  getPlaylists,
  createPlaylist,
  deletePlaylist,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';

interface PlaylistManagerProps {
  basePath?: string;
}

export default function PlaylistManager({ basePath = '' }: PlaylistManagerProps = {}) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<{ id: string; name: string; recordingCount: number } | null>(null);

  useEffect(() => {
    loadPlaylists();
  }, []);

  async function loadPlaylists() {
    try {
      setIsLoading(true);
      setError('');
      const data = await getPlaylists();
      setPlaylists(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'プレイリストの取得に失敗しました';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!newPlaylistName.trim()) {
      return;
    }

    try {
      setIsCreating(true);
      await createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setCreateDialogOpen(false);
      await loadPlaylists();
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setError(`作成に失敗しました: ${message}`);
    } finally {
      setIsCreating(false);
    }
  }

  function openDeleteDialog(id: string, name: string, recordingCount: number) {
    setSelectedPlaylist({ id, name, recordingCount });
    setDeleteDialogOpen(true);
  }

  async function confirmDelete() {
    if (!selectedPlaylist) return;

    try {
      setDeletingId(selectedPlaylist.id);
      await deletePlaylist(selectedPlaylist.id);
      await loadPlaylists();
      setDeleteDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setError(`削除に失敗しました: ${message}`);
    } finally {
      setDeletingId(null);
      setSelectedPlaylist(null);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (isLoading && playlists.length === 0) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* エラー表示 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* プレイリスト一覧 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>プレイリスト一覧（{playlists.length}件）</CardTitle>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新規作成
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {playlists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              プレイリストがありません
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>プレイリスト名</TableHead>
                    <TableHead>録音数</TableHead>
                    <TableHead>作成日時</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playlists.map((playlist) => {
                    const hasRecordings = (playlist.recording_count || 0) > 0;
                    return (
                      <TableRow key={playlist.id}>
                        <TableCell>
                          <Link
                            href={`${basePath}/playlists/${playlist.id}`}
                            className="text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            {playlist.name}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </TableCell>
                        <TableCell>{playlist.recording_count || 0}件</TableCell>
                        <TableCell>{formatDate(playlist.created_at)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    onClick={() => openDeleteDialog(playlist.id, playlist.name, playlist.recording_count || 0)}
                                    disabled={deletingId === playlist.id || hasRecordings}
                                    variant="destructive"
                                    size="sm"
                                  >
                                    {deletingId === playlist.id ? (
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
                                </span>
                              </TooltipTrigger>
                              {hasRecordings && (
                                <TooltipContent>
                                  <p>録音が含まれているプレイリストは削除できません</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>プレイリストを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedPlaylist && selectedPlaylist.recordingCount > 0 ? (
                <>
                  プレイリスト「{selectedPlaylist?.name}」には{selectedPlaylist.recordingCount}件の録音が含まれています。
                  録音をすべて削除してから、プレイリストを削除してください。
                </>
              ) : (
                <>
                  プレイリスト「{selectedPlaylist?.name}」を削除してもよろしいですか？
                  この操作は取り消せません。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            {selectedPlaylist && selectedPlaylist.recordingCount === 0 && (
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                削除
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* プレイリスト作成モーダル */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規プレイリスト作成</DialogTitle>
            <DialogDescription>
              録音をグループ化するプレイリストを作成します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="プレイリスト名を入力"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  handleCreate();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewPlaylistName('');
              }}
              disabled={isCreating}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !newPlaylistName.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  作成中...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  作成
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
