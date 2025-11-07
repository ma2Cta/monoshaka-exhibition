'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Playlist } from '@/lib/types';
import {
  getPlaylists,
  createPlaylist,
  deletePlaylist,
  setActivePlaylist,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';

interface PlaylistManagerProps {
  basePath?: string;
}

export default function PlaylistManager({ basePath = '/admin' }: PlaylistManagerProps = {}) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<{ id: string; name: string } | null>(null);

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
      await loadPlaylists();
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setError(`作成に失敗しました: ${message}`);
    } finally {
      setIsCreating(false);
    }
  }

  function openDeleteDialog(id: string, name: string) {
    setSelectedPlaylist({ id, name });
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

  function openActivateDialog(id: string, name: string) {
    setSelectedPlaylist({ id, name });
    setActivateDialogOpen(true);
  }

  async function confirmActivate() {
    if (!selectedPlaylist) return;

    try {
      setActivatingId(selectedPlaylist.id);
      await setActivePlaylist(selectedPlaylist.id);
      await loadPlaylists();
      setActivateDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setError(`変更に失敗しました: ${message}`);
    } finally {
      setActivatingId(null);
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

      {/* プレイリスト作成フォーム */}
      <Card>
        <CardHeader>
          <CardTitle>新規プレイリスト作成</CardTitle>
          <CardDescription>録音をグループ化するプレイリストを作成します</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="プレイリスト名を入力"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate();
                }
              }}
            />
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
          </div>
        </CardContent>
      </Card>

      {/* プレイリスト一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>プレイリスト一覧（{playlists.length}件）</CardTitle>
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
                    <TableHead>状態</TableHead>
                    <TableHead>プレイリスト名</TableHead>
                    <TableHead>作成日時</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playlists.map((playlist) => (
                    <TableRow key={playlist.id}>
                      <TableCell>
                        {playlist.is_active ? (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            有効
                          </Badge>
                        ) : (
                          <Badge variant="secondary">無効</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`${basePath}/playlists/${playlist.id}`}
                          className="text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          {playlist.name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(playlist.created_at)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {!playlist.is_active && (
                          <Button
                            onClick={() => openActivateDialog(playlist.id, playlist.name)}
                            disabled={activatingId === playlist.id}
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {activatingId === playlist.id ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                設定中...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                有効にする
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          onClick={() => openDeleteDialog(playlist.id, playlist.name)}
                          disabled={deletingId === playlist.id}
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
                      </TableCell>
                    </TableRow>
                  ))}
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
              プレイリスト「{selectedPlaylist?.name}」を削除してもよろしいですか？
              この操作は取り消せません。
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

      {/* 有効化確認ダイアログ */}
      <AlertDialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>プレイリストを有効にしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              プレイリスト「{selectedPlaylist?.name}」を有効にします。
              他のプレイリストが有効な場合は、そちらが無効になります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmActivate} className="bg-green-600 hover:bg-green-700">
              有効にする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
