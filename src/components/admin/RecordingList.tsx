'use client';

import { useState, useEffect } from 'react';
import { Recording } from '@/lib/types';
import { getRecordings, getRecordingUrl, deleteRecording } from '@/lib/supabase';

export default function RecordingList() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadRecordings();

    // クリーンアップ
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);

  async function loadRecordings() {
    try {
      setIsLoading(true);
      setError('');
      const data = await getRecordings();
      // 管理画面では新しい順に表示
      setRecordings(data.reverse());
    } catch (err) {
      const message = err instanceof Error ? err.message : '録音の取得に失敗しました';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string, filePath: string) {
    if (!confirm('この録音を削除してもよろしいですか？')) {
      return;
    }

    try {
      setDeletingId(id);
      console.log('削除開始:', { id, filePath });
      await deleteRecording(id, filePath);
      console.log('削除成功:', id);

      // 削除した録音が再生中だった場合は停止
      if (playingId === id && audioElement) {
        audioElement.pause();
        audioElement.src = '';
        setPlayingId(null);
      }

      setRecordings((prev) => prev.filter((r) => r.id !== id));
      alert('削除しました');
    } catch (err) {
      console.error('削除エラー:', err);
      const message = err instanceof Error ? err.message : '不明なエラー';
      alert(`削除に失敗しました: ${message}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteAll() {
    if (!confirm(`すべての録音（${recordings.length}件）を削除してもよろしいですか？この操作は取り消せません。`)) {
      return;
    }

    const confirmMessage = recordings.length > 10
      ? '本当にすべて削除しますか？もう一度確認してください。'
      : null;

    if (confirmMessage && !confirm(confirmMessage)) {
      return;
    }

    try {
      setIsLoading(true);

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

      setRecordings([]);
      alert('すべての録音を削除しました');
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      alert(`削除に失敗しました: ${message}`);
      // エラーが発生した場合は再読み込み
      await loadRecordings();
    } finally {
      setIsLoading(false);
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

    audio.onerror = () => {
      alert('再生に失敗しました');
      setPlayingId(null);
    };

    audio.play();
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

  if (isLoading && recordings.length === 0) {
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

  if (recordings.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">録音データがありません</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">録音一覧（{recordings.length}件）</h2>
        <button
          onClick={handleDeleteAll}
          disabled={isLoading || recordings.length === 0}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          すべて削除
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  作成日時
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  再生時間
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recordings.map((recording) => (
                <tr key={recording.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(recording.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(recording.duration)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                    <button
                      onClick={() => handlePlay(recording.id, recording.file_path)}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        playingId === recording.id
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {playingId === recording.id ? '停止' : '再生'}
                    </button>
                    <button
                      onClick={() => handleDelete(recording.id, recording.file_path)}
                      disabled={deletingId === recording.id}
                      className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {deletingId === recording.id ? '削除中...' : '削除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
