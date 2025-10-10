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

export default function PlaylistManager() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

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
      alert('プレイリスト名を入力してください');
      return;
    }

    try {
      setIsCreating(true);
      await createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      await loadPlaylists();
      alert('プレイリストを作成しました');
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      alert(`作成に失敗しました: ${message}`);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`プレイリスト「${name}」を削除してもよろしいですか？`)) {
      return;
    }

    try {
      setDeletingId(id);
      await deletePlaylist(id);
      await loadPlaylists();
      alert('削除しました');
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      alert(`削除に失敗しました: ${message}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSetActive(id: string, name: string) {
    if (!confirm(`プレイリスト「${name}」を有効にしますか？`)) {
      return;
    }

    try {
      setActivatingId(id);
      await setActivePlaylist(id);
      await loadPlaylists();
      alert('有効なプレイリストを変更しました');
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      alert(`変更に失敗しました: ${message}`);
    } finally {
      setActivatingId(null);
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
      <div className="text-center py-8">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-md">
        エラー: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* プレイリスト作成フォーム */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-3">新規プレイリスト作成</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="プレイリスト名を入力"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreate();
              }
            }}
          />
          <button
            onClick={handleCreate}
            disabled={isCreating || !newPlaylistName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? '作成中...' : '作成'}
          </button>
        </div>
      </div>

      {/* プレイリスト一覧 */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">プレイリスト一覧（{playlists.length}件）</h2>
      </div>

      {playlists.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-600">プレイリストがありません</div>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    プレイリスト名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    作成日時
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {playlists.map((playlist) => (
                  <tr
                    key={playlist.id}
                    className={`hover:bg-gray-50 ${playlist.is_active ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {playlist.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          有効
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          無効
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/admin/playlists/${playlist.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {playlist.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(playlist.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      {!playlist.is_active && (
                        <button
                          onClick={() => handleSetActive(playlist.id, playlist.name)}
                          disabled={activatingId === playlist.id}
                          className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {activatingId === playlist.id ? '設定中...' : '有効にする'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(playlist.id, playlist.name)}
                        disabled={deletingId === playlist.id}
                        className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {deletingId === playlist.id ? '削除中...' : '削除'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
