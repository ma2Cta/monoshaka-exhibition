'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  getPlaylistById,
  getPlaylistRecordings,
} from '@/lib/supabase';
import RecordingList from '@/components/admin/RecordingList';
import Statistics from '@/components/admin/Statistics';
import type { Recording } from '@/lib/types';

export default function PlaylistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const playlistId = params.id as string;

  const [playlistName, setPlaylistName] = useState('');
  const [playlistIsActive, setPlaylistIsActive] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPlaylistData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  async function loadPlaylistData() {
    try {
      setIsLoading(true);
      setError('');
      const [playlist, recordingsData] = await Promise.all([
        getPlaylistById(playlistId),
        getPlaylistRecordings(playlistId),
      ]);
      setPlaylistName(playlist.name);
      setPlaylistIsActive(playlist.is_active);
      setRecordings(recordingsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-8">
          <div className="text-gray-600">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          エラー: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* ヘッダー */}
        <div>
          <button
            onClick={() => router.push('/admin')}
            className="text-blue-600 hover:text-blue-800 mb-4"
          >
            ← 管理画面に戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{playlistName}</h1>
          <div className="flex gap-4 text-gray-600">
            <p>
              状態: {' '}
              <span className={playlistIsActive ? 'text-green-600 font-semibold' : ''}>
                {playlistIsActive ? '有効' : '無効'}
              </span>
            </p>
            <p>録音数: {recordings.length}件</p>
          </div>
        </div>

        {/* 統計情報 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">統計情報</h2>
          <Statistics recordings={recordings} isLoading={isLoading} />
        </div>

        {/* プレイリスト情報カード */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">プレイリスト情報</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">プレイリスト名</span>
              <span className="font-medium text-gray-900">{playlistName}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">録音数</span>
              <span className="font-medium text-gray-900">{recordings.length}件</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">状態</span>
              <span className={`font-medium ${playlistIsActive ? 'text-green-600' : 'text-gray-500'}`}>
                {playlistIsActive ? '有効（再生画面で使用中）' : '無効'}
              </span>
            </div>
          </div>
        </div>

        {/* 説明 */}
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-md">
          <p className="text-sm">
            プレイリストへの録音の追加は、録音画面で録音を行うと自動的に有効なプレイリストに追加されます。
          </p>
        </div>

        {/* 録音一覧 */}
        <div>
          <RecordingList recordings={recordings} onUpdate={loadPlaylistData} />
        </div>
      </div>
    </div>
  );
}
